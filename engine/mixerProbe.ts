/**
 * mixerProbe.ts
 * Does each mixer control change what leaves the master?
 *
 * Feeds a steady tone into a track's input node, taps the master gain with an
 * analyser, and reads the level while moving one control at a time. This is the
 * live mixer graph — not the offline export path, which has its own mix code
 * and would tell us about exports rather than about the mixer.
 *
 * Reading a level takes real time, so every measurement waits for the analyser
 * to fill. That makes this slow (a second or so per reading) and worth running
 * from the console rather than on every render.
 */

import { routingEngine } from './audioEngine/routingEngine';
import { audioContextManager } from './audioEngine/audioContext';

export interface MixerCheck {
    control: string;
    /** What the control is supposed to do. */
    expectation: string;
    pass: boolean;
    detail: string;
}

/** Peak of one analyser read, 0–1. */
function peakOf(analyser: AnalyserNode, buffer: Float32Array): number {
    analyser.getFloatTimeDomainData(buffer as Float32Array<ArrayBuffer>);
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
        const value = Math.abs(buffer[i]);
        if (value > peak) peak = value;
    }
    return peak;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** dB difference between two linear levels, guarding against log(0). */
function dbDrop(from: number, to: number): number {
    if (from <= 0) return 0;
    return 20 * Math.log10(Math.max(to, 1e-9) / from);
}

/**
 * Run the mixer through its paces.
 *
 * `trackId` must be a track the routing engine knows about. Everything is put
 * back the way it was found before returning — this runs against the user's
 * live project.
 */
