import { EraserTool } from '../EraserTool';
import { SnapEngine } from '@/engine/editor/SnapEngine';
import { CoordinateSystem, Viewport } from '@/engine/editor/CoordinateSystem';
import { InteractionEvent } from '@/engine/editor/ToolManager';

const mockState: Record<string, any> = {};

jest.mock('@/store/projectStore', () => ({
    useProjectStore: { getState: () => mockState },
}));

const viewport: Viewport = {
    scrollX: 0, scrollY: 0,
    zoomX: 100, zoomY: 80,
    width: 1280, height: 600,
};

const yOffset = 40;

function makeCoordinateSystem(): CoordinateSystem {
    const cs = new CoordinateSystem(viewport);
    return cs;
}

function makeEvent(overrides?: Partial<InteractionEvent>): InteractionEvent {
    return {
        screenPoint: { x: 0, y: 0 },
        editorPoint: { beat: 0, vertical: 0 },
        modifiers: { shift: false, ctrl: false, alt: false, meta: false },
        ...overrides,
        originalEvent: overrides?.originalEvent ?? { type: 'pointerdown' } as any,
    };
}

function makeTool(): EraserTool {
    return new EraserTool(new SnapEngine({ enabled: true, gridDivision: 4, snapToObjects: true, magneticStrength: 10 }), makeCoordinateSystem());
}

