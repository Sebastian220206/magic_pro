/**
 * EQPlugin — eight-band parametric equalizer.
 *
 * Was three fixed bands (low shelf, mid peak, high shelf) while the editor
 * above it drew eight and wrote `band1_freq`, `band1_gain`, `band1_q` … which
 * `setState` read none of: every one of those keys fell through the `if
 * (state.lowShelf)` chain and was dropped. Moving a band in the EQ changed
 * nothing you could hear, and the curve was drawn from
 * `getEQFrequencyResponse`, a stub returning an array of zeros.
 *
 * Signal flow:
 *
 *   in → inputGain → band 1 … band 8 → outputGain → makeup → wet ┐
 *      └──────────────────────────────────────────────── dry ────┴→ out
 *
 * Every band is a `BiquadFilterNode`, so the browser owns the filter maths and
 * `getFrequencyResponse` gives the real curve rather than a redrawing of it.
 */

// =============================================================================
// Types
// =============================================================================

/** The filter shapes the editor offers, in its own vocabulary. */
export type EQBandType =
    | 'lowcut'
    | 'lowshelf'
    | 'bell'
    | 'notch'
    | 'highshelf'
    | 'highcut';

/** Each shape's `BiquadFilterNode` type. */
const BIQUAD_TYPE: Readonly<Record<EQBandType, BiquadFilterType>> = {
    lowcut: 'highpass',
    lowshelf: 'lowshelf',
    bell: 'peaking',
    notch: 'notch',
    highshelf: 'highshelf',
    highcut: 'lowpass',
};

/** Shapes whose gain does nothing — a cut passes or stops, it does not boost. */
const USES_GAIN: Readonly<Record<EQBandType, boolean>> = {
    lowcut: false,
    lowshelf: true,
    bell: true,
    notch: false,
    highshelf: true,
    highcut: false,
};

export interface EQBandState {
    type: EQBandType;
    /** Hz. */
    frequency: number;
    /** dB, -24 to +24. Ignored by the cut and notch shapes. */
    gain: number;
    /** Quality factor, 0.1 to 18. */
    Q: number;
    enabled: boolean;
}

export interface EQState {
    bands: EQBandState[];
    /** dB of trim before the filters. */
    inputGain: number;
    /** dB of trim after them. */
    outputGain: number;
    /** 0-1. Below 1 the unfiltered signal is blended back in. */
    mix: number;
    /** Offset the output by the curve's average boost, so A/B stays level. */
    autoMakeup: boolean;
    bypass: boolean;
}

/** The three-band shape saved projects were written with. */
export interface LegacyEQBand { frequency: number; gain: number; Q: number }
export interface LegacyEQState {
    lowShelf?: LegacyEQBand;
    midPeak?: LegacyEQBand;
    highShelf?: LegacyEQBand;
}

export const EQ_BAND_COUNT = 8;

/**
 * The default curve: flat, with the bands spread over the spectrum.
 *
 * Frequencies are spaced roughly logarithmically so dragging a node lands
 * somewhere useful before it is moved, and the outer two are the cut shapes
 * an engineer reaches for first.
 */
export function defaultBands(): EQBandState[] {
    const spec: [EQBandType, number, number][] = [
        ['lowcut', 30, 0.7],
        ['lowshelf', 80, 0.7],
        ['bell', 200, 1.0],
        ['bell', 500, 1.0],
        ['bell', 1200, 1.0],
        ['bell', 3500, 1.0],
        ['highshelf', 8000, 0.7],
        ['highcut', 18000, 0.7],
    ];
    return spec.map(([type, frequency, Q]) => ({
        type, frequency, Q, gain: 0,
        // The two cut bands start off, so a fresh EQ is flat and silent about
        // it rather than quietly removing the top and bottom of the signal.
        enabled: type !== 'lowcut' && type !== 'highcut',
    }));
}

export function defaultEQState(): EQState {
    return {
        bands: defaultBands(),
        inputGain: 0,
        outputGain: 0,
        mix: 1,
        autoMakeup: false,
        bypass: false,
    };
}

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const dbToGain = (db: number) => Math.pow(10, db / 20);

// =============================================================================
// EQPlugin
// =============================================================================

export class EQPlugin {
    private ctx: AudioContext;

    private inputNode!: GainNode;
    private outputNode!: GainNode;
    private trimIn!: GainNode;
    private trimOut!: GainNode;
    private makeupNode!: GainNode;
    private wetNode!: GainNode;
    private dryNode!: GainNode;

    private filters: BiquadFilterNode[] = [];
    private state: EQState = defaultEQState();

    /** Ramp time for every parameter write, so nothing zippers. */
    private readonly SMOOTHING = 0.01;

    constructor(audioContext: AudioContext) {
        this.ctx = audioContext;
        this.build();
        this.applyAll();
    }

    // ── Graph ────────────────────────────────────────────────────────────────

