/**
 * wamHost.ts
 * Web Audio Modules host environment.
 *
 * A WAM plugin cannot be instantiated until a `WamEnv` and a `WamGroup` exist in
 * the target context's AudioWorklet global scope. Both are installed by the SDK's
 * `initializeWamHost`.
 *
 * Initialisation is memoised **per AudioContext** for two reasons:
 *  - `reactStrictMode` is on, so effects mount twice in development; a second
 *    `initializeWamEnv` on the same worklet scope throws.
 *  - Offline render uses a different context, and that one genuinely does need
 *    its own environment. Keying on the context handles both cases with one rule.
 */

export interface WamHostHandle {
    groupId: string;
    groupKey: string;
}

/** One environment per context. A WeakMap so offline contexts are collectable. */
const hosts = new WeakMap<BaseAudioContext, Promise<WamHostHandle>>();

/**
 * Ensure a WAM environment exists on `ctx`, returning its group identity.
 *
 * Safe to call repeatedly; concurrent callers share one initialisation. A
 * failure is not cached, so a later attempt can retry.
 */
export function ensureWamHost(ctx: BaseAudioContext): Promise<WamHostHandle> {
    const existing = hosts.get(ctx);
    if (existing) return existing;

    const pending = (async (): Promise<WamHostHandle> => {
        // Imported dynamically: the SDK reaches for AudioWorklet at module
        // scope, which does not exist during server rendering.
        const { initializeWamHost } = await import('@webaudiomodules/sdk');
        const [groupId, groupKey] = await initializeWamHost(ctx);
        return { groupId, groupKey };
    })().catch(error => {
        hosts.delete(ctx);
        throw error;
    });

    hosts.set(ctx, pending);
    return pending;
}

/** True when a host has already been established for this context. */
export function hasWamHost(ctx: BaseAudioContext): boolean {
    return hosts.has(ctx);
}
