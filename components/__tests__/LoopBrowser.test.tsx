/**
 * The loop browser, driving the real store.
 *
 * This is where the MIDI library meets the timeline, and the interesting
 * failures are all silent ones: a MIDI loop inserted as an audio clip plays
 * nothing, notes sharing ids collide when two copies of a loop are added, and
 * a loop dropped on a track with no instrument sits there mute.
 *
 * Zustand state is set directly rather than mocked, so what is under test is
 * the actual store contract rather than a stand-in for it.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoopBrowser } from '@/components/LoopBrowser';
import { useProjectStore } from '@/store/projectStore';
import { loopLibrary } from '@/data/loopLibrary';

const previewMidiLoop = jest.fn().mockResolvedValue(undefined);
const previewLoop = jest.fn().mockResolvedValue(undefined);
const loadInstrument = jest.fn().mockResolvedValue(undefined);
const stopPreview = jest.fn();

jest.mock('@/engine/AudioEngineAdapter', () => ({
    audioEngine: {
        previewMidiLoop: (...a: unknown[]) => previewMidiLoop(...a),
        previewLoop: (...a: unknown[]) => previewLoop(...a),
        loadInstrument: (...a: unknown[]) => loadInstrument(...a),
        stopPreview: () => stopPreview(),
    },
}));

const TRACK_ID = 'track-under-test';

/** Put the store into a state where the browser is open over one empty track. */
function openBrowserWithTrack(instrument?: string) {
    act(() => {
        useProjectStore.setState({
            showLoopBrowser: true,
            focusedTrackId: TRACK_ID,
            tracks: [{
                id: TRACK_ID,
                name: 'Track 1',
                type: 'software-instrument',
                activeAlternativeId: 'alt-1',
                instrument,
            }] as never,
            clips: [],
        } as never);
    });
}

/** Clips currently in the store. */
function clips() {
    return useProjectStore.getState().clips;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('rendering', () => {
    it('renders nothing when the browser is closed', () => {
        act(() => { useProjectStore.setState({ showLoopBrowser: false } as never); });

        const { container } = render(<LoopBrowser />);

        expect(container).toBeEmptyDOMElement();
    });

    it('shows generated loops from the library', () => {
        openBrowserWithTrack();
        render(<LoopBrowser />);

        // A name only the MIDI generator produces — proof the generated library
        // reached the UI and not just the data file.
        expect(screen.getAllByText(/Four on the Floor/i).length).toBeGreaterThan(0);
    });
});

describe('auditioning', () => {
    it('previews a MIDI loop through an instrument, not a file', async () => {
        const user = userEvent.setup();
        openBrowserWithTrack();
        render(<LoopBrowser />);

        await user.click(screen.getAllByText(/Four on the Floor/i)[0]);

        expect(previewMidiLoop).toHaveBeenCalled();
        // A MIDI loop has no file; calling previewLoop would fetch `undefined`.
        expect(previewLoop).not.toHaveBeenCalled();

        const [notes, bpm, instrument] = previewMidiLoop.mock.calls[0];
        expect(Array.isArray(notes)).toBe(true);
        expect((notes as unknown[]).length).toBeGreaterThan(0);
        expect(bpm).toBeGreaterThan(0);
        // Drum patterns must not audition on a piano.
        expect(instrument).toBe('drums');
    });
});

describe('adding to the timeline', () => {
    /**
     * Add a loop the way a user does: double-click its row.
     *
     * The browser offers no button with an accessible name for this — the other
     * affordance is a bare `PlusCircle` svg with an onClick. An earlier version
     * of this helper looked for `title="add to timeline"`, found nothing, and
     * returned early, so four tests below passed without asserting anything.
     */
    async function addLoop(matcher: RegExp) {
        const user = userEvent.setup();
        const row = screen.getAllByText(matcher)[0];

        await user.dblClick(row);

        // Fail loudly rather than silently skipping if the interaction stops
        // producing a clip.
        expect(clips().length).toBeGreaterThan(0);
    }

    it('inserts a MIDI loop as a MIDI clip carrying its notes', async () => {
        openBrowserWithTrack();
        render(<LoopBrowser />);

        await addLoop(/Four on the Floor/i);

        const clip = clips().at(-1);
        expect(clip?.type).toBe('midi');
        // The point of a MIDI library: the notes must survive into the clip,
        // where the piano roll can edit them.
        expect(clip?.notes?.length).toBeGreaterThan(0);
        expect(clip?.fileUrl).toBeUndefined();
    });

    it('gives every inserted note a unique id', async () => {
        openBrowserWithTrack();
        render(<LoopBrowser />);

        await addLoop(/Four on the Floor/i);

        const notes = clips().at(-1)?.notes ?? [];
        // Duplicated ids make the piano roll edit or delete the wrong note.
        expect(new Set(notes.map(n => n.id)).size).toBe(notes.length);
    });

    it('loads an instrument when the track has none', async () => {
        openBrowserWithTrack(undefined);
        render(<LoopBrowser />);

        await addLoop(/Four on the Floor/i);

        // Otherwise the loop lands and the first press of play is silent.
        expect(loadInstrument).toHaveBeenCalledWith(TRACK_ID, 'drums');
    });

    it('leaves an existing instrument alone', async () => {
        openBrowserWithTrack('piano');
        render(<LoopBrowser />);

        await addLoop(/Four on the Floor/i);

        // Replacing a chosen instrument because a loop was dropped would be a
        // surprising thing to do to someone's track.
        expect(loadInstrument).not.toHaveBeenCalled();
    });
});

describe('library reaching the browser', () => {
    it('has MIDI loops available to render', () => {
        // Guards the wiring between the generated JSON and the component: if
        // the merge in loopLibrary.ts broke, the browser would silently show
        // only the 22 sampled loops.
        expect(loopLibrary.filter(l => l.notes?.length).length).toBeGreaterThan(100);
    });
});
