/**
 * Which track types host MIDI notes.
 *
 * Four types can carry notes, and code that checked only `=== 'midi'` treated
 * the other three as audio. The New Track dialog creates `software-instrument`
 * and `drummer` tracks, so that shorthand covered almost nothing a user
 * actually makes: recording onto a software-instrument track produced a clip
 * typed `audio` holding MIDI notes, which the sequencer skips entirely — the
 * notes were captured and then never played.
 */
import type { TrackType } from '@/models/Track';

const MIDI_TRACK_TYPES: ReadonlySet<string> = new Set<TrackType>([
    'midi',
    'software-instrument',
    'drummer',
    'external-midi',
]);

/** True when notes recorded on this track belong in a MIDI clip. */
export function isMidiTrackType(type: string | undefined | null): boolean {
    return !!type && MIDI_TRACK_TYPES.has(type);
}

/** The clip type a recording on this track should produce. */
export function recordedClipType(type: string | undefined | null): 'midi' | 'audio' {
    return isMidiTrackType(type) ? 'midi' : 'audio';
}