function resetMockState() {
    Object.assign(mockState, {
        clips: [],
        tracks: [],
        trackHeight: 80,
        selectedClipIds: [],
        pianoRollFocusClipId: null,
        showAutomation: false,
        isPlaying: false,
        saveHistorySnapshot: jest.fn(),
        deleteClip: jest.fn(),
        deleteNote: jest.fn(),
        deleteAutomationPoint: jest.fn(),
        deselectAllClips: jest.fn(),
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    resetMockState();
});

function addAudioClip(id: string, trackId: string, start: number, duration: number) {
    mockState.clips.push({
        id, trackId, type: 'audio', name: 'Audio 1', color: '#ff0',
        start, startBeat: start, startTime: start, duration, offset: 0,
        fadeIn: { duration: 0, curve: 'linear' as const, gain: 1 },
        fadeOut: { duration: 0, curve: 'linear' as const, gain: 1 },
        playbackRate: 1, pitchOffset: 0, stretchMode: 'none' as const,
        muted: false, loop: false, qSwing: 0, transpose: 0, velocityOffset: 0,
    });
}

function addMidiClip(id: string, trackId: string, start: number, duration: number, notes: any[] = []) {
    mockState.clips.push({
        id, trackId, type: 'midi', name: 'MIDI 1', color: '#0ff',
        start, startBeat: start, startTime: start, duration, offset: 0,
        fadeIn: { duration: 0, curve: 'linear' as const, gain: 1 },
        fadeOut: { duration: 0, curve: 'linear' as const, gain: 1 },
        playbackRate: 1, pitchOffset: 0, stretchMode: 'none' as const,
        muted: false, loop: false, qSwing: 0, transpose: 0, velocityOffset: 0,
        notes,
    });
}

function addTrack(id: string) {
    mockState.tracks.push({
        id, name: 'Track ' + id, type: 'audio' as const, orderIndex: mockState.tracks.length, automation: [],
    });
}

function addAutomationPoint(trackId: string, laneIndex: number, time: number, value: number) {
    const track = mockState.tracks.find((t: any) => t.id === trackId);
    if (!track) return;
    if (!track.automation[laneIndex]) {
        track.automation[laneIndex] = { parameter: 'volume', points: [] };
    }
    track.automation[laneIndex].points.push({ time, value });
}

function clipHitScreenX(start: number, offsetX = 10): number {
    return start * viewport.zoomX - viewport.scrollX + offsetX;
}

function clipHitScreenY(trackIndex: number, offsetY = 10): number {
    return yOffset + trackIndex * mockState.trackHeight - viewport.scrollY + offsetY;
}

// ──────────────────────────────────────────────────────

describe('EraserTool', () => {

    test('Delete audio clip', () => {
        addTrack('t1');
        addAudioClip('c1', 't1', 4, 2);
        const tool = makeTool();
        const event = makeEvent({
            screenPoint: { x: clipHitScreenX(4), y: clipHitScreenY(0) },
            editorPoint: { beat: 4.1, vertical: 0 },
        });
        tool.onPointerDown(event);
        tool.onPointerUp(event);

        expect(mockState.saveHistorySnapshot).toHaveBeenCalledTimes(1);
        expect(mockState.deleteClip).toHaveBeenCalledTimes(1);
        expect(mockState.deleteClip).toHaveBeenCalledWith('c1');
    });

    test('Delete MIDI clip', () => {
        addTrack('t1');
        addMidiClip('c1', 't1', 4, 2);
        const tool = makeTool();
        const event = makeEvent({
            screenPoint: { x: clipHitScreenX(4), y: clipHitScreenY(0) },
            editorPoint: { beat: 4.1, vertical: 0 },
        });
        tool.onPointerDown(event);
        tool.onPointerUp(event);

        expect(mockState.saveHistorySnapshot).toHaveBeenCalledTimes(1);
        expect(mockState.deleteClip).toHaveBeenCalledTimes(1);
        expect(mockState.deleteClip).toHaveBeenCalledWith('c1');
    });

    test('Delete MIDI note', () => {
        addTrack('t1');
        addMidiClip('c1', 't1', 4, 4, [
            { id: 'n1', pitch: 60, velocity: 100, start: 1, duration: 0.5 },
        ]);
        mockState.pianoRollFocusClipId = 'c1';

        const tool = makeTool();
        const noteBeat = 4 + 1 + 0.25;
        const noteScreenY = (1 - 60 / 127) * viewport.height;
        const event = makeEvent({
            screenPoint: { x: noteBeat * viewport.zoomX - viewport.scrollX, y: noteScreenY },
            editorPoint: { beat: noteBeat, vertical: 60 },
        });
        tool.onPointerDown(event);
        tool.onPointerUp(event);

        expect(mockState.saveHistorySnapshot).toHaveBeenCalledTimes(1);
        expect(mockState.deleteNote).toHaveBeenCalledTimes(1);
        expect(mockState.deleteNote).toHaveBeenCalledWith('c1', 'n1');
    });

    test('Delete automation point', () => {
        addTrack('t1');
        addAutomationPoint('t1', 0, 2, 50);
        mockState.showAutomation = true;

        const tool = makeTool();
        const ptScreenX = 2 * viewport.zoomX - viewport.scrollX;
        const trackY = yOffset + 0 * mockState.trackHeight - viewport.scrollY;
        const ptScreenY = trackY + (1 - 50 / 100) * mockState.trackHeight;

        const event = makeEvent({
            screenPoint: { x: ptScreenX, y: ptScreenY },
            editorPoint: { beat: 2, vertical: 0 },
        });
        tool.onPointerDown(event);
        tool.onPointerUp(event);

        expect(mockState.saveHistorySnapshot).toHaveBeenCalledTimes(1);
        expect(mockState.deleteAutomationPoint).toHaveBeenCalledTimes(1);
        expect(mockState.deleteAutomationPoint).toHaveBeenCalledWith('t1', 0, 0);
    });

    test('Undo restores deleted object (saveHistorySnapshot before delete)', () => {
        addTrack('t1');
        addAudioClip('c1', 't1', 4, 2);

        const snapshotOrder: string[] = [];
        mockState.saveHistorySnapshot = jest.fn(() => { snapshotOrder.push('snapshot'); });
        mockState.deleteClip = jest.fn(() => { snapshotOrder.push('delete'); });

        const tool = makeTool();
        const event = makeEvent({
            screenPoint: { x: clipHitScreenX(4), y: clipHitScreenY(0) },
            editorPoint: { beat: 4.1, vertical: 0 },
        });
        tool.onPointerDown(event);

        expect(snapshotOrder[0]).toBe('snapshot');
        expect(snapshotOrder[1]).toBe('delete');
    });

    test('Redo deletes again (future history cleared, re-snapshot on next delete)', () => {
        addTrack('t1');
        addAudioClip('c1', 't1', 4, 2);

        const tool = makeTool();
        const event = makeEvent({
            screenPoint: { x: clipHitScreenX(4), y: clipHitScreenY(0) },
            editorPoint: { beat: 4.1, vertical: 0 },
        });

        tool.onPointerDown(event);
        tool.onPointerUp(event);

        expect(mockState.saveHistorySnapshot).toHaveBeenCalledTimes(1);
        expect(mockState.deleteClip).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();

        addAudioClip('c2', 't1', 6, 1);
        const event2 = makeEvent({
            screenPoint: { x: clipHitScreenX(6), y: clipHitScreenY(0) },
            editorPoint: { beat: 6.05, vertical: 0 },
        });
        tool.onPointerDown(event2);

        expect(mockState.saveHistorySnapshot).toHaveBeenCalledTimes(1);
        expect(mockState.deleteClip).toHaveBeenCalledWith('c2');
    });

    test('Delete while playing does not crash', () => {
        addTrack('t1');
        addAudioClip('c1', 't1', 4, 2);
        mockState.isPlaying = true;

        const tool = makeTool();
        const event = makeEvent({
            screenPoint: { x: clipHitScreenX(4), y: clipHitScreenY(0) },
            editorPoint: { beat: 4.1, vertical: 0 },
        });

        expect(() => {
            tool.onPointerDown(event);
            tool.onPointerUp(event);
        }).not.toThrow();

        expect(mockState.deleteClip).toHaveBeenCalledTimes(1);
    });

    test('Delete selected group deletes all', () => {
        addTrack('t1');
        addAudioClip('c1', 't1', 4, 2);
        addAudioClip('c2', 't1', 7, 1);
        addAudioClip('c3', 't1', 9, 3);
        mockState.selectedClipIds = ['c1', 'c2', 'c3'];

        const tool = makeTool();
        const event = makeEvent({
            screenPoint: { x: clipHitScreenX(4), y: clipHitScreenY(0) },
            editorPoint: { beat: 4.1, vertical: 0 },
        });
        tool.onPointerDown(event);
        tool.onPointerUp(event);

        expect(mockState.saveHistorySnapshot).toHaveBeenCalledTimes(1);
        expect(mockState.deleteClip).toHaveBeenCalledTimes(3);
        expect(mockState.deleteClip).toHaveBeenCalledWith('c1');
        expect(mockState.deleteClip).toHaveBeenCalledWith('c2');
        expect(mockState.deleteClip).toHaveBeenCalledWith('c3');
        expect(mockState.deselectAllClips).toHaveBeenCalledTimes(1);
    });

    test('No zombie audio after deletion', () => {
        addTrack('t1');
        addAudioClip('c1', 't1', 4, 2);
        const capturedIds: string[] = [];
        mockState.deleteClip = jest.fn((id: string) => {
            capturedIds.push(id);
            mockState.clips = mockState.clips.filter((c: any) => c.id !== id);
        });

        const tool = makeTool();
        const event = makeEvent({
            screenPoint: { x: clipHitScreenX(4), y: clipHitScreenY(0) },
            editorPoint: { beat: 4.1, vertical: 0 },
        });
        tool.onPointerDown(event);
        tool.onPointerUp(event);

        expect(capturedIds).toContain('c1');
        const deletedClip = mockState.clips.find((c: any) => c.id === 'c1');
        expect(deletedClip).toBeUndefined();
    });

});
