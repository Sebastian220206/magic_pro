/**
 * @jest-environment jsdom
 *
 * A newly created project keeps the tracks it was created with.
 *
 * "Blank Project (starts with Drums + Piano)" produced a project with no
 * tracks at all, so there was nothing to arm and nothing recorded — no sound,
 * no region, an empty piano roll.
 *
 * Two faults combined:
 *
 *  - `loadProject` checks whether the requested project is already in memory
 *    and sets `loaded = true` to keep it. Only the API fallback tested that
 *    flag; the IndexedDB branch above it ran unconditionally and called
 *    `set(restored)`, overwriting the live project with whatever was stored.
 *  - The blank path added its two tracks with two separate `addTrack` calls.
 *    Autosave observed the state between them and persisted a project with no
 *    tracks, which is exactly the snapshot the load above then restored.
 *
 * The template path was unaffected because it builds tracks and clips in one
 * `setState`, which is why templates worked and blank projects did not.
 */

import { useProjectStore } from '@/store/projectStore';

(globalThis as any).requestAnimationFrame = (cb: Function) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

const loadFromIndexedDB = jest.fn();

jest.mock('@/engine/persistence/projectPersistence', () => ({
    ...jest.requireActual('@/engine/persistence/projectPersistence'),
    loadFromIndexedDB: (...a: unknown[]) => loadFromIndexedDB(...a),
    saveToIndexedDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/engine/persistence/engineRebuilder', () => ({
    rebuildEngine: jest.fn().mockResolvedValue({ success: true, errors: [] }),
}));

jest.mock('@/engine/AudioEngineAdapter', () => ({
    audioEngine: new Proxy({} as Record<string, unknown>, {
        get: (target, prop) => {
            if (prop === 'isPlaying') return false;
            if (!(prop in target)) target[prop as string] = jest.fn();
            return target[prop as string];
        },
    }),
}));

// The API fallback runs whenever storage misses; without this the request
// never settles and the suite hangs rather than failing.
beforeAll(() => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: false, status: 404, json: async () => ({}),
    });
});

const track = (id: string, name: string) => ({ id, name, type: 'software-instrument' });

describe('project creation', () => {
    beforeEach(() => {
        loadFromIndexedDB.mockReset();
        useProjectStore.setState({ id: null, tracks: [], clips: [] });
    });

    it('adds several tracks in a single state update', () => {
        const seen: number[] = [];
        const unsubscribe = useProjectStore.subscribe(s => seen.push(s.tracks.length));

        useProjectStore.getState().addTracks([track('t1', 'Drums'), track('t2', 'Piano')] as never);
        unsubscribe();

        expect(useProjectStore.getState().tracks).toHaveLength(2);
        // No subscriber — autosave above all — may observe a half-built project.
        expect(seen).not.toContain(1);
    });

    it('fills in defaults and orders the tracks it adds', () => {
        useProjectStore.getState().addTracks([track('t1', 'Drums'), track('t2', 'Piano')] as never);

        const [a, b] = useProjectStore.getState().tracks;
        expect([a.orderIndex, b.orderIndex]).toEqual([0, 1]);
        expect(a.volume).toBe(0.8);
        expect(a.outputBusId).toBe('stereo-out');
        expect(b.name).toBe('Piano');
    });

    it('appends after tracks that already exist', () => {
        useProjectStore.getState().addTracks([track('t1', 'A')] as never);
        useProjectStore.getState().addTracks([track('t2', 'B'), track('t3', 'C')] as never);

        expect(useProjectStore.getState().tracks.map(t => t.orderIndex)).toEqual([0, 1, 2]);
    });

    it('does not restore over a project that is already in memory', async () => {
        useProjectStore.setState({ id: 'proj-1', tracks: [track('t1', 'Drums')] as never });
        // A stale, trackless snapshot — what autosave wrote mid-build.
        loadFromIndexedDB.mockResolvedValue({ state: { tracks: [], clips: [] } });

        await useProjectStore.getState().loadProject('proj-1');

        expect(loadFromIndexedDB).not.toHaveBeenCalled();
        expect(useProjectStore.getState().tracks).toHaveLength(1);
    });

    it('still loads from storage when memory holds a different project', async () => {
        useProjectStore.setState({ id: 'proj-other', tracks: [track('t1', 'Drums')] as never });
        loadFromIndexedDB.mockResolvedValue(null);

        await useProjectStore.getState().loadProject('proj-1');

        expect(loadFromIndexedDB).toHaveBeenCalledWith('proj-1');
    });

    it('still loads when memory holds the project but it is empty', async () => {
        useProjectStore.setState({ id: 'proj-1', tracks: [], clips: [] });
        loadFromIndexedDB.mockResolvedValue(null);

        await useProjectStore.getState().loadProject('proj-1');

        // An empty in-memory project is not worth protecting — it is what a
        // cold navigation to a saved project looks like.
        expect(loadFromIndexedDB).toHaveBeenCalledWith('proj-1');
    });
});
