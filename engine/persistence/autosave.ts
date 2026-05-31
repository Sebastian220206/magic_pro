import { serializeStoreState, saveToIndexedDB } from './projectPersistence';

type Unsubscribe = () => void;
type StoreSubscribe = (selector: (state: any) => any, listener: (slice: any, prevSlice: any) => void) => Unsubscribe;

export function createAutosave(
  subscribe: StoreSubscribe,
  getState: () => any,
  options: { debounceMs?: number } = {}
): Unsubscribe {
  const debounceMs = options.debounceMs ?? 3000;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingSave = false;

  const doSave = () => {
    if (pendingSave) return;
    pendingSave = true;

    const saveFn = async () => {
      try {
        const state = getState();
        if (!state.id || !state.isDirty) return;
        const serialized = serializeStoreState(getState);
        await saveToIndexedDB(state.id, serialized);
      } catch (e) {
        console.warn('[Autosave] Failed:', e);
      } finally {
        pendingSave = false;
      }
    };

    // Use requestIdleCallback if available, fallback to setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => { saveFn(); }, { timeout: 3000 });
    } else {
      setTimeout(saveFn, 0);
    }
  };

  // Subscribe to just the fields that affect persistence
  const unsub = subscribe(
    (s: any) => ({
      id: s.id,
      isDirty: s.isDirty,
      tracks: s.tracks,
      clips: s.clips,
    }),
    (slice: any, prevSlice: any) => {
      if (!slice.id || !slice.isDirty) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(doSave, debounceMs);
    }
  );

  return () => {
    if (timer) clearTimeout(timer);
    unsub();
  };
}
