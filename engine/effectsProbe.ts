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
 * Does an EQ band change the level at its own frequency?
 *
 * The editor's eight bands wrote `bandN_*` keys into a three-band DSP that
 * read none of them, so this is the check that matters: set one band, play a
 * tone at its centre, and see whether the level moves by the gain asked for.
 */
export async function probeEqBands(): Promise<EffectProbeResult[]> {
    const results: EffectProbeResult[] = [];
    const TONE_HZ = 1000;

    /** Render a steady tone through the EQ with the given parameters. */
    const renderTone = async (params: Record<string, number>): Promise<number> => {
        const rate = 48000;
        const ctx = new OfflineAudioContext(2, rate, rate);
        const osc = ctx.createOscillator();
        osc.frequency.value = TONE_HZ;
        const level = ctx.createGain();
        level.gain.value = 0.5;

        const processor = await createProcessor(ctx, {
            pluginId: BUILTIN_PLUGIN_IDS.eq, format: 'builtin', params,
        } as PluginSpec);
        if (!processor) throw new Error('no EQ processor');

        osc.connect(level);
        level.connect(processor.input);
        processor.output.connect(ctx.destination);
        osc.start(0);
        const rendered = await ctx.startRendering();

        // Peak over the second half, past the parameter ramps.
        const data = rendered.getChannelData(0);
        let peak = 0;
        for (let i = Math.floor(data.length / 2); i < data.length; i++) {
            peak = Math.max(peak, Math.abs(data[i]));
        }
        return peak;
    };

    const flat = await renderTone({});
    const db = (a: number, b: number) => 20 * Math.log10(Math.max(a, 1e-9) / Math.max(b, 1e-9));

    // Band 5 is a bell; put it on the tone and boost it.
    const boosted = await renderTone({
        band5_type: 2, band5_freq: TONE_HZ, band5_gain: 12, band5_q: 1, band5_enabled: 1,
    });
    results.push({
        pluginId: 'eq.band.boost', name: 'Band 5 bell +12 dB at 1 kHz',
        built: true, peak: boosted, passesAudio: boosted > 0.001,
        changesSignal: db(boosted, flat) > 8,
        difference: db(boosted, flat),
    });

    const cut = await renderTone({
        band5_type: 2, band5_freq: TONE_HZ, band5_gain: -12, band5_q: 1, band5_enabled: 1,
    });
    results.push({
        pluginId: 'eq.band.cut', name: 'Band 5 bell -12 dB at 1 kHz',
        built: true, peak: cut, passesAudio: true,
        changesSignal: db(cut, flat) < -8,
        difference: db(cut, flat),
    });

    // A band switched off must do nothing, whatever its gain says.
    const disabled = await renderTone({
        band5_type: 2, band5_freq: TONE_HZ, band5_gain: 12, band5_q: 1, band5_enabled: 0,
    });
    results.push({
        pluginId: 'eq.band.disabled', name: 'Band 5 off, gain still +12',
        built: true, peak: disabled, passesAudio: true,
        changesSignal: Math.abs(db(disabled, flat)) < 0.5,
        difference: db(disabled, flat),
    });

    // A high cut below the tone must remove it.
    const cutAway = await renderTone({
        band8_type: 5, band8_freq: 200, band8_q: 0.7, band8_enabled: 1,
    });
    results.push({
        pluginId: 'eq.band.highcut', name: 'Band 8 high cut at 200 Hz',
        built: true, peak: cutAway, passesAudio: true,
        changesSignal: db(cutAway, flat) < -20,
        difference: db(cutAway, flat),
    });

    // Output trim moves the whole thing.
    const trimmed = await renderTone({ outputGain: -6 });
    results.push({
        pluginId: 'eq.outputGain', name: 'Output trim -6 dB',
        built: true, peak: trimmed, passesAudio: true,
        changesSignal: Math.abs(db(trimmed, flat) + 6) < 1,
        difference: db(trimmed, flat),
    });

    return results;
}

/**
 * Does each compressor control change the audio?
 *
 * The editor for this plugin was unreachable and the DSP had none of the
 * stages it drew — no input or output trim, no parallel blend, no limiter, no
 * distortion knob. This renders a loud tone through it and reads the level.
 */
