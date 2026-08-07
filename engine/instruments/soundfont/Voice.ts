import {
    ADSREnvelopeParams, envelopeLevelAt, releaseLevelAfter, scheduleAttack, scheduleRelease,
} from './ADSREnvelope';

export enum VoiceState {
    Idle = 'idle',
    Playing = 'playing',
    Release = 'release',
    Done = 'done',
}

export interface VoiceOptions {
    destination: AudioNode;
    sampleData: AudioBuffer;
    playbackRate: number;
    gain: number;
    pan?: number;
    adsr: ADSREnvelopeParams;
    loopStart?: number;
    loopEnd?: number;
    sampleOffset?: number;
}

export class Voice {
    state: VoiceState = VoiceState.Idle;
    note: number = -1;
    velocity: number = 0;
    outputNode: GainNode;
    panNode: StereoPannerNode | null = null;
    sourceNode: AudioBufferSourceNode | null = null;
    filterNode: BiquadFilterNode | null = null;

    private ctx: AudioContext | OfflineAudioContext;
    private destination!: AudioNode;
    private adsr!: ADSREnvelopeParams;
    /** Absolute AudioContext time this voice's envelope starts. */
    private noteOnTime: number = 0;
    /** Absolute AudioContext time this voice goes silent, once released. */
    private silentAt: number = 0;
    /** Where the release ramp starts, so a choke can pick up mid-fade. */
    private releaseStartedAt: number = 0;
    private releaseStartLevel: number = 0;
    private peakGain: number = 1;
    private _hasSustain: boolean = false;

    constructor(ctx: AudioContext | OfflineAudioContext) {
        this.ctx = ctx;
        this.outputNode = ctx.createGain();
        this.outputNode.gain.value = 0;
    }

    get hasSustain(): boolean {
        return this._hasSustain;
    }

    /**
     * Start this voice.
     *
     * `when` is an **absolute AudioContext time**, matching what the sequencer
     * computes and what `AudioEngineAdapter.scheduleNote` passes down; 0 means
     * "now". It used to be treated as a delay to add to `currentTime`, so a
     * sequenced note-off at absolute time 1234 was scheduled 1234 seconds into
     * the future and the note simply never stopped.
     */
    start(options: VoiceOptions, when: number = 0) {
        this.teardown();
        this.silentAt = 0;
        this.releaseStartedAt = 0;
        this.releaseStartLevel = 0;

        this.adsr = options.adsr;
        this.state = VoiceState.Playing;
        this.destination = options.destination;

        const startAt = when > 0 ? when : this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        source.buffer = options.sampleData;
        source.playbackRate.value = options.playbackRate;

        const looping = options.loopEnd !== undefined
            && options.loopStart !== undefined
            && options.loopEnd > options.loopStart;
        if (looping) {
            source.loop = true;
            source.loopStart = options.loopStart!;
            source.loopEnd = options.loopEnd!;
        }
        this._hasSustain = looping;

        let chain: AudioNode = source;
        if (options.pan !== undefined && options.pan !== 0) {
            this.panNode = this.ctx.createStereoPanner();
            this.panNode.pan.value = options.pan;
            chain.connect(this.panNode);
            chain = this.panNode;
        }

        this.outputNode.gain.value = 0;
        chain.connect(this.outputNode);
        this.outputNode.connect(this.destination ?? this.ctx.destination);

        source.start(startAt, options.sampleOffset ?? 0);

        this.sourceNode = source;
        this.noteOnTime = startAt;
        this.peakGain = options.gain * (this.velocity / 127);

        scheduleAttack(this.outputNode, this.adsr, this.peakGain, startAt);

        if (!looping) {
            source.onended = () => {
                if (this.state === VoiceState.Playing || this.state === VoiceState.Release) {
                    this.state = VoiceState.Done;
                }
            };
        }
    }

