import { Voice, VoiceState } from './Voice';

export class VoiceAllocator {
    private voices: Voice[] = [];
    private maxVoices: number;
    private ctx: AudioContext | OfflineAudioContext;

    constructor(ctx: AudioContext | OfflineAudioContext, maxVoices: number = 64) {
        this.ctx = ctx;
        this.maxVoices = Math.max(8, Math.min(maxVoices, 256));
    }

    get context(): AudioContext | OfflineAudioContext {
        return this.ctx;
    }

    setMaxVoices(max: number) {
        this.maxVoices = Math.max(8, Math.min(max, 256));
        if (this.voices.length > this.maxVoices) {
            this.stealVoices(this.voices.length - this.maxVoices);
        }
    }

    getActiveVoiceCount(): number {
        return this.voices.filter(v => v.state !== VoiceState.Idle).length;
    }

    getTotalVoiceCount(): number {
        return this.voices.length;
    }

    getVoices(): readonly Voice[] {
        return this.voices;
    }

    acquireVoice(): Voice {
        const idleVoice = this.voices.find(v => v.state === VoiceState.Idle);
        if (idleVoice) return idleVoice;

        if (this.voices.length < this.maxVoices) {
            const voice = new Voice(this.ctx);
            this.voices.push(voice);
            return voice;
        }

        return this.stealOldestVoice();
    }

    findVoice(note: number): Voice | undefined {
        return this.voices.find(v => v.note === note && (v.state === VoiceState.Playing || v.state === VoiceState.Release));
    }

    findVoicesForNote(note: number): Voice[] {
        return this.voices.filter(v => v.note === note && (v.state === VoiceState.Playing || v.state === VoiceState.Release));
    }

    releaseNote(note: number, delay: number = 0) {
        const voices = this.findVoicesForNote(note);
        for (const v of voices) {
            v.release(delay);
        }
    }

    releaseAll(delay: number = 0) {
        for (const v of this.voices) {
            if (v.state === VoiceState.Playing) {
                v.release(delay);
            }
        }
    }

    stopAll() {
        for (const v of this.voices) {
            v.stop();
        }
    }

    cleanup() {
        this.voices = this.voices.filter(v => v.state !== VoiceState.Done);
    }

    dispose() {
        for (const v of this.voices) {
            v.dispose();
        }
        this.voices = [];
    }

    private stealVoices(count: number) {
        const releasable = this.voices
            .filter(v => v.state === VoiceState.Playing)
            .sort((a, b) => {
                if (a.velocity !== b.velocity) return a.velocity - b.velocity;
                return ((a as any)._order ?? 0) - ((b as any)._order ?? 0);
            });

        for (let i = 0; i < Math.min(count, releasable.length); i++) {
            releasable[i].stop();
        }
    }

    private stealOldestVoice(): Voice {
        const playing = this.voices.filter(v => v.state === VoiceState.Playing);
        if (playing.length === 0) {
            const idle = this.voices[0];
            idle.stop();
            return idle;
        }
        playing.sort((a, b) => ((a as any)._order ?? 0) - ((b as any)._order ?? 0));
        const target = playing[0];
        target.stop();
        return target;
    }
}
