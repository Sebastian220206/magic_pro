/**
 * What each automation mode does while the transport rolls.
 *
 * The mixer's mode button wrote `track.automationMode` and nothing read it,
 * because there was nothing to read it for: no part of the app applied an
 * automation lane during playback. Lanes were data you could draw and never
 * hear. This is the rule set the runtime follows now.
 *
 * Two questions per parameter per frame, and they are not opposites — in Touch
 * while you hold the fader, playback stops and recording starts; let go and it
 * reverses. Keeping them as separate predicates is what makes that expressible.
 */

export type AutomationMode = 'off' | 'read' | 'touch' | 'latch' | 'write';

export const AUTOMATION_MODES: readonly { id: AutomationMode; label: string; hint: string }[] = [
    { id: 'off', label: 'Off', hint: 'Ignore the lane; the control stays where you put it' },
    { id: 'read', label: 'Read', hint: 'Play the lane back' },
    { id: 'touch', label: 'Touch', hint: 'Play back, and record only while you hold the control' },
    { id: 'latch', label: 'Latch', hint: 'Play back until you touch a control, then record until stop' },
    { id: 'write', label: 'Write', hint: 'Record continuously, replacing the lane as it goes' },
];

/** Per-parameter state the runtime carries between frames. */
export interface AutomationTouchState {
    /** The user currently has the control held. */
    touching: boolean;
    /**
     * A Latch pass has been armed by a first touch.
     *
     * Latch keeps writing after release — that is the whole difference from
     * Touch — so this stays true until the transport stops.
     */
    latched: boolean;
}

export const IDLE_TOUCH: AutomationTouchState = { touching: false, latched: false };

/**
 * Should the lane drive the parameter right now?
 *
 * Write never plays back: it is replacing the lane, and reading it at the same
 * time would fight the fader the user is holding.
 */
export function playsBackNow(mode: AutomationMode, state: AutomationTouchState = IDLE_TOUCH): boolean {
    switch (mode) {
        case 'read': return true;
        case 'touch': return !state.touching;
        case 'latch': return !state.latched;
        case 'write':
        case 'off':
        default: return false;
    }
}

/**
 * Should a move be written into the lane right now?
 *
 * Only while the transport is rolling — a fader moved with the transport
 * stopped is setting the mix, not automating it.
 */
export function recordsNow(
    mode: AutomationMode,
    state: AutomationTouchState = IDLE_TOUCH,
    rolling = true,
): boolean {
    if (!rolling) return false;
    switch (mode) {
        case 'write': return true;
        case 'touch': return state.touching;
        case 'latch': return state.latched;
        case 'read':
        case 'off':
        default: return false;
    }
}

/** Fold a touch or release into the state a mode carries. */
export function applyTouch(
    mode: AutomationMode,
    state: AutomationTouchState,
    touching: boolean,
): AutomationTouchState {
    return {
        touching,
        // Latch arms on the first touch and stays armed; every other mode
        // tracks the touch directly and forgets it on release.
        latched: mode === 'latch' ? (state.latched || touching) : false,
    };
}

/** The transport stopping ends a Latch pass. */
export function releaseOnStop(): AutomationTouchState {
    return { ...IDLE_TOUCH };
}

/** Whether a mode ever writes, for labelling the control. */
export function isWriteMode(mode: AutomationMode): boolean {
    return mode === 'touch' || mode === 'latch' || mode === 'write';
}

/**
 * Thin out a run of recorded points.
 *
 * A write pass samples every animation frame — about 60 points a second — and
 * a four-bar move would leave hundreds of collinear points that are slow to
 * draw and impossible to edit. Drops any point that sits on the line between
 * its neighbours within `tolerance`.
 */
export function thinPoints(
    points: { time: number; value: number }[],
    tolerance = 0.001,
): { time: number; value: number }[] {
    if (points.length <= 2) return [...points];

    const kept = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const previous = kept[kept.length - 1];
        const next = points[i + 1];
        const span = next.time - previous.time;
        // A zero span means two points share a time; keep the later one rather
        // than dividing by zero to decide.
        const interpolated = span <= 0
            ? next.value
            : previous.value + (next.value - previous.value) * ((points[i].time - previous.time) / span);
        if (Math.abs(points[i].value - interpolated) > tolerance) kept.push(points[i]);
    }
    kept.push(points[points.length - 1]);
    return kept;
}

/**
 * Replace the stretch a write pass covered, keeping everything outside it.
 *
 * Write and Latch overwrite the lane under the pass. Anything before `from` or
 * after `to` is left alone, so punching in on one phrase does not wipe the
 * rest of the song.
 */
export function mergePass(
    existing: { time: number; value: number }[],
    recorded: { time: number; value: number }[],
): { time: number; value: number }[] {
    if (recorded.length === 0) return [...existing];

    const from = recorded[0].time;
    const to = recorded[recorded.length - 1].time;
    const before = existing.filter(p => p.time < from);
    const after = existing.filter(p => p.time > to);

    return [...before, ...recorded, ...after].sort((a, b) => a.time - b.time);
}