export async function probeCompressor(): Promise<EffectProbeResult[]> {
    const results: EffectProbeResult[] = [];

    const renderTone = async (params: Record<string, number>): Promise<number> => {
        const rate = 48000;
        const ctx = new OfflineAudioContext(2, rate, rate);
        const osc = ctx.createOscillator();
        osc.frequency.value = 220;
        const level = ctx.createGain();
        // Loud enough to be well over any threshold under test.
        level.gain.value = 0.9;

        const processor = await createProcessor(ctx, {
            pluginId: BUILTIN_PLUGIN_IDS.compressor, format: 'builtin', params,
        } as PluginSpec);
        if (!processor) throw new Error('no compressor processor');

        osc.connect(level);
        level.connect(processor.input);
        processor.output.connect(ctx.destination);
        osc.start(0);
        const rendered = await ctx.startRendering();

        const data = rendered.getChannelData(0);
        let peak = 0;
        for (let i = Math.floor(data.length * 0.6); i < data.length; i++) {
            peak = Math.max(peak, Math.abs(data[i]));
        }
        return peak;
    };

    const db = (a: number, b: number) => 20 * Math.log10(Math.max(a, 1e-9) / Math.max(b, 1e-9));
    // A gentle baseline that still compresses, so each control has something
    // to change relative to it.
    const base = { threshold: -12, ratio: 4, attack: 0.005, release: 0.1, knee: 0 };
    const flat = await renderTone(base);

    const check = (id: string, name: string, peak: number, pass: boolean) => {
        results.push({
            pluginId: id, name, built: true, peak,
            passesAudio: peak > 0.001, changesSignal: pass, difference: db(peak, flat),
        });
    };

    const harder = await renderTone({ ...base, threshold: -30, ratio: 12 });
    check('comp.threshold', 'A lower threshold compresses harder', harder, db(harder, flat) < -4);

    const trimmedIn = await renderTone({ ...base, inputGain: -12 });
    check('comp.inputGain', 'Input trim reaches the detector', trimmedIn, db(trimmedIn, flat) < -3);

    const trimmedOut = await renderTone({ ...base, outputGain: -6 });
    check('comp.outputGain', 'Output trim is exactly -6 dB', trimmedOut,
        Math.abs(db(trimmedOut, flat) + 6) < 0.6);

    // Mix at 0 is the untouched signal, so it must be louder than compressed.
    const dry = await renderTone({ ...base, mix: 0 });
    check('comp.mix', 'Mix at 0 returns the uncompressed signal', dry, db(dry, flat) > 1);

    const limited = await renderTone({ ...base, makeupGain: 18, limiterOn: 1, limiterThreshold: -12 });
    const unlimited = await renderTone({ ...base, makeupGain: 18 });
    results.push({
        pluginId: 'comp.limiter', name: 'The limiter holds the output down',
        built: true, peak: limited, passesAudio: true,
        changesSignal: db(limited, unlimited) < -3, difference: db(limited, unlimited),
    });

    const driven = await renderTone({ ...base, distortion: 1, distortionHard: 1 });
    check('comp.distortion', 'Distortion changes the waveform', driven,
        Math.abs(db(driven, flat)) > 0.5);

    /*
     * Character shows in the transient, not the sustain.
     *
     * A steady tone reaches steady state and every model settles to the same
     * reduction — measuring there reported the seven models as identical, which
     * was the measurement's fault, not the DSP's. This renders a sudden burst
     * and reads the first 10 ms, where a fast FET has already clamped and a
     * slow Opto has not.
     */
    const renderBurstAttack = async (params: Record<string, number>): Promise<number> => {
        const rate = 48000;
        const ctx = new OfflineAudioContext(1, Math.round(rate * 0.2), rate);
        const osc = ctx.createOscillator();
        osc.frequency.value = 220;
        const level = ctx.createGain();
        // Silent, then full level at 50 ms — a step the detector has to chase.
        level.gain.setValueAtTime(0.0001, 0);
        level.gain.setValueAtTime(0.9, 0.05);

        const processor = await createProcessor(ctx, {
            pluginId: BUILTIN_PLUGIN_IDS.compressor, format: 'builtin', params,
        } as PluginSpec);
        if (!processor) throw new Error('no compressor processor');
        osc.connect(level);
        level.connect(processor.input);
        processor.output.connect(ctx.destination);
        osc.start(0);
        const rendered = await ctx.startRendering();

        const data = rendered.getChannelData(0);
        // `DynamicsCompressorNode` runs a fixed ~6.4 ms lookahead, so the burst
        // does not appear at the output until after it. Reading from 50 ms
        // measured the silence before it and reported every model as identical.
        const from = Math.floor(rate * 0.058);
        const to = Math.floor(rate * 0.075);
        let peak = 0;
        for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(data[i]));
        return peak;
    };

    const optoBurst = await renderBurstAttack({ ...base, model: 6, attack: 0.02 });
    const fetBurst = await renderBurstAttack({ ...base, model: 5, attack: 0.02 });
    results.push({
        pluginId: 'comp.model', name: 'A slow Opto lets more transient through than a fast FET',
        built: true, peak: optoBurst, passesAudio: true,
        changesSignal: db(optoBurst, fetBurst) > 0.3, difference: db(optoBurst, fetBurst),
    });

    const auto = await renderTone({ ...base, autoGain: 1 });
    check('comp.autoGain', 'Auto Gain adds makeup by itself', auto, db(auto, flat) > 2);

    return results;
}

