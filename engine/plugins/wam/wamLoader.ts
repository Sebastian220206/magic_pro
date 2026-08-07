/**
 * wamLoader.ts
 * Loads a Web Audio Module from a URL and instantiates it.
 *
 * The plugin is an ES module whose default export is a `WebAudioModule`
 * constructor. Its own assets (`gui.js`, `.wasm`) are referenced relatively, so
 * it must be served from a path that mirrors its upstream layout — see
 * `app/api/wam/[...path]/route.ts`.
 */

import { ensureWamHost } from './wamHost';
import { PLUGIN_PROXY_PREFIX } from './allowlist';

/** Minimal shape of what a WAM module default-exports. */
export interface WebAudioModuleConstructor {
    isWebAudioModuleConstructor?: boolean;
    createInstance(
        groupId: string,
        audioContext: BaseAudioContext,
        initialState?: unknown,
    ): Promise<WebAudioModuleInstance>;
}

/** The subset of a WAM instance this app uses. */
export interface WebAudioModuleInstance {
    audioNode: WamNodeLike;
    descriptor?: Record<string, unknown>;
    createGui?(): Promise<HTMLElement>;
    destroyGui?(el: HTMLElement): void;
    destroy?(): void;
}

export interface WamNodeLike extends AudioNode {
    getParameterInfo(): Promise<Record<string, WamParameterInfoLike>>;
    getParameterValues(normalized?: boolean): Promise<Record<string, { id: string; value: number; normalized: number }>>;
    setParameterValues(values: Record<string, { id: string; value: number; normalized?: number }>): Promise<void>;
    getState(): Promise<unknown>;
    setState(state: unknown): Promise<void>;
    scheduleEvents(...events: unknown[]): void;
    getCompensationDelay?(): Promise<number> | number;
    destroy?(): void;
}

export interface WamParameterInfoLike {
    id: string;
    label?: string;
    type?: string;
    defaultValue: number;
    minValue: number;
    maxValue: number;
    units?: string;
    choices?: string[];
}

/**
 * Module cache. Loading the same plugin twice should reuse the module — each
 * `createInstance` still produces an independent plugin.
 */
const modules = new Map<string, Promise<WebAudioModuleConstructor>>();

/**
 * Dynamically import a module whose URL is only known at runtime.
 *
 * Webpack rewrites a bare `import(variable)` into a context module resolved at
 * build time, which fails for a URL like this. `new Function` keeps the call
 * opaque to the bundler so the browser's native dynamic import runs instead.
 * `engine/audioEngine/scheduler.ts` documents the same class of workaround.
 */
const nativeImport: (url: string) => Promise<Record<string, unknown>> =
    new Function('url', 'return import(url)') as never;

/** Reject anything that isn't served by our own proxy. */
function assertProxied(url: string): void {
    if (!url.startsWith(PLUGIN_PROXY_PREFIX + '/')) {
        throw new Error(
            `Refusing to load a plugin from "${url}". Plugins must be served through ${PLUGIN_PROXY_PREFIX}.`,
        );
    }
}

/** Fetch and validate a plugin module. */
export function loadWamModule(url: string): Promise<WebAudioModuleConstructor> {
    assertProxied(url);

    const cached = modules.get(url);
    if (cached) return cached;

    const pending = (async () => {
        const imported = await nativeImport(url);
        const ctor = imported.default as WebAudioModuleConstructor | undefined;

        if (!ctor || typeof ctor !== 'function' || !(ctor as { isWebAudioModuleConstructor?: boolean }).isWebAudioModuleConstructor) {
            throw new Error(`"${url}" does not default-export a WebAudioModule constructor.`);
        }
        return ctor;
    })().catch(error => {
        // Don't cache a failure — a transient network error should be retryable.
        modules.delete(url);
        throw error;
    });

    modules.set(url, pending);
    return pending;
}

/**
 * Create a plugin instance on `ctx`, restoring `initialState` if given.
 *
 * The WAM environment for the context is established first; that is what makes
 * the same call work for both live playback and offline render.
 */
export async function createWamInstance(
    ctx: BaseAudioContext,
    url: string,
    initialState?: unknown,
): Promise<WebAudioModuleInstance> {
    const [{ groupId }, ctor] = await Promise.all([
        ensureWamHost(ctx),
        loadWamModule(url),
    ]);

    return ctor.createInstance(groupId, ctx, initialState);
}

/** Drop a cached module, e.g. after a failed load the user wants to retry. */
export function forgetWamModule(url: string): void {
    modules.delete(url);
}
