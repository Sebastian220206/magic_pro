/**
 * automationRuntime.ts
 * Play automation lanes back, and record moves into them.
 *
 * Automation was data with no runtime: `automationValueAt` existed and was
 * called by exactly one test, and the mixer's Read/Touch/Latch/Write button
 * wrote `track.automationMode`, which nothing read. You could draw a fader ride
 * and never hear it.
 *
 * The store's transport loop calls `applyAutomation` once a frame while
 * rolling. Recording is driven from the other side: a control tells the runtime
 * when it is grabbed and released, and what value it is passing through.
 *
 * Deliberately outside the store so the rules can be tested without a
 * transport, and so the store keeps one call rather than this logic inline.
 */

import {
    playsBackNow, recordsNow, applyTouch, IDLE_TOUCH,
    thinPoints, mergePass,
    type AutomationMode, type AutomationTouchState,
} from '@/lib/automationModes';

export interface AutomationPoint { time: number; value: number }

/** What the runtime needs from a track, without importing the store's types. */
export interface AutomatedTrack {
    id: string;
    automationMode?: AutomationMode;
    automation?: { parameter: string; points: AutomationPoint[] }[];
}

/** One parameter of one track. */
function key(trackId: string, parameter: string): string {
    return `${trackId}::${parameter}`;
}

/** Interpolated lane value at a beat, or undefined when the lane is empty. */
export function valueAt(points: AutomationPoint[] | undefined, time: number): number | undefined {
    if (!points?.length) return undefined;
    const sorted = points.length > 1 && points[0].time <= points[1].time
        ? points
        : [...points].sort((a, b) => a.time - b.time);

    if (time <= sorted[0].time) return sorted[0].value;
    const last = sorted[sorted.length - 1];
    if (time >= last.time) return last.value;

    for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (time >= a.time && time <= b.time) {
            const span = b.time - a.time;
            if (span <= 0) return b.value;
            return a.value + (b.value - a.value) * ((time - a.time) / span);
        }
    }
    return last.value;
}

/** A pass being recorded into one lane. */
interface Pass {
    trackId: string;
    parameter: string;
    points: AutomationPoint[];
}

class AutomationRuntime {
    private touches = new Map<string, AutomationTouchState>();
    private passes = new Map<string, Pass>();
    /** Last value applied, so playback only writes when something changed. */
    private applied = new Map<string, number>();
    /** The live value a held control is passing through. */
    private held = new Map<string, number>();

    private touchOf(trackId: string, parameter: string): AutomationTouchState {
        return this.touches.get(key(trackId, parameter)) ?? IDLE_TOUCH;
    }

    /** A control was grabbed. Starts a pass when the mode records. */
    beginTouch(trackId: string, parameter: string, mode: AutomationMode, value: number): void {
        const k = key(trackId, parameter);
        this.touches.set(k, applyTouch(mode, this.touchOf(trackId, parameter), true));
        this.held.set(k, value);
    }

    /** The value a held control is passing through, sampled each frame. */
    updateTouch(trackId: string, parameter: string, value: number): void {
        this.held.set(key(trackId, parameter), value);
    }

    /**
     * A control was released.
     *
     * Latch keeps writing afterwards, so the pass stays open; every other mode
     * closes it and hands back the points to commit.
     */
    endTouch(trackId: string, parameter: string, mode: AutomationMode): void {
        const k = key(trackId, parameter);
        this.touches.set(k, applyTouch(mode, this.touchOf(trackId, parameter), false));
        if (mode !== 'latch' && mode !== 'write') this.held.delete(k);
    }

    /**
     * Sample every automated parameter for this frame.
     *
     * Returns what changed rather than applying it, so the caller owns both the
     * engine calls and the store write — and so this is testable without either.
     */
    tick(tracks: AutomatedTrack[], beat: number, rolling: boolean): {
        playback: { trackId: string; parameter: string; value: number }[];
    } {
        const playback: { trackId: string; parameter: string; value: number }[] = [];

        for (const track of tracks) {
            const mode = (track.automationMode ?? 'read') as AutomationMode;
            if (mode === 'off' || !track.automation?.length) continue;

            for (const lane of track.automation) {
                const k = key(track.id, lane.parameter);
                const touch = this.touchOf(track.id, lane.parameter);

                if (recordsNow(mode, touch, rolling)) {
                    const value = this.held.get(k);
                    if (value !== undefined) {
                        const pass = this.passes.get(k) ?? {
                            trackId: track.id, parameter: lane.parameter, points: [],
                        };
                        // One point per frame; `thinPoints` collapses the run
                        // when the pass is committed.
                        pass.points.push({ time: beat, value });
                        this.passes.set(k, pass);
                    }
                    continue;
                }

                if (!playsBackNow(mode, touch)) continue;

                const value = valueAt(lane.points, beat);
                if (value === undefined) continue;
                // Re-applying an unchanged value every frame would restart the
                // engine's parameter ramps 60 times a second.
                if (Math.abs((this.applied.get(k) ?? Number.NaN) - value) < 1e-4) continue;
                this.applied.set(k, value);
                playback.push({ trackId: track.id, parameter: lane.parameter, value });
            }
        }

        return { playback };
    }

    /**
     * Close every open pass and return the lanes to write.
     *
     * Called when the transport stops. Latch passes end here, which is what
     * "until stop" means.
     */
    commitPasses(tracks: AutomatedTrack[]): {
        trackId: string; parameter: string; points: AutomationPoint[];
    }[] {
        const committed: { trackId: string; parameter: string; points: AutomationPoint[] }[] = [];

        for (const pass of this.passes.values()) {
            if (pass.points.length === 0) continue;
            const existing = tracks
                .find(t => t.id === pass.trackId)
                ?.automation?.find(l => l.parameter === pass.parameter)
                ?.points ?? [];
            committed.push({
                trackId: pass.trackId,
                parameter: pass.parameter,
                points: mergePass(existing, thinPoints(pass.points)),
            });
        }

        this.passes.clear();
        this.touches.clear();
        this.held.clear();
        return committed;
    }

    /** Forget the last-applied values, so a seek re-applies the lane. */
    invalidate(): void {
        this.applied.clear();
    }

    /** True while any parameter is mid-pass, for the UI to show a write light. */
    isRecording(): boolean {
        return this.passes.size > 0;
    }
}

export const automationRuntime = new AutomationRuntime();