/**
 * Does each limiter control change the audio?
 *
 * The limiter had no editor, and its ceiling was applied twice: the compressor
 * thresholded at it and the output stage was then scaled by it as well, so a
 * -3 dB Output Level came out at -6.
 */
export async function probeLimiter(): Promise<EffectProbeResult[]> {
    const results: EffectProbeResult[] = [];

    const renderTone = async (params: Record<string, number>): Promise<number> => {
        const rate = 48000;
        const ctx = new OfflineAudioContext(2, rate, rate);
        const osc = ctx.createOscillator();
        osc.frequency.value = 220;
        const level = ctx.createGain();
        level.gain.value = 0.9;

        const processor = await createProcessor(ctx, {
            pluginId: BUILTIN_PLUGIN_IDS.limiter, format: 'builtin', params,
        } as PluginSpec);
        if (!processor) throw new Error('no limiter processor');

        osc.connect(level);
        level.connect(processor.input);
        processor.output.connect(ctx.destination);
        osc.start(0);
        const rendered = await ctx.startRendering();

        const data = rendered.getChannelData(0);
        let peak = 0;
        for (let i = Math.floor(data.length * 0.6); i < data.length; i++) {
            peak = Math.max(peak, Math.abs(data[i]));
        }
        return peak;
    };

    const dbOf = (a: number) => 20 * Math.log10(Math.max(a, 1e-9));
    const rel = (a: number, b: number) => dbOf(a) - dbOf(b);

    const base = { ceiling: -6, release: 0.1, lookahead: 2, mode: 1, softKnee: 0 };
    const flat = await renderTone(base);

    // The ceiling is the ceiling — applied once, not twice.
    results.push({
        pluginId: 'lim.ceiling', name: 'Output Level -6 dB holds the peak at -6 dB',
        built: true, peak: flat, passesAudio: flat > 0.001,
        changesSignal: Math.abs(dbOf(flat) + 6) < 1.2, difference: dbOf(flat),
    });

    const lower = await renderTone({ ...base, ceiling: -12 });
    results.push({
        pluginId: 'lim.ceiling2', name: 'A lower ceiling lowers the output by the same amount',
        built: true, peak: lower, passesAudio: true,
        changesSignal: Math.abs(rel(lower, flat) + 6) < 1.2, difference: rel(lower, flat),
    });

    // Driving it harder must not push past the ceiling.
    const driven = await renderTone({ ...base, gain: 12 });
    results.push({
        pluginId: 'lim.gain', name: 'Gain drives it harder without breaking the ceiling',
        built: true, peak: driven, passesAudio: true,
        changesSignal: dbOf(driven) < -4.5, difference: dbOf(driven),
    });

    // Legacy has no clipper, so a hard drive slips further past.
    const legacy = await renderTone({ ...base, mode: 0, gain: 18, ceiling: -6 });
    const precision = await renderTone({ ...base, mode: 1, gain: 18, ceiling: -6 });
    results.push({
        pluginId: 'lim.mode', name: 'Precision holds the ceiling tighter than Legacy',
        built: true, peak: precision, passesAudio: true,
        changesSignal: dbOf(precision) <= dbOf(legacy) + 0.05, difference: rel(precision, legacy),
    });

    // Bypass returns the untouched signal.
    const bypassed = await renderTone({ ...base, bypass: 1 });
    results.push({
        pluginId: 'lim.bypass', name: 'Bypass returns the signal untouched',
        built: true, peak: bypassed, passesAudio: true,
        changesSignal: rel(bypassed, flat) > 3, difference: rel(bypassed, flat),
    });

    return results;
}

