/**
 * pluginSpec.ts
 * The engine-facing description of one plugin instance.
 *
 * `PluginSetting` (models/Track.ts) is the store/UI shape and carries display
 * concerns; `PluginSpec` is what the audio graph needs. Keeping them separate
 * means the engine never depends on store types, and the store never has to
 * know about audio nodes.
 */

import type { PluginFormat, PluginSetting } from '@/models/Track';
import { resolvePluginId } from './pluginIds';

export interface PluginSpec {
    /** Instance id. Stable across reorder — the chain diffs on this. */
    instanceId: string;
    /** Canonical plugin id. */
    pluginId: string;
    format: PluginFormat;
    /** False means bypassed: excluded from the audio path entirely. */
    enabled: boolean;
    insertPoint: 'pre' | 'post';
    params: Record<string, number>;
    state?: unknown;
    wam?: { url: string; identifier: string; version?: string };
}

/** Normalise a stored plugin into its engine form, applying defaults. */
export function toPluginSpec(setting: PluginSetting): PluginSpec {
    return {
        instanceId: setting.id,
        pluginId: resolvePluginId(setting.pluginId),
        // Anything with a WAM URL is a WAM regardless of what was persisted.
        format: setting.format ?? (setting.wam ? 'wam' : 'builtin'),
        enabled: setting.enabled !== false,
        insertPoint: setting.insertPoint ?? 'pre',
        params: setting.params ?? {},
        state: setting.state,
        wam: setting.wam,
    };
}

/** Normalise a whole chain, dropping anything malformed. */
export function toPluginSpecs(settings: PluginSetting[] | undefined): PluginSpec[] {
    if (!settings) return [];
    return settings.filter(s => s && s.id).map(toPluginSpec);
}

/**
 * True when two specs describe the same processor configuration closely enough
 * that the existing audio node can be kept.
 *
 * Params and bypass are applied to a live node, so they do not force a rebuild;
 * changing which plugin a slot holds does.
 */
export function isSameProcessor(a: PluginSpec, b: PluginSpec): boolean {
    return a.instanceId === b.instanceId
        && a.pluginId === b.pluginId
        && a.format === b.format
        && a.wam?.url === b.wam?.url;
}