export async function probeMixer(trackId: string): Promise<MixerCheck[]> {
    const ctx = audioContextManager.getContext();
    // Tapped at the very end of the chain — post master inserts, post fader —
    // so the master fader and the mastering chain are both in what is measured.
    const master = routingEngine.getMasterOutputNode();
    const chain = routingEngine.getTrackNodes(trackId);
    const checks: MixerCheck[] = [];

    if (!ctx || !master || !chain) {
        return [{
            control: 'setup',
            expectation: 'the engine is running with a track routed',
            pass: false,
            detail: `ctx=${!!ctx} master=${!!master} chain=${!!chain}`,
        }];
    }
    if (ctx.state !== 'running') await ctx.resume();

    // Analyser on the master, and a separate one per channel so pan can be read.
    const splitter = ctx.createChannelSplitter(2);
    const left = ctx.createAnalyser();
    const right = ctx.createAnalyser();
    const both = ctx.createAnalyser();
    for (const a of [left, right, both]) a.fftSize = 2048;
    master.connect(splitter);
    splitter.connect(left, 0);
    splitter.connect(right, 1);
    master.connect(both);

    const buf = new Float32Array(both.fftSize);
    const lBuf = new Float32Array(left.fftSize);
    const rBuf = new Float32Array(right.fftSize);

    // A steady tone into the channel's input, ahead of every mixer control.
    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    const level = ctx.createGain();
    level.gain.value = 0.5;
    osc.connect(level);
    level.connect(chain.inputGain);
    osc.start();

    // What the project had, to put back afterwards.
    const original = {
        volume: chain.baseVolume,
        muted: chain.isMuted,
        soloed: chain.isSoloed,
        pan: chain.panner.pan.value,
        masterVolume: routingEngine.getMasterVolume(),
    };

    const read = async (settleMs = 350) => {
        await wait(settleMs);
        return { peak: peakOf(both, buf), l: peakOf(left, lBuf), r: peakOf(right, rBuf) };
    };

    const add = (control: string, expectation: string, pass: boolean, detail: string) =>
        checks.push({ control, expectation, pass, detail });

    try {
        // ── The tone reaches the master at all ────────────────────────────
        routingEngine.updateTrack(trackId, { volume: 0.8, muted: false, solo: false, pan: 0 });
        const base = await read(500);
        add('signal path', 'a tone at the channel input reaches the master',
            base.peak > 0.01, `peak ${base.peak.toFixed(4)}`);

        if (base.peak <= 0.01) {
            // Every check below compares against this; without it they would
            // all "pass" by both readings being silence.
            return checks;
        }

        // ── Fader ─────────────────────────────────────────────────────────
        routingEngine.updateTrack(trackId, { volume: 0.4 });
        const halved = await read();
        const drop = dbDrop(base.peak, halved.peak);
        add('fader', 'halving the fader drops the master about 6 dB',
            drop < -4 && drop > -9, `${drop.toFixed(1)} dB`);

        routingEngine.updateTrack(trackId, { volume: 0.8 });
        await read();

        // ── Pan ───────────────────────────────────────────────────────────
        routingEngine.updateTrack(trackId, { pan: -1 });
        const panned = await read(500);
        add('pan', 'hard left puts the signal in the left channel',
            panned.l > 0.01 && panned.r < panned.l * 0.25,
            `L ${panned.l.toFixed(4)} R ${panned.r.toFixed(4)}`);

        routingEngine.updateTrack(trackId, { pan: 0 });
        await read();

        // ── Mute ──────────────────────────────────────────────────────────
        routingEngine.updateTrack(trackId, { muted: true });
        const muted = await read(500);
        add('mute', 'mute silences the channel',
            muted.peak < base.peak * 0.02, `peak ${muted.peak.toFixed(4)}`);

        routingEngine.updateTrack(trackId, { muted: false });
        await read();

        // ── Solo elsewhere ────────────────────────────────────────────────
        // Soloing a different track must silence this one. Uses a real second
        // track when the project has one.
        const otherId = routingEngine.getRoutingGraph().tracks.find(id => id !== trackId);
        if (otherId) {
            routingEngine.updateTrack(otherId, { solo: true });
            const soloedAway = await read(500);
            add('solo', 'soloing another track silences this one',
                soloedAway.peak < base.peak * 0.02, `peak ${soloedAway.peak.toFixed(4)}`);

            routingEngine.updateTrack(otherId, { solo: false });
            await read();
        } else {
            add('solo', 'soloing another track silences this one',
                false, 'skipped — project has only one track');
        }

        // ── Master fader ──────────────────────────────────────────────────
        routingEngine.setMasterVolume(original.masterVolume * 0.5);
        const masterDown = await read(500);
        // The tap is on the master gain's output, so its own fader shows here.
        const masterDrop = dbDrop(base.peak, masterDown.peak);
        add('master fader', 'the master fader scales the whole mix',
            masterDrop < -3, `${masterDrop.toFixed(1)} dB`);
        routingEngine.setMasterVolume(original.masterVolume);
        await read();

        // ── A send reaches its bus ────────────────────────────────────────
        // Mute the channel's own path first, so anything measured at the
        // master arrived by way of the bus and nothing else.
        const busId = `probe-bus-${Date.now()}`;
        let sendChecked = false;
        try {
            routingEngine.createBus({
                id: busId, name: 'Probe Bus', volume: 1, pan: 0,
                muted: false, soloed: false, effects: [], output: 'master',
            } as never);
            routingEngine.updateTrack(trackId, { sends: [{ busId, amount: 1 }] } as never);
            sendChecked = true;

            // Post-fader is the default, so pulling the fader must pull the
            // send with it — that is what "post-fader" means.
            routingEngine.setSendPosition(trackId, busId, 'postFader');
            routingEngine.updateTrack(trackId, { volume: 0.8 });
            const postAtUnity = await read(600);
            routingEngine.updateTrack(trackId, { volume: 0.05 });
            const postPulled = await read(600);
            add('send (post-fader)', 'a post-fader send follows the channel fader',
                postAtUnity.peak > base.peak * 0.1 && postPulled.peak < postAtUnity.peak * 0.3,
                `unity ${postAtUnity.peak.toFixed(4)} -> pulled ${postPulled.peak.toFixed(4)}`);

            // Pre-fader taps ahead of the fader, so it must survive both the
            // fader and the mute — how a headphone or reverb feed stays up.
            routingEngine.setSendPosition(trackId, busId, 'preFader');
            routingEngine.updateTrack(trackId, { volume: 0.05, muted: true });
            const preMuted = await read(700);
            add('send (pre-fader)', 'a pre-fader send survives the fader and the mute',
                preMuted.peak > base.peak * 0.1,
                `peak ${preMuted.peak.toFixed(4)} (fader down, channel muted)`);

            routingEngine.updateTrack(trackId, { muted: false, volume: 0.8, sends: [] } as never);
            await read();
        } finally {
            if (sendChecked) {
                try { routingEngine.removeBus(busId); } catch { /* already gone */ }
            }
        }

        // ── The master meter reflects the master fader ────────────────────
        // A meter tapping the summing node cannot see the fader or the
        // mastering chain, which is exactly what a mix engineer reads it for.
        const { audioEngine2 } = await import('./AudioEngineAdapter');
        let lastLoudness: { shortTerm: number; truePeakLeft: number } | null = null;
        const stopMeter = audioEngine2.startLoudnessMetering?.(d => {
            lastLoudness = { shortTerm: d.shortTerm, truePeakLeft: d.truePeakLeft };
        });
        // Short-term LUFS is a 3-second sliding average, so both readings have
        // to outlast that window or the second one is still averaging the first.
        await wait(4000);
        const loudBefore = lastLoudness;
        routingEngine.setMasterVolume(original.masterVolume * 0.25);
        await wait(4500);
        const loudAfter = lastLoudness;
        routingEngine.setMasterVolume(original.masterVolume);
        stopMeter?.();

        const beforeDb = (loudBefore as { shortTerm: number } | null)?.shortTerm ?? 0;
        const afterDb = (loudAfter as { shortTerm: number } | null)?.shortTerm ?? 0;
        add('master meter', 'the master meter follows the master fader',
            Number.isFinite(beforeDb) && Number.isFinite(afterDb) && beforeDb - afterDb > 8,
            `${beforeDb.toFixed(1)} LUFS -> ${afterDb.toFixed(1)} LUFS`);

        // ── Metering agrees with the signal ───────────────────────────────
        const reported = routingEngine.getTrackPeak(trackId);
        const measured = (await read(400)).peak;
        add('metering', 'the channel meter tracks the real level',
            reported > 0.005 && Math.abs(reported - measured) < 0.35,
            `meter ${reported.toFixed(4)} vs master ${measured.toFixed(4)}`);
    } finally {
        // Put the project back exactly as it was.
        osc.stop();
        osc.disconnect();
        level.disconnect();
        master.disconnect(splitter);
        master.disconnect(both);
        routingEngine.updateTrack(trackId, {
            volume: original.volume,
            muted: original.muted,
            solo: original.soloed,
            pan: original.pan,
        });
        routingEngine.setMasterVolume(original.masterVolume);
    }

    return checks;
}
