import {
    activeTakeOf,
    resolveClipForPlayback,
    resolveClipsForPlayback,
    type ResolvableClip,
} from '@/engine/audioEngine/takeResolver';

const take = (id: string, sampleId: string): ResolvableClip => ({
    id,
    trackId: 'track-1',
    type: 'audio',
    startBeat: 0,
    duration: 8,
    sampleId,
});

const folder = (overrides: Partial<ResolvableClip> = {}): ResolvableClip => ({
    id: 'folder-1',
    trackId: 'track-1',
    type: 'audio',
    startBeat: 16,
    duration: 8,
    isTakeFolder: true,
    takes: [take('t0', 'sample-a'), take('t1', 'sample-b'), take('t2', 'sample-c')],
    activeTakeIndex: 0,
    ...overrides,
});

describe('activeTakeOf', () => {
    test('returns null for a plain clip', () => {
        expect(activeTakeOf(take('plain', 'x'))).toBeNull();
    });

    test('selects by activeTakeIndex', () => {
        expect(activeTakeOf(folder({ activeTakeIndex: 1 }))?.sampleId).toBe('sample-b');
    });

    test('falls back to the first take for an out-of-range index', () => {
        expect(activeTakeOf(folder({ activeTakeIndex: 99 }))?.sampleId).toBe('sample-a');
    });

    test('an active comp overrides the take index', () => {
        const clip = folder({
            activeTakeIndex: 0,
            comps: [{ id: 'comp-1', name: 'Comp 1', takeIndex: 2 }],
            activeCompId: 'comp-1',
        });
        expect(activeTakeOf(clip)?.sampleId).toBe('sample-c');
    });

    test('an unknown comp id falls back to the take index', () => {
        const clip = folder({ activeTakeIndex: 1, activeCompId: 'missing' });
        expect(activeTakeOf(clip)?.sampleId).toBe('sample-b');
    });

    test('an empty folder resolves to nothing', () => {
        expect(activeTakeOf(folder({ takes: [] }))).toBeNull();
    });
});

describe('resolveClipForPlayback', () => {
    test('a plain clip passes through unchanged', () => {
        const clip = take('plain', 'x');
        expect(resolveClipForPlayback(clip)).toBe(clip);
    });

    test('a muted clip is dropped', () => {
        expect(resolveClipForPlayback({ ...take('m', 'x'), muted: true })).toBeNull();
    });

    test('a take folder resolves to its active take audio', () => {
        const result = resolveClipForPlayback(folder({ activeTakeIndex: 1 }));
        expect(result?.sampleId).toBe('sample-b');
    });

    test('the resolved take keeps the folder position on the timeline', () => {
        // Regression: takes are recorded at beat 0 but the folder sits at 16.
        const result = resolveClipForPlayback(folder({ activeTakeIndex: 1 }));
        expect(result?.startBeat).toBe(16);
        expect(result?.start).toBe(16);
    });

    test('the resolved clip keeps the folder identity', () => {
        const result = resolveClipForPlayback(folder());
        expect(result?.id).toBe('folder-1');
    });

    test('the resolved clip is no longer a folder', () => {
        const result = resolveClipForPlayback(folder());
        expect(result?.isTakeFolder).toBe(false);
    });

    test('does not play past the folder length', () => {
        const result = resolveClipForPlayback(folder({ duration: 4 }));
        expect(result?.duration).toBe(4);
    });

    test('an empty folder is dropped rather than scheduled silent', () => {
        expect(resolveClipForPlayback(folder({ takes: [] }))).toBeNull();
    });
});

describe('resolveClipsForPlayback', () => {
    test('resolves a mixed list', () => {
        const result = resolveClipsForPlayback([
            take('plain', 'x'),
            folder({ activeTakeIndex: 2 }),
            { ...take('muted', 'y'), muted: true },
        ]);

        expect(result.map(c => c.sampleId)).toEqual(['x', 'sample-c']);
    });

    test('an empty list resolves to empty', () => {
        expect(resolveClipsForPlayback([])).toEqual([]);
    });
});
