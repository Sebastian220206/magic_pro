import { createAutosave } from '@/engine/persistence/autosave';
import { saveToIndexedDB, serializeStoreState } from '@/engine/persistence/projectPersistence';

jest.mock('@/engine/persistence/projectPersistence', () => ({
  serializeStoreState: jest.fn((getState: any) => getState()),
  saveToIndexedDB: jest.fn(async () => {}),
}));

// Force the setTimeout fallback so tests are deterministic with fake timers.
(globalThis as any).requestIdleCallback = undefined;

const mockedSave = saveToIndexedDB as jest.Mock;
const mockedSerialize = serializeStoreState as jest.Mock;

function createStoreState(overrides: Record<string, any> = {}) {
  return {
    id: 'proj-1',
    isDirty: true,
    tracks: [{ id: 'track-1' }],
    clips: [{ id: 'clip-1' }],
    zoom: 1,
    ...overrides,
  };
}

/** Build a fake zustand store: captures the registered listener. */
function createFakeStore(initial: any) {
  let state = initial;
  let listener: ((state: any, prevState: any) => void) | null = null;
  return {
    subscribe: jest.fn((fn: any) => {
      listener = fn;
      return () => { listener = null; };
    }),
    getState: () => state,
    /** Simulate a store update, mirroring zustand's (state, prevState) call. */
    emit(next: any) {
      const prev = state;
      state = next;
      listener?.(next, prev);
    },
  };
}

describe('createAutosave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('subscribes with a SINGLE listener argument (vanilla zustand API)', () => {
    // Regression: the previous implementation used the two-arg
    // subscribe(selector, listener) form, which requires the
    // subscribeWithSelector middleware the project store does not have.
    // That registered the selector AS the listener and the save never ran.
    const store = createFakeStore(createStoreState());
    createAutosave(store.subscribe as any, store.getState, { debounceMs: 100 });

    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(store.subscribe.mock.calls[0].length).toBe(1);
    expect(typeof store.subscribe.mock.calls[0][0]).toBe('function');
  });

  test('schedules a save after the debounce window and persists the project', async () => {
    const store = createFakeStore(createStoreState());
    createAutosave(store.subscribe as any, store.getState, { debounceMs: 100 });

    // A change that touches persistence-relevant slices (new tracks array ref).
    store.emit(createStoreState({ tracks: [{ id: 'track-1', volume: 0.5 }] }));

    // Inside the debounce window: nothing saved yet.
    jest.advanceTimersByTime(99);
    expect(mockedSave).not.toHaveBeenCalled();

    // Past the window: the save fires.
    jest.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedSerialize).toHaveBeenCalled();
    expect(mockedSave).toHaveBeenCalledWith('proj-1', expect.objectContaining({ id: 'proj-1' }));
  });

  test('does NOT save when the project is not dirty', () => {
    const store = createFakeStore(createStoreState({ isDirty: false }));
    createAutosave(store.subscribe as any, store.getState, { debounceMs: 100 });

    store.emit(createStoreState({ isDirty: false, tracks: [{ id: 'track-1', volume: 0.9 }] }));

    jest.runAllTimers();

    expect(mockedSave).not.toHaveBeenCalled();
  });

  test('does NOT save on changes to unrelated slices', () => {
    const initial = createStoreState();
    const store = createFakeStore(initial);
    createAutosave(store.subscribe as any, store.getState, { debounceMs: 100 });

    // Only `zoom` changed — id/isDirty/tracks/clips references are unchanged.
    store.emit({ ...initial, zoom: 2 });

    jest.runAllTimers();

    expect(mockedSave).not.toHaveBeenCalled();
  });

  test('unsubscribe cancels the pending timer and removes the listener', () => {
    const store = createFakeStore(createStoreState());
    const unsub = createAutosave(store.subscribe as any, store.getState, { debounceMs: 100 });

    store.emit(createStoreState({ tracks: [{ id: 'track-1', volume: 0.3 }] }));
    unsub();

    jest.runAllTimers();

    expect(mockedSave).not.toHaveBeenCalled();
  });
});
