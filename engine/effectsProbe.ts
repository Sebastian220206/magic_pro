/**
 * effectsProbe.ts
 * Render a test signal through each built-in effect and report what came out.
 *
 * The effects in `engine/effects/plugins/` are reachable — `routingEngine`
 * builds them through `processorFactory` — but nothing had ever confirmed they
 * pass audio, and this codebase has a long history of signal paths that report
 * success while producing silence. Counting nodes proves scheduling, not sound;
 * only a rendered buffer does.
 *
 * Runs offline, so it needs no output device and no user gesture, and is
 * deterministic enough to assert on.
 */

import { createProcessor } from './plugins/processorFactory';
import { BUILTIN_PLUGIN_IDS, BUILTIN_PLUGIN_NAMES } from './plugins/pluginIds';
import type { PluginSpec } from './plugins/pluginSpec';

export interface EffectProbeResult {
    pluginId: string;
    name: string;
    /** The factory returned a processor rather than null. */
    built: boolean;
    /** Peak sample of the processed render, 0–1. */
    peak: number;
    /** Anything audible came out at all. */
    passesAudio: boolean;
    /**
     * The output measurably differs from the input.
     *
     * A processor that is wired but does nothing — a graph whose input reaches
     * its output untouched — reads as working on peak alone. This is what
     * separates "connected" from "processing".
     */
    changesSignal: boolean;
    /** RMS difference from the dry reference, for the report. */
    difference: number;
    error?: string;
}

/** Silence is anything below about -60 dBFS. */
const AUDIBLE = 0.001;
/** Below this the two renders are the same signal for our purposes. */
const DIFFERENT = 0.0005;

/**
 * A signal every kind of effect has something to bite on.
 *
 * A pure tone tells an EQ nothing outside its band and gives a compressor no
 * transient, so this is a decaying broadband click train under a sustained
 * tone: transients for the dynamics processors, spectrum for the filters, and
 * gaps for a reverb tail to show up in.
 */
function fillTestSignal(buffer: AudioBuffer): void {
    const rate = buffer.sampleRate;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        let seed = 12345 + c * 777;
        for (let i = 0; i < data.length; i++) {
            // Deterministic pseudo-noise, so two runs are comparable.
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const noise = (seed / 0x7fffffff) * 2 - 1;

            const t = i / rate;
            const tone = Math.sin(2 * Math.PI * 220 * t) * 0.3;
            // A click every 250 ms, decaying over 30 ms.
            const sinceClick = t % 0.25;
            const click = sinceClick < 0.03 ? noise * Math.exp(-sinceClick * 120) * 0.7 : 0;

            data[i] = Math.max(-1, Math.min(1, tone + click + noise * 0.02));
        }
    }
}

function peakOf(buffer: AudioBuffer): number {
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) {
            const value = Math.abs(data[i]);
            if (value > peak) peak = value;
        }
    }
    return peak;
}

/** RMS of the sample-by-sample difference between two renders. */
function rmsDifference(a: AudioBuffer, b: AudioBuffer): number {
    const channels = Math.min(a.numberOfChannels, b.numberOfChannels);
    const length = Math.min(a.length, b.length);
    let sum = 0;
    let count = 0;
    for (let c = 0; c < channels; c++) {
        const left = a.getChannelData(c);
        const right = b.getChannelData(c);
        for (let i = 0; i < length; i++) {
            const d = left[i] - right[i];
            sum += d * d;
            count++;
        }
    }
    return count > 0 ? Math.sqrt(sum / count) : 0;
}

/** Render the test signal, optionally through a processor. */
async function render(spec: PluginSpec | null, seconds = 1.5, rate = 48000): Promise<AudioBuffer> {
    const ctx = new OfflineAudioContext(2, Math.round(seconds * rate), rate);

    const source = ctx.createBufferSource();
    const input = ctx.createBuffer(2, Math.round(seconds * rate), rate);
    fillTestSignal(input);
    source.buffer = input;

    if (spec) {
        const processor = await createProcessor(ctx, spec);
        if (!processor) throw new Error('createProcessor returned null');
        source.connect(processor.input);
        processor.output.connect(ctx.destination);
    } else {
        source.connect(ctx.destination);
    }

    source.start(0);
    return ctx.startRendering();
}

/** Every built-in the factory claims it can build, with sensible params. */
const PROBE_SPECS: { pluginId: string; params: Record<string, unknown> }[] = [
    { pluginId: BUILTIN_PLUGIN_IDS.eq, params: { lowShelf: { frequency: 100, gain: 12, q: 0.7 } } },
    { pluginId: BUILTIN_PLUGIN_IDS.compressor, params: { threshold: -30, ratio: 8, attack: 0.003, release: 0.1 } },
    { pluginId: BUILTIN_PLUGIN_IDS.reverb, params: { mix: 0.8, decay: 2, damping: 0.4 } },
    { pluginId: BUILTIN_PLUGIN_IDS.delay, params: { timeL: 0.2, timeR: 0.3, feedback: 0.5, mix: 0.7 } },
    { pluginId: BUILTIN_PLUGIN_IDS.limiter, params: { ceiling: -6, release: 0.05, lookahead: 1 } },
    { pluginId: BUILTIN_PLUGIN_IDS.sidechainCompressor, params: { threshold: -30, ratio: 8 } },
];

/**
 * Measure every built-in effect.
 *
 * Returns one row per effect rather than throwing, so one broken processor does
 * not hide the state of the others.
 */
export async function probeBuiltinEffects(): Promise<EffectProbeResult[]> {
    const dry = await render(null);
    const dryPeak = peakOf(dry);
    const results: EffectProbeResult[] = [];

    for (const { pluginId, params } of PROBE_SPECS) {
        const name = BUILTIN_PLUGIN_NAMES[pluginId] ?? pluginId;
        try {
            const wet = await render({
                pluginId,
                format: 'builtin',
                params: params as Record<string, number>,
            } as PluginSpec);

            const peak = peakOf(wet);
            const difference = rmsDifference(dry, wet);
            results.push({
                pluginId,
                name,
                built: true,
                peak,
                passesAudio: peak > AUDIBLE,
                changesSignal: difference > DIFFERENT,
                difference,
            });
        } catch (error) {
            results.push({
                pluginId,
                name,
                built: false,
                peak: 0,
                passesAudio: false,
                changesSignal: false,
                difference: 0,
                error: String((error as Error)?.message ?? error),
            });
        }
    }

    // The dry reference is reported too: if it is silent the harness itself is
    // broken and every "does not pass audio" below would be meaningless.
    results.unshift({
        pluginId: '(dry reference)',
        name: 'No effect',
        built: true,
        peak: dryPeak,
        passesAudio: dryPeak > AUDIBLE,
        changesSignal: false,
        difference: 0,
    });

    return results;
}
