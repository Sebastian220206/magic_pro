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
        // Finished voices are as good as idle. Without this the pool filled up
        // with spent voices and every new note stole a sounding one.
        const free = this.voices.find(v =>
            v.state === VoiceState.Idle || v.state === VoiceState.Done);
        if (free) return free;

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

    /**
     * Release every sounding voice at absolute time `when` (0 = now).
     *
     * Voices whose note-on has not happened yet are cancelled outright rather
     * than released: they have made no sound, and `Voice.release` clamps a
     * release to the note's own start, so releasing them would let a stopped
     * transport still blip out every note it had queued.
     */
    releaseAll(when: number = 0) {
        const at = when > 0 ? when : this.ctx.currentTime;
        for (const v of this.voices) {
            if (v.state !== VoiceState.Playing) continue;
            if (v.startTime > at) v.stop();
            else v.release(when);
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
        const byAge = (a: Voice, b: Voice) =>
            ((a as any)._order ?? 0) - ((b as any)._order ?? 0);

        // Steal a voice that is already fading out before one still held down,
        // so voice exhaustion cuts a tail rather than a note the user is playing.
        const releasing = this.voices.filter(v => v.state === VoiceState.Release).sort(byAge);
        const target = releasing[0]
            ?? this.voices.filter(v => v.state === VoiceState.Playing).sort(byAge)[0]
            ?? this.voices[0];

        target.stop();
        return target;
    }
}