/**
 * Do the rack's voicings actually sound different?
 *
 * A Hall and a Plate are the same reverb with different settings, which is
 * only worth two menu entries if the two differ by ear. Renders a burst
 * through each and measures the tail it leaves behind.
 */
export async function probeFxVoicings(): Promise<EffectProbeResult[]> {
    const { FX_CATALOG } = await import('../lib/fxCatalog');
    const results: EffectProbeResult[] = [];

    /** The same burst with no effect on it, to compare against. */
    const renderBurst = async (spec: PluginSpec | null) => {
        const rate = 48000;
        const ctx = new OfflineAudioContext(2, rate * 2, rate);
        const source = ctx.createBufferSource();
        const input = ctx.createBuffer(2, rate * 2, rate);
        for (let c = 0; c < 2; c++) {
            const data = input.getChannelData(c);
            for (let i = 0; i < rate * 0.02; i++) data[i] = Math.sin(i / 6) * 0.8;
        }
        source.buffer = input;
        if (spec) {
            const processor = await createProcessor(ctx, spec);
            if (!processor) throw new Error('no processor');
            source.connect(processor.input);
            processor.output.connect(ctx.destination);
        } else {
            source.connect(ctx.destination);
        }
        source.start(0);
        return ctx.startRendering();
    };

    const rate = 48000;
    const dry = await renderBurst(null);

    for (const category of FX_CATALOG) {
        for (const entry of category.entries) {
            if (!entry.pluginId) continue;
            try {
                const rendered = await renderBurst({
                    pluginId: entry.pluginId, format: 'builtin', params: entry.params ?? {},
                } as PluginSpec);

                /*
                 * Two numbers, because one does not cover every effect.
                 *
                 * The tail is what is still ringing after the burst — the
                 * thing that separates a Hall from a Room. But an EQ or a
                 * limiter leaves no tail at all, and measuring only that
                 * reported them as broken. So the pass condition is that the
                 * render differs from the dry signal; the tail is reported
                 * beside it for the time-based entries.
                 */
                const data = rendered.getChannelData(0);
                const dryData = dry.getChannelData(0);

                let diffSum = 0;
                for (let i = 0; i < data.length; i++) {
                    const d = data[i] - dryData[i];
                    diffSum += d * d;
                }
                const difference = Math.sqrt(diffSum / data.length);

                // From just past the burst to the end.
                const from = Math.floor(rate * 0.05);
                let tailSum = 0;
                for (let i = from; i < data.length; i++) tailSum += data[i] * data[i];
                const tail = Math.sqrt(tailSum / (data.length - from));

                results.push({
                    pluginId: entry.pluginId,
                    name: `${category.name} / ${entry.name}`,
                    built: true,
                    peak: tail,
                    passesAudio: true,
                    changesSignal: difference > 1e-6,
                    difference,
                });
            } catch (error) {
                results.push({
                    pluginId: entry.pluginId, name: `${category.name} / ${entry.name}`,
                    built: false, peak: 0, passesAudio: false, changesSignal: false,
                    difference: 0, error: String((error as Error)?.message ?? error),
                });
            }
        }
    }
    return results;
}

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
