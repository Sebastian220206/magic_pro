import { getAudioRecorder } from './recorder';
import type { Track } from '@/models/Track';

/**
 * Input monitoring — hearing what is on the input before and during a take.
 *
 * The recorder has always built a `monitorGain` and connected it to the
 * destination. Its level came from `setMonitoring()`, and `setMonitoring()` had
 * no callers anywhere in the app: the gain was created as
 * `this.isMonitoring ? 0.8 : 0` with `isMonitoring` initialised to `false` and
 * never assigned. The monitor path was wired, open, and silent.
 *
 * The two calls that did exist went to `recordingEngine.setMonitoringEnabled`,
 * a second recorder that the record button does not use — so the app's only
 * monitoring API pointed at an object that was not recording.
 *
 * The track's `inputMonitoring` flag had the same problem from the other end:
 * the button set it, it was saved with the project, and the audio engine never
 * read it. This is what reads it.
 *
 * Arming also moved. It used to happen inside `beginAudioCapture`, meaning the
 * input did not open until record was pressed — so there was nothing to
 * monitor and nothing to meter while setting a level, which is the entire
 * point of arming a track.
 */

type MonitorState = {
    tracks: Track[];
    /** Recording must not tear the input down mid-take. */
    recording?: boolean;
};

/** Audio tracks whose input should be open: armed, or explicitly monitoring. */
function tracksNeedingInput(tracks: Track[]): Track[] {
    return tracks.filter(t => t.type === 'audio' && (t.recordEnabled || t.inputMonitoring));
}

/**
 * Open, close or re-level the input to match the tracks.
 *
 * Safe to call on every arm/monitor toggle: `arm()` returns immediately when
 * the input is already open, and the gain is set on a ramp.
 */
export async function syncInputMonitoring(state: MonitorState): Promise<void> {
    const recorder = getAudioRecorder();
    const needed = tracksNeedingInput(state.tracks);

    if (needed.length === 0) {
        // Never pull the stream out from under a running take.
        if (!state.recording) recorder.disarm();
        return;
    }

    try {
        await recorder.arm();
    } catch (error) {
        // `arm()` already reports a missing device through the store; anything
        // else here is a denied prompt or a device that vanished mid-session.
        console.error('[InputMonitoring] Could not open the input:', error);
        return;
    }

    recorder.setMonitoring(needed.some(t => t.inputMonitoring));
}

/** Whether any track is currently asking for an open input. */
export function wantsInput(tracks: Track[]): boolean {
    return tracksNeedingInput(tracks).length > 0;
}