    private build(): void {
        const ctx = this.ctx;
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();
        this.trimIn = ctx.createGain();
        this.trimOut = ctx.createGain();
        this.makeupNode = ctx.createGain();
        this.wetNode = ctx.createGain();
        this.dryNode = ctx.createGain();
        this.dryNode.gain.value = 0;

        // One filter per band, always present. A disabled band is set to a
        // shape that passes the signal untouched rather than being unlinked:
        // rebuilding the chain on every enable would click.
        for (let i = 0; i < EQ_BAND_COUNT; i++) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = 1000;
            filter.gain.value = 0;
            filter.Q.value = 1;
            this.filters.push(filter);
        }

        this.inputNode.connect(this.trimIn);
        let node: AudioNode = this.trimIn;
        for (const filter of this.filters) {
            node.connect(filter);
            node = filter;
        }
        node.connect(this.trimOut);
        this.trimOut.connect(this.makeupNode);
        this.makeupNode.connect(this.wetNode);
        this.wetNode.connect(this.outputNode);

        // The dry path taps ahead of the trim so Dry/Wet blends the signal as
        // it arrived, not a trimmed copy of it.
        this.inputNode.connect(this.dryNode);
        this.dryNode.connect(this.outputNode);
    }

    // ── Parameters ───────────────────────────────────────────────────────────

    private ramp(param: AudioParam, value: number): void {
        const now = this.ctx.currentTime;
        if (Number.isFinite(value)) param.setTargetAtTime(value, now, this.SMOOTHING);
    }

    private applyBand(index: number): void {
        const band = this.state.bands[index];
        const filter = this.filters[index];
        if (!band || !filter) return;

        if (!band.enabled) {
            // A flat bell is transparent, whatever its frequency and Q.
            filter.type = 'peaking';
            this.ramp(filter.gain, 0);
            return;
        }

        filter.type = BIQUAD_TYPE[band.type] ?? 'peaking';
        this.ramp(filter.frequency, clamp(band.frequency, 20, 20000));
        this.ramp(filter.Q, clamp(band.Q, 0.1, 18));
        this.ramp(filter.gain, USES_GAIN[band.type] ? clamp(band.gain, -24, 24) : 0);
    }

    private applyAll(): void {
        for (let i = 0; i < this.filters.length; i++) this.applyBand(i);
        this.applyGains();
    }

    private applyGains(): void {
        const bypassed = this.state.bypass;
        this.ramp(this.trimIn.gain, bypassed ? 1 : dbToGain(clamp(this.state.inputGain, -24, 24)));
        this.ramp(this.trimOut.gain, bypassed ? 1 : dbToGain(clamp(this.state.outputGain, -24, 24)));
        this.ramp(this.makeupNode.gain, this.state.autoMakeup && !bypassed ? this.makeupGain() : 1);

        // Bypass forces fully dry; otherwise the mix control decides.
        const wet = bypassed ? 0 : clamp(this.state.mix, 0, 1);
        this.ramp(this.wetNode.gain, wet);
        this.ramp(this.dryNode.gain, 1 - wet);
    }

    /**
     * Gain that cancels the curve's average boost.
     *
     * Measured off the filters themselves rather than guessed from the band
     * gains: a wide bell and a narrow one at the same gain do not add the same
     * loudness, and only the response knows the difference.
     */
    private makeupGain(): number {
        // Backed by a plain ArrayBuffer: `getFrequencyResponse` will not take
        // the SharedArrayBuffer form the default `Float32Array` type allows.
        const probe = new Float32Array(new ArrayBuffer(48 * 4));
        for (let i = 0; i < probe.length; i++) {
            // Log-spaced across the audible band.
            probe[i] = 20 * Math.pow(1000, i / (probe.length - 1));
        }
        const response = this.getFrequencyResponse(probe);
        let sum = 0;
        for (const db of response) sum += Number.isFinite(db) ? db : 0;
        const averageDb = sum / response.length;
        return dbToGain(clamp(-averageDb, -24, 24));
    }

    /**
     * Combined magnitude of every enabled band, in dB.
     *
     * This is what the editor draws. It used to draw a stub that returned
     * zeros, so the curve on screen had no relationship to the filters.
     */
    public getFrequencyResponse(frequencies: Float32Array<ArrayBuffer>): Float32Array {
        const out = new Float32Array(frequencies.length);
        const mag = new Float32Array(new ArrayBuffer(frequencies.length * 4));
        const phase = new Float32Array(new ArrayBuffer(frequencies.length * 4));

        for (let i = 0; i < this.filters.length; i++) {
            if (!this.state.bands[i]?.enabled) continue;
            this.filters[i].getFrequencyResponse(frequencies, mag, phase);
            for (let f = 0; f < out.length; f++) {
                // Magnitudes multiply, so their dB values add.
                out[f] += 20 * Math.log10(Math.max(mag[f], 1e-6));
            }
        }

        if (!this.state.bypass) {
            const trim = clamp(this.state.inputGain, -24, 24) + clamp(this.state.outputGain, -24, 24);
            for (let f = 0; f < out.length; f++) out[f] += trim;
        }
        return out;
    }

    // ── State ────────────────────────────────────────────────────────────────

    public setBypass(bypass: boolean): void {
        this.state.bypass = bypass;
        this.applyGains();
    }

    public getState(): EQState {
        return { ...this.state, bands: this.state.bands.map(b => ({ ...b })) };
    }

    /**
     * Accepts three shapes, because three exist in the wild.
     *
     * The editor writes flat `bandN_*` keys, since automation can only carry
     * numbers. Saved projects hold the old `{ lowShelf, midPeak, highShelf }`.
     * A structured `{ bands: [...] }` is what `getState` hands back.
     */
    public setState(state: Partial<EQState> & LegacyEQState & Record<string, unknown>): void {
        if (!state) return;

        if (Array.isArray(state.bands)) {
            state.bands.forEach((band, i) => {
                if (i < this.state.bands.length && band) {
                    this.state.bands[i] = { ...this.state.bands[i], ...band };
                }
            });
        }

        this.readFlatBands(state);
        this.readLegacyBands(state);

        if (typeof state.inputGain === 'number') this.state.inputGain = state.inputGain;
        if (typeof state.outputGain === 'number') this.state.outputGain = state.outputGain;
        if (typeof state.mix === 'number') this.state.mix = state.mix;
        if (state.autoMakeup !== undefined) this.state.autoMakeup = !!state.autoMakeup;
        if (state.bypass !== undefined) this.state.bypass = !!state.bypass;

        this.applyAll();
    }

    /** `band3_freq`, `band3_gain`, `band3_q`, `band3_type`, `band3_enabled`. */
    private readFlatBands(state: Record<string, unknown>): void {
        const TYPES: EQBandType[] = ['lowcut', 'lowshelf', 'bell', 'notch', 'highshelf', 'highcut'];
        for (let i = 0; i < this.state.bands.length; i++) {
            const prefix = `band${i + 1}`;
            const band = this.state.bands[i];
            const freq = state[`${prefix}_freq`];
            const gain = state[`${prefix}_gain`];
            const q = state[`${prefix}_q`];
            const type = state[`${prefix}_type`];
            const enabled = state[`${prefix}_enabled`];

            if (typeof freq === 'number') band.frequency = freq;
            if (typeof gain === 'number') band.gain = gain;
            if (typeof q === 'number') band.Q = q;
            if (typeof enabled === 'number') band.enabled = enabled !== 0;
            else if (typeof enabled === 'boolean') band.enabled = enabled;
            // Type arrives as an index from automation, or as its name from a
            // saved project.
            if (typeof type === 'number') band.type = TYPES[Math.round(type)] ?? band.type;
            else if (typeof type === 'string' && TYPES.includes(type as EQBandType)) {
                band.type = type as EQBandType;
            }
        }
        if (typeof state.master_gain === 'number') this.state.outputGain = state.master_gain;
    }

    /**
     * The three-band state this plugin used to have.
     *
     * Mapped onto bands 2, 4 and 7 — the low shelf, a mid bell and the high
     * shelf — so a project saved against the old EQ opens sounding the same.
     */
    private readLegacyBands(state: LegacyEQState): void {
        const map: [LegacyEQBand | undefined, number, EQBandType][] = [
            [state.lowShelf, 1, 'lowshelf'],
            [state.midPeak, 3, 'bell'],
            [state.highShelf, 6, 'highshelf'],
        ];
        for (const [legacy, index, type] of map) {
            if (!legacy) continue;
            const band = this.state.bands[index];
            band.type = type;
            band.enabled = true;
            if (typeof legacy.frequency === 'number') band.frequency = legacy.frequency;
            if (typeof legacy.gain === 'number') band.gain = legacy.gain;
            if (typeof legacy.Q === 'number') band.Q = legacy.Q;
        }
    }

    // ── Connections ──────────────────────────────────────────────────────────

    public get input(): AudioNode { return this.inputNode; }
    public get output(): AudioNode { return this.outputNode; }

    public connect(destination: AudioNode): void {
        this.outputNode.connect(destination);
    }

    public disconnect(destination?: AudioNode): void {
        // Never a bare disconnect: that drops every edge from the node, not
        // just this one, which has silenced the master here before.
        if (destination) this.outputNode.disconnect(destination);
        else this.outputNode.disconnect();
    }

    public dispose(): void {
        this.inputNode.disconnect();
        this.trimIn.disconnect();
        for (const filter of this.filters) filter.disconnect();
        this.trimOut.disconnect();
        this.makeupNode.disconnect();
        this.wetNode.disconnect();
        this.dryNode.disconnect();
        this.outputNode.disconnect();
        this.filters = [];
    }
}

export function createEQPlugin(audioContext: AudioContext): EQPlugin {
    return new EQPlugin(audioContext);
}
