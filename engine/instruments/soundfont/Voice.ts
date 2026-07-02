import { ADSREnvelopeParams, scheduleADSR } from './ADSREnvelope';

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
    private noteOnTime: number = 0;
    private noteOffTime: number = 0;
    private _hasSustain: boolean = false;

    constructor(ctx: AudioContext | OfflineAudioContext) {
        this.ctx = ctx;
        this.outputNode = ctx.createGain();
        this.outputNode.gain.value = 0;
    }

    get hasSustain(): boolean {
        return this._hasSustain;
    }

    start(options: VoiceOptions, noteOnDelay: number = 0) {
        this.cleanup();

        this.adsr = options.adsr;
        this._hasSustain = (options.loopEnd ?? 0) > (options.loopStart ?? 0);
        this.state = VoiceState.Playing;

        const source = this.ctx.createBufferSource();
        source.buffer = options.sampleData;
        source.playbackRate.value = options.playbackRate;

        if (options.loopEnd && options.loopStart && options.loopEnd > options.loopStart) {
            source.loop = true;
            source.loopStart = options.loopStart;
            source.loopEnd = options.loopEnd;
        }

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

        const totalDuration = options.sampleData.duration;
        const sampleOffset = options.sampleOffset ?? 0;

        if (source.loop) {
            source.start(noteOnDelay > 0 ? this.ctx.currentTime + noteOnDelay : 0, sampleOffset);
        } else {
            source.start(noteOnDelay > 0 ? this.ctx.currentTime + noteOnDelay : 0, sampleOffset);
        }

        this.sourceNode = source;
        this.noteOnTime = noteOnDelay;
        this.destination = options.destination;

        const baseGain = options.gain * (this.velocity / 127);
        this.outputNode.gain.value = 0;

        const now = this.ctx.currentTime;
        const absNoteOn = now + noteOnDelay;
        const relOff = totalDuration - sampleOffset;

        scheduleADSR(
            this.outputNode,
            { ...this.adsr, sustain: this.adsr.sustain * baseGain },
            absNoteOn - now,
            absNoteOn - now + relOff,
            this.ctx,
            relOff + 0.1
        );

        if (!source.loop) {
            source.onended = () => {
                if (this.state === VoiceState.Playing) {
                    this.state = VoiceState.Done;
                }
            };
        }
    }

    release(noteOffDelay: number = 0) {
        if (this.state !== VoiceState.Playing) return;
        this.state = VoiceState.Release;
        this.noteOffTime = noteOffDelay;

        const now = this.ctx.currentTime;
        const absNoteOff = now + noteOffDelay;

        if (this.sourceNode && this.sourceNode.loop) {
            this.sourceNode.loop = false;
            if (this.sourceNode.buffer) {
                const currentPos = (now - this.noteOnTime) % this.sourceNode.buffer.duration;
                this.sourceNode.stop(absNoteOff + this.adsr.release);
                if (this.adsr.release > 0) {
                    this.outputNode.gain.cancelScheduledValues(now);
                    this.outputNode.gain.setValueAtTime(this.outputNode.gain.value, now);
                    this.outputNode.gain.linearRampToValueAtTime(0, absNoteOff + this.adsr.release);
                }
            }
        } else {
            const currentGain = this.outputNode.gain.value;
            this.outputNode.gain.cancelScheduledValues(now);
            this.outputNode.gain.setValueAtTime(currentGain, now);
            if (this.adsr.release > 0) {
                this.outputNode.gain.linearRampToValueAtTime(0, absNoteOff + this.adsr.release);
            }
        }
    }

    stop() {
        this.state = VoiceState.Done;
        this.cleanup();
    }

    private cleanup() {
        if (this.sourceNode) {
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
        this.outputNode.gain.value = 0;
        this.outputNode.disconnect();
        this.note = -1;
        this.velocity = 0;
        this.state = VoiceState.Idle;
    }

    dispose() {
        this.cleanup();
        this.outputNode.disconnect();
    }
}
