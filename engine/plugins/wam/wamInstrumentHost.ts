/**
 * wamInstrumentHost.ts
 * Web Audio Module instruments, assigned per track.
 *
 * A WAM with `isInstrument: true` reports `hasAudioInput: false` — it generates
 * sound from MIDI rather than processing an input, so it cannot sit in the
 * insert chain. It connects to the track's input instead, which puts it ahead
 * of the inserts exactly like the existing soundfont/sampler/synth backends.
 */

import { routingEngine } from '../../audioEngine/routingEngine';
import { createWamInstance, type WebAudioModuleInstance } from './wamLoader';

interface Assignment {
    trackId: string;
    url: string;
    identifier: string;
    instance: WebAudioModuleInstance;
    /** Notes currently sounding, so they can be released on stop. */
    held: Set<number>;
}

const assignments = new Map<string, Assignment>();

/** Convert a note to a MIDI status/data triplet. */
const noteOnBytes = (pitch: number, velocity: number) => [0x90, pitch & 0x7f, velocity & 0x7f];
const noteOffBytes = (pitch: number) => [0x80, pitch & 0x7f, 0];
/** CC 123 All Notes Off, CC 120 All Sound Off. */
const allNotesOffBytes = [0xb0, 123, 0];
const allSoundOffBytes = [0xb0, 120, 0];

/**
 * Load a WAM instrument onto a track, replacing any existing one.
 *
 * Returns false when the plugin could not be loaded; the caller should keep the
 * previous instrument rather than leaving the track silent.
 */
export async function assignWamInstrument(
    ctx: BaseAudioContext,
    trackId: string,
    url: string,
    identifier: string,
    initialState?: unknown,
): Promise<boolean> {
    try {
        const instance = await createWamInstance(ctx, url, initialState);

        removeWamInstrument(trackId);

        // Ahead of the inserts, so a track's plugin chain processes it.
        const nodes = (routingEngine as unknown as {
            trackNodes: Map<string, { inputGain?: AudioNode; mainGain?: AudioNode }>;
        }).trackNodes?.get(trackId);
        const target = nodes?.inputGain ?? nodes?.mainGain;

        if (!target) {
            console.warn(`[WAM] Track ${trackId} has no routing nodes; instrument not connected.`);
            instance.destroy?.();
            return false;
        }

        instance.audioNode.connect(target);
        assignments.set(trackId, { trackId, url, identifier, instance, held: new Set() });
        return true;
    } catch (error) {
        console.error(`[WAM] Failed to load instrument ${identifier}:`, error);
        return false;
    }
}

/** True when this track plays through a WAM instrument. */
export function hasWamInstrument(trackId: string): boolean {
    return assignments.has(trackId);
}

export function getWamInstrument(trackId: string): WebAudioModuleInstance | null {
    return assignments.get(trackId)?.instance ?? null;
}

/**
 * Start a note.
 *
 * `time` is an absolute AudioContext time. The sequencer already computes these,
 * so scheduled notes stay sample-accurate rather than being fired by a timer.
 */
export function wamNoteOn(trackId: string, pitch: number, velocity: number, time?: number): boolean {
    const assignment = assignments.get(trackId);
    if (!assignment) return false;

    assignment.held.add(pitch);
    schedule(assignment, noteOnBytes(pitch, velocity), time);
    return true;
}

export function wamNoteOff(trackId: string, pitch: number, time?: number): boolean {
    const assignment = assignments.get(trackId);
    if (!assignment) return false;

    assignment.held.delete(pitch);
    schedule(assignment, noteOffBytes(pitch), time);
    return true;
}

/** Silence every WAM instrument — transport stop, seek, or panic. */
export function wamAllNotesOff(): void {
    assignments.forEach(assignment => {
        assignment.held.clear();
        schedule(assignment, allNotesOffBytes);
        schedule(assignment, allSoundOffBytes);
    });
}

/** Disconnect and dispose the instrument on a track. */
export function removeWamInstrument(trackId: string): void {
    const assignment = assignments.get(trackId);
    if (!assignment) return;

    try {
        assignment.instance.audioNode.disconnect();
    } catch {
        // Already disconnected.
    }
    try {
        assignment.instance.destroy?.();
    } catch {
        // Already destroyed.
    }
    assignments.delete(trackId);
}

/** Drop every assignment. Used when tearing down the engine. */
export function disposeWamInstruments(): void {
    Array.from(assignments.keys()).forEach(removeWamInstrument);
}

function schedule(assignment: Assignment, bytes: number[], time?: number): void {
    try {
        assignment.instance.audioNode.scheduleEvents({
            type: 'wam-midi',
            time,
            data: { bytes },
        });
    } catch (error) {
        console.warn('[WAM] Failed to send MIDI to instrument:', error);
    }
}
