/**
 * metronome.ts
 * Self-scheduling metronome using Web Audio API.
 *
 * Uses its own timer to schedule clicks based on the scheduler's beat
 * position. Does NOT depend on transportTick events.
 */

import { audioContextManager } from './audioContext';
import { advancedScheduler } from './scheduler';

interface MetronomeConfig {
    downbeatFreq: number;
    normalFreq: number;
    clickDuration: number;
    lookaheadSeconds: number;
    refillIntervalMs: number;
    volume: number;
    accentLevel: number;
    clickLevel: number;
    polyphonic: boolean;
}

const DEFAULT_CONFIG: MetronomeConfig = {
    downbeatFreq: 1000,
    normalFreq: 800,
    clickDuration: 0.015,
    lookaheadSeconds: 2.0,
    refillIntervalMs: 100,
    volume: 0.5,
    accentLevel: 10,
    clickLevel: 5,
    polyphonic: false,
};

class MetronomeEngine {
    private config: MetronomeConfig = { ...DEFAULT_CONFIG };
    private enabled: boolean = false;
    private outputGain: GainNode | null = null;
    private refillTimer: ReturnType<typeof setInterval> | null = null;

    private scheduledUpToBeat: number = -1;
    private schedulerStartTime: number = 0;
    private schedulerStartBeat: number = 0;
    private currentTempo: number = 120;
    private currentBeatsPerBar: number = 4;

    setEnabled(enabled: boolean): void {
        if (enabled === this.enabled) return;
        this.enabled = enabled;

        if (enabled) {
            this.captureSchedulerState();
            this.startRefill();
        } else {
            this.stopRefill();
        }
    }

    isEnabled(): boolean { return this.enabled; }

    setVolume(level01: number): void {
        this.config.volume = Math.max(0, Math.min(1, level01));
        if (this.outputGain) this.outputGain.gain.value = this.config.volume;
    }

    setAccentLevel(level: number): void {
        this.config.accentLevel = Math.max(0, Math.min(10, level));
    }

    setClickLevel(level: number): void {
        this.config.clickLevel = Math.max(0, Math.min(10, level));
    }

    setPolyphonic(poly: boolean): void {
        this.config.polyphonic = poly;
    }

    /**
     * Click `bars` bars before the transport rolls, and report how long that
     * takes in seconds.
     *
     * A count-in cannot come from the normal refill loop: that derives its
     * beats from the scheduler's position and only produces clicks while the
     * transport is already moving, which is exactly when a count-in is over.
     * The clicks are scheduled outright, ahead of the audio clock, so they are
     * sample-accurate and land whether or not the metronome is otherwise on.
     *
     * Returns 0 when there is nothing to count in, so callers can start the
     * transport immediately rather than special-casing it.
     */
    scheduleCountIn(bars: number, beatsPerBar: number, tempo: number): number {
        const ctx = audioContextManager.getContext();
        if (!ctx || bars <= 0 || beatsPerBar <= 0 || tempo <= 0) return 0;

        const secondsPerBeat = 60 / tempo;
        const beats = Math.round(bars * beatsPerBar);
        const output = this.ensureOutputGain();

        // A small lead-in, or the first click lands in the past and is dropped.
        const start = ctx.currentTime + 0.06;
        for (let i = 0; i < beats; i++) {
            this.scheduleClick(output, start + i * secondsPerBeat, i % beatsPerBar === 0, ctx);
        }

        return 0.06 + beats * secondsPerBeat;
    }

    reset(): void {
        this.scheduledUpToBeat = -1;
        this.stopRefill();
    }

    dispose(): void {
        this.enabled = false;
        this.stopRefill();
    }

    // ── Internal ────────────────────────────────────────────────────────

    private ensureOutputGain(): GainNode {
        if (!this.outputGain) {
            const ctx = audioContextManager.getContext()!;
            this.outputGain = ctx.createGain();
            this.outputGain.gain.value = this.config.volume;
            this.outputGain.connect(ctx.destination);
        }
        return this.outputGain;
    }

    /**
     * Snapshot the scheduler's current position so we can calculate
     * beat times even if the scheduler briefly pauses.
     */
    private captureSchedulerState(): void {
        const ctx = audioContextManager.getContext();
        if (!ctx) return;

        this.schedulerStartTime = ctx.currentTime;
        this.schedulerStartBeat = advancedScheduler.getCurrentBeat();
        this.currentTempo = advancedScheduler.getTempo();
        const ts = advancedScheduler.getTimeSignature();
        this.currentBeatsPerBar = ts[0];
        this.scheduledUpToBeat = -1;
    }