    /**
     * Release this voice. `when` is an absolute AudioContext time; 0 means now.
     */
    release(when: number = 0) {
        if (this.state !== VoiceState.Playing) return;
        if (!this.sourceNode) return;
        this.state = VoiceState.Release;

        const now = this.ctx.currentTime;
        const releaseAt = Math.max(when > 0 ? when : now, this.noteOnTime, now);

        this.releaseStartedAt = releaseAt;
        this.releaseStartLevel = envelopeLevelAt(
            this.adsr, this.peakGain, this.noteOnTime, releaseAt);
        this.silentAt = scheduleRelease(
            this.outputNode, this.adsr, this.peakGain, this.noteOnTime, releaseAt, now,
        );

        // Stop the source once the release has finished. A looping source would
        // otherwise run forever, and even a one-shot holds its node alive until
        // the buffer ends.
        try {
            this.sourceNode.stop(this.silentAt);
        } catch {
            // Already stopped, or the context is closed.
        }
    }

    /** Absolute time this voice finishes, or 0 while it is still held. */
    get releaseEndTime(): number {
        return this.silentAt;
    }

    /** Absolute time this voice's envelope starts. */
    get startTime(): number {
        return this.noteOnTime;
    }

    /**
     * This voice's gain at absolute time `at`, on whichever envelope stage is
     * running — the attack/decay curve, or the release ramp if one is already
     * scheduled. Computed rather than read from `gain.value`, which only ever
     * reports the level *now*.
     */
    private levelAt(at: number): number {
        if (this.state === VoiceState.Release && this.silentAt > 0) {
            if (at >= this.silentAt) return 0;
            return releaseLevelAfter(this.adsr, this.releaseStartLevel, at - this.releaseStartedAt);
        }
        return envelopeLevelAt(this.adsr, this.peakGain, this.noteOnTime, at);
    }

    /**
     * Cut this voice short for an SF2 exclusive class — a closed hi-hat
     * silencing the open one. Ramps over a few milliseconds rather than
     * stopping dead, which would click on every hat.
     */
    choke(when: number = 0, fadeSeconds: number = 0.008) {
        if (this.state !== VoiceState.Playing && this.state !== VoiceState.Release) return;
        if (!this.sourceNode) return;

        const now = this.ctx.currentTime;
        const at = Math.max(when > 0 ? when : now, now, this.noteOnTime);
        const end = at + fadeSeconds;

        const level = this.levelAt(at);

        const gain = this.outputNode.gain;
        gain.cancelScheduledValues(at);
        gain.setValueAtTime(level, at);
        gain.linearRampToValueAtTime(0, end);

        this.state = VoiceState.Release;
        this.silentAt = end;
        try {
            this.sourceNode.stop(end);
        } catch {
            // Already stopped.
        }
    }

    stop() {
        this.teardown();
        this.note = -1;
        this.velocity = 0;
        this.noteOnTime = 0;
        this.silentAt = 0;
        this.releaseStartedAt = 0;
        this.releaseStartLevel = 0;
        this.state = VoiceState.Done;
    }

    /**
     * Drop this voice's audio nodes.
     *
     * Deliberately leaves `note` and `velocity` alone: callers set those on the
     * voice *before* calling `start`, and clearing them here left every voice
     * reporting note −1. `findVoicesForNote` then matched nothing, so note-off
     * was a no-op and every note rang until its buffer or loop ended — and the
     * peak gain, derived from `velocity`, came out 0.
     */
    private teardown() {
        if (this.sourceNode) {
            this.sourceNode.onended = null;
            try {
                this.sourceNode.stop();
            } catch (_) { }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        if (this.panNode) {
            this.panNode.disconnect();
            this.panNode = null;
        }
        if (this.filterNode) {
            this.filterNode.disconnect();
            this.filterNode = null;
        }
        this.outputNode.gain.cancelScheduledValues(0);
        this.outputNode.gain.value = 0;
        this.outputNode.disconnect();
    }

    dispose() {
        this.stop();
        this.state = VoiceState.Idle;
        this.outputNode.disconnect();
    }
}
