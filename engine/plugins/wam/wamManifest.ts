/**
 * wamManifest.ts
 * Describe a Web Audio Module the way the plugin host describes a built-in.
 *
 * A WAM reports its controls through `WamNode.getParameterInfo()`, which is the
 * same information a `PluginManifest` carries in a different shape. Translating
 * it lets `AutoGenPluginUI` draw real controls for a plugin that ships no GUI of
 * its own — the fallback `WamGuiMount` has always promised in its comments but
 * never had anything to fall back *to*.
 */

import type { ParamType, PluginManifest, PluginParameter } from '../manifest';
import type { WamParameterInfoLike } from './wamLoader';

/** WAM parameter kinds, mapped onto the manifest's own vocabulary. */
function paramType(info: WamParameterInfoLike): ParamType {
    switch (info.type) {
        case 'boolean': return 'boolean';
        case 'choice': return 'enum';
        case 'int': return 'int';
        default: return 'float';
    }
}

/**
 * A slider step fine enough for the parameter's range.
 *
 * WAM floats are frequently normalised to 0–1, where `AutoGenPluginUI`'s 0.1
 * default would give a knob ten usable positions.
 */
function paramStep(info: WamParameterInfoLike, type: ParamType): number {
    if (type === 'int' || type === 'boolean') return 1;
    const span = info.maxValue - info.minValue;
    return Number.isFinite(span) && span > 0 ? span / 100 : 0.01;
}

/** Build a manifest for a live WAM from the parameters it reports. */
export function wamManifest(
    id: string,
    name: string,
    info: Record<string, WamParameterInfoLike>,
): PluginManifest {
    const parameters: PluginParameter[] = Object.values(info ?? {}).map(p => {
        const type = paramType(p);
        return {
            id: p.id,
            name: p.label || p.id,
            type,
            defaultValue: p.defaultValue,
            minValue: p.minValue,
            maxValue: p.maxValue,
            step: paramStep(p, type),
            unit: p.units,
            automatable: true,
            enumValues: p.choices,
        };
    });

    return {
        manifestVersion: 1,
        id,
        name,
        // Shown as a badge beside the name; a WAM does not report its version
        // through the parameter interface, so label what it is instead.
        version: 'WAM',
        type: 'effect',
        category: 'Web Audio Module',
        parameters,
        audioIO: { numInputs: 1, numOutputs: 1, supportsMidi: false },
    };
}