    private startRefill(): void {
        this.stopRefill();
        this.scheduledUpToBeat = -1;
        this.refill();
        this.refillTimer = setInterval(() => this.refill(), this.config.refillIntervalMs);
    }

    private stopRefill(): void {
        if (this.refillTimer !== null) {
            clearInterval(this.refillTimer);
            this.refillTimer = null;
        }
    }

    /**
     * Compute the current beat from AudioContext time + captured start state.
     * This works even if the scheduler is briefly paused during loadProject.
     */
    private getCurrentBeat(): number {
        const ctx = audioContextManager.getContext();
        if (!ctx) return this.schedulerStartBeat;

        const elapsedSeconds = ctx.currentTime - this.schedulerStartTime;
        return this.schedulerStartBeat + (elapsedSeconds / 60) * this.currentTempo;
    }

    private refill(): void {
        if (!this.enabled) return;

        const ctx = audioContextManager.getContext();
        if (!ctx) return;

        // Re-sync with scheduler periodically so we don't drift
        if (advancedScheduler.isCurrentlyPlaying()) {
            const liveBeat = advancedScheduler.getCurrentBeat();
            const liveTempo = advancedScheduler.getTempo();
            const ts = advancedScheduler.getTimeSignature();

            // Only resync if we haven't scheduled anything yet or if tempo changed
            if (this.scheduledUpToBeat < 0 || Math.abs(liveTempo - this.currentTempo) > 0.01) {
                this.captureSchedulerState();
            } else {
                // Update beat estimate from live scheduler
                this.currentTempo = liveTempo;
                this.currentBeatsPerBar = ts[0];
            }
        }

        // Always advance our own time estimate — this keeps ticking even
        // if the scheduler is briefly paused
        const currentBeat = this.getCurrentBeat();

        const lookaheadBeats = Math.ceil(this.config.lookaheadSeconds * this.currentTempo / 60) + 1;
        const lastBeat = currentBeat + lookaheadBeats;

        // If we haven't scheduled anything yet, start from next whole beat
        if (this.scheduledUpToBeat < 0) {
            this.scheduledUpToBeat = Math.ceil(currentBeat);
        }

        // Don't schedule beats we already did
        const startBeat = Math.max(this.scheduledUpToBeat, Math.ceil(currentBeat));

        const output = this.ensureOutputGain();

        for (let beat = startBeat; beat <= lastBeat; beat++) {
            if (beat <= this.scheduledUpToBeat) continue;

            const beatsFromCurrent = beat - currentBeat;
            const secondsFromNow = (beatsFromCurrent / this.currentTempo) * 60;

            if (secondsFromNow < -0.05) continue;

            const audioTime = ctx.currentTime + Math.max(0, secondsFromNow);

            const beatInBar = ((beat - 1) % this.currentBeatsPerBar + this.currentBeatsPerBar) % this.currentBeatsPerBar;
            const isDownbeat = beatInBar === 0;

            this.scheduleClick(output, audioTime, isDownbeat, ctx);
            this.scheduledUpToBeat = beat;
        }
    }

    private scheduleClick(
        output: GainNode,
        audioTime: number,
        isDownbeat: boolean,
        ctx: AudioContext,
    ): void {
        const freq = isDownbeat ? this.config.downbeatFreq : this.config.normalFreq;
        const duration = this.config.clickDuration;

        const rawGain = isDownbeat
            ? this.config.accentLevel / 10
            : this.config.clickLevel / 10;

        if (rawGain <= 0) return;

        if (this.config.polyphonic) {
            this.createClickOsc(ctx, output, audioTime, freq, rawGain, duration);
            this.createClickOsc(ctx, output, audioTime, freq * 1.5, rawGain * 0.5, duration);
        } else {
            this.createClickOsc(ctx, output, audioTime, freq, rawGain, duration);
        }
    }

    private createClickOsc(
        ctx: AudioContext,
        output: GainNode,
        startTime: number,
        frequency: number,
        gain: number,
        duration: number,
    ): void {
        const osc = ctx.createOscillator();
        const envGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = frequency;

        envGain.gain.setValueAtTime(0.0001, startTime);
        envGain.gain.linearRampToValueAtTime(gain, startTime + 0.001);
        envGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(envGain);
        envGain.connect(output);

        osc.onended = () => {
            osc.disconnect();
            envGain.disconnect();
        };

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
    }
}

export const metronomeEngine = new MetronomeEngine();
