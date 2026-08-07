import { serializeStoreState, saveToIndexedDB } from './projectPersistence';

type Unsubscribe = () => void;

/**
 * zustand vanilla stores expose `subscribe(listener: (state, prevState) => void)`.
 * The two-argument `subscribe(selector, listener)` form only exists when the
 * store is created with the `subscribeWithSelector` middleware — which the
 * project store is NOT. Passing a selector there would register the selector
 * AS the listener, silently discarding the real save listener.
 *
 * So we subscribe with a plain listener and filter persistence-relevant
 * slices ourselves.
 */
type StoreSubscribe = (listener: (state: any, prevState: any) => void) => Unsubscribe;

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
  const unsub = subscribe((state: any, prevState: any) => {
    if (!state.id || !state.isDirty) return;

    const changed =
      state.id !== prevState?.id ||
      state.isDirty !== prevState?.isDirty ||
      state.tracks !== prevState?.tracks ||
      state.clips !== prevState?.clips;

    if (!changed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(doSave, debounceMs);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsub();
  };
}
