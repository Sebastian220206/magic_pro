/**
 * audioDebug.ts
 * Debug utilities for audio loading and playback issues.
 */

import { audioEngine2 } from './AudioEngineAdapter';
import { routingEngine } from './audioEngine/routingEngine';
import { audioBufferCache } from './useAudioPlayer';

export interface AudioDebugInfo {
    audioContextState: string | null;
    audioContextCurrentTime: number;
    bufferCacheSize: number;
    bufferCacheKeys: string[];
    masterVolume: number;
}

/**
 * Get comprehensive debug information about the audio system.
 */
export function getAudioDebugInfo(): AudioDebugInfo {
    const ctx = audioEngine2.getContext();
    
    return {
        audioContextState: ctx?.state ?? null,
        audioContextCurrentTime: ctx?.currentTime ?? 0,
        bufferCacheSize: audioBufferCache.size,
        bufferCacheKeys: Array.from(audioBufferCache.keys()),
        masterVolume: 1.0, // Could be retrieved from store if needed
    };
}

/**
 * Log current audio system state for debugging.
 */
export function logAudioDebugInfo(prefix = '[AudioDebug]'): void {
    const info = getAudioDebugInfo();
    console.log(prefix, {
        contextState: info.audioContextState,
        contextTime: info.audioContextCurrentTime,
        bufferCount: info.bufferCacheSize,
        buffers: info.bufferCacheKeys,
    });
}

/**
 * Test AudioContext creation and resumption.
 */
export async function testAudioContext(): Promise<boolean> {
    try {
        console.log('[AudioDebug] Testing AudioContext...');
        
        // Force creation
        const ctx = audioEngine2.getContext();
        if (!ctx) {
            console.error('[AudioDebug] Failed to create AudioContext');
            return false;
        }
        
        console.log(`[AudioDebug] AudioContext created, state: ${ctx.state}`);
        
        // Try to resume if suspended
        if (ctx.state === 'suspended') {
            console.log('[AudioDebug] Attempting to resume AudioContext...');
            await ctx.resume();
            console.log(`[AudioDebug] After resume, state: ${ctx.state}`);
        }
        
        // Test with a simple oscillator
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0.1; // Very quiet test tone
        
        oscillator.frequency.value = 440; // A4
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1); // Very short test
        
        console.log('[AudioDebug] Test tone played successfully');
        return true;
        
    } catch (error) {
        console.error('[AudioDebug] AudioContext test failed:', error);
        return false;
    }
}

/**
 * Verify that a specific URL can be loaded as an AudioBuffer.
 */
export async function testAudioUrl(url: string): Promise<boolean> {
    try {
        console.log(`[AudioDebug] Testing audio URL: ${url}`);
        const buffer = await audioEngine2.loadAudio(url);
        console.log(`[AudioDebug] Successfully loaded audio: ${buffer!.duration}s, ${buffer!.numberOfChannels} channels`);
        return true;
    } catch (error) {
        console.error(`[AudioDebug] Failed to load audio URL:`, error);
        return false;
    }
}

/**
 * Measure and log actual audio latency metrics.
 */
export function measureLatency(ctx: AudioContext): void {
  console.table({
    'baseLatency (output buffer)': `${(ctx.baseLatency * 1000).toFixed(1)}ms`,
    'outputLatency (hardware)':    `${((ctx.outputLatency ?? 0) * 1000).toFixed(1)}ms`,
    'total estimated':             `${((ctx.baseLatency + (ctx.outputLatency ?? 0)) * 1000).toFixed(1)}ms`,
    'sampleRate':                  `${ctx.sampleRate}Hz`,
    'state':                       ctx.state,
  });
}

/**
 * Report every gate a note has to pass to be heard, for one project.
 *
 * Silence has many causes here and they all look identical from the UI: a
 * suspended context, a muted master, a track the routing engine believes is
 * muted while the store says otherwise, a stale solo that silences everything
 * else, a region typed `audio` holding MIDI notes, or an instrument that never
 * finished loading. Each has cost a debugging session. This walks them in
 * order and names the first one that would stop the sound.
 *
 * `audioDebug.whySilent()` in the console.
 */
export function whySilent(): void {
    const ctx = audioEngine2.getContext();
    const store = (window as any).__projectStore?.getState?.();
    const routing = routingEngine as unknown as { trackNodes?: Map<string, { isMuted?: boolean; isSoloed?: boolean }> };

    const problems: string[] = [];

    if (!ctx) problems.push('No AudioContext at all.');
    else if (ctx.state !== 'running') problems.push(`AudioContext is "${ctx.state}", not "running" — click the page, then retry.`);

    if (!store) {
        console.log('%c[whySilent] project store not exposed (production build?)', 'color:#fb923c');
        return;
    }

    const s = store.settings ?? {};
    if (s.masterMuted) problems.push('Master is muted.');
    if ((s.masterVolume ?? 1) === 0) problems.push('Master volume is 0.');

    // The scheduler decides audibility from the routing engine, not the store.
    // When the two disagree, the UI shows a perfectly normal track that cannot
    // be heard — which is the failure this whole helper exists for.
    const chains: Map<string, { isMuted?: boolean; isSoloed?: boolean }> =
        routing?.trackNodes ?? new Map();
    const engineSolo = Array.from(chains.entries()).filter(([, c]) => c?.isSoloed).map(([id]) => id);
    const storeSolo = (store.tracks ?? []).filter((t: any) => t.soloed).map((t: any) => t.id);

    if (engineSolo.length && !storeSolo.length) {
        problems.push(`Audio engine thinks ${engineSolo.length} track(s) are soloed but the project has none — everything else is silenced. Ids: ${engineSolo.join(', ')}`);
    }

    const rows = (store.tracks ?? []).map((t: any) => {
        const chain = chains.get(t.id);
        const clips = (store.clips ?? []).filter((c: any) => c.trackId === t.id);
        const notes = clips.reduce((n: number, c: any) => n + (c.notes?.length ?? 0), 0);
        const midiNotesInAudioClip = clips
            .filter((c: any) => c.type !== 'midi' && (c.notes?.length ?? 0) > 0).length;

        if (chain === undefined) problems.push(`"${t.name}" has no node in the audio engine.`);
        if (chain?.isMuted && !t.muted) problems.push(`"${t.name}" is unmuted in the UI but muted in the audio engine.`);
        if (midiNotesInAudioClip) problems.push(`"${t.name}" has ${midiNotesInAudioClip} region(s) holding notes but typed "audio" — the sequencer skips those.`);
        if (t.volume === 0) problems.push(`"${t.name}" volume is 0.`);

        return {
            track: t.name,
            type: t.type,
            instrument: t.instrument ?? '-',
            loaded: t.instrumentLoaded ?? false,
            'muted (ui/engine)': `${!!t.muted}/${chain?.isMuted ?? 'no node'}`,
            'solo (ui/engine)': `${!!t.soloed}/${chain?.isSoloed ?? 'no node'}`,
            volume: t.volume,
            regions: clips.length,
            notes,
        };
    });

    console.log('%c[whySilent]', 'color:#22d3ee;font-weight:bold',
        `context=${ctx?.state ?? 'none'} master=${s.masterVolume ?? 1}${s.masterMuted ? ' (muted)' : ''} playhead=${(store.playhead ?? 0).toFixed(2)} playing=${!!store.playing}`);
    console.table(rows);

    if (problems.length) {
        console.log('%cLikely cause:', 'color:#ff4d4d;font-weight:bold');
        problems.forEach(p => console.log('  • ' + p));
    } else {
        console.log('%cNothing obviously blocking playback — the notes should be audible.', 'color:#4ade80');
    }
}

/**
 * Play two notes and measure what actually reaches the speakers.
 *
 * `whySilent` inspects state; this exercises the audio path. It fires one note
 * the way a keyboard does (immediately) and one the way the sequencer does
 * (scheduled to a future AudioContext time), and reports the peak level each
 * produced. Those two take different code paths, and a fault in the second
 * alone is invisible from the UI: live playing sounds perfectly while nothing
 * recorded ever plays back.
 *
 * Measuring matters more than it sounds. Counting the nodes a note creates
 * proves only that it was scheduled — the nodes exist either way, and a note
 * that is silenced the instant it starts looks identical.
 *
 *   await audioDebug.testPlayback()
 */
export async function testPlayback(trackId?: string): Promise<void> {
    const ctx = audioEngine2.getContext();
    if (!ctx) { console.log('%c[testPlayback] no AudioContext', 'color:#ff4d4d'); return; }
    if (ctx.state !== 'running') {
        console.log(`%c[testPlayback] AudioContext is "${ctx.state}" — click the page first`, 'color:#ff4d4d');
        return;
    }

    const store = (window as any).__projectStore?.getState?.();
    const track = trackId
        ?? store?.tracks?.find((t: any) => /midi|software|drummer|external/.test(t.type ?? ''))?.id
        ?? store?.focusedTrackId;
    if (!track) { console.log('%c[testPlayback] no instrument track to test', 'color:#fb923c'); return; }

    /*
     * Measure at two points, not one.
     *
     * `masterGain` is the summed mix; `outputNode` is the last node before
     * `ctx.destination`. Tapping only the mix reports "audible" while the
     * speakers get nothing, which is exactly what happened when a stale
     * connection left the output detached: meters moved, this said fine, and
     * the room was silent.
     */
    const engine = routingEngine as unknown as { masterGain?: AudioNode; outputNode?: AudioNode };
    const mix = engine.masterGain;
    const out = engine.outputNode;
    if (!mix && !out) { console.log('%c[testPlayback] no master nodes to measure', 'color:#ff4d4d'); return; }

    const taps: { node: AudioNode; analyser: AnalyserNode; buf: Float32Array<ArrayBuffer> }[] = [];
    for (const node of [mix, out]) {
        if (!node) continue;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        node.connect(analyser);
        taps.push({ node, analyser, buf: new Float32Array(new ArrayBuffer(analyser.fftSize * 4)) });
    }
    const [mixTap, outTap] = taps.length === 2 ? taps : [taps[0], taps[0]];

    const readPeaks = (peaks: number[]) => {
        taps.forEach((t, i) => {
            t.analyser.getFloatTimeDomainData(t.buf);
            for (const v of t.buf) peaks[i] = Math.max(peaks[i], Math.abs(v));
        });
    };

    const peakOver = async (ms: number) => {
        const peaks = taps.map(() => 0);
        const end = performance.now() + ms;
        while (performance.now() < end) {
            readPeaks(peaks);
            await new Promise(r => setTimeout(r, 20));
        }
        return { mix: peaks[0], out: peaks[taps.length - 1] };
    };

    const analyser = mixTap.analyser;
    const buf = mixTap.buf;
    void outTap;

    /** Wait until the output falls quiet, so one test cannot read the next. */
    const waitForQuiet = async (maxMs: number) => {
        const end = performance.now() + maxMs;
        while (performance.now() < end) {
            analyser.getFloatTimeDomainData(buf);
            let peak = 0;
            for (const v of buf) peak = Math.max(peak, Math.abs(v));
            if (peak < 0.0005) return true;
            await new Promise(r => setTimeout(r, 30));
        }
        return false;
    };

    const PITCH = 60;
    const AUDIBLE = 0.001;
    const verdict = (p: { mix: number; out: number }) =>
        p.out > AUDIBLE ? `AUDIBLE (peak ${p.out.toFixed(4)})`
            : p.mix > AUDIBLE ? `REACHES THE MIX BUT NOT THE OUTPUT (mix peak ${p.mix.toFixed(4)})`
                : 'SILENT';

    await waitForQuiet(1500);

    audioEngine2.triggerNote(track, PITCH, 100);
    const live = await peakOver(700);
    audioEngine2.releaseNote(track, PITCH);

    // A release tail read as the scheduled note's output would hide exactly
    // the fault this function exists to find.
    if (!await waitForQuiet(3000)) {
        console.log('%c[testPlayback] output never fell quiet — result may be unreliable', 'color:#fb923c');
    }

    const now = ctx.currentTime;
    audioEngine2.scheduleNote({
        key: 'debug-test', clipId: 'debug', trackId: track,
        pitch: PITCH, velocity: 100,
        startTime: now + 0.15, stopTime: now + 0.85,
        instrument: store?.tracks?.find((t: any) => t.id === track)?.instrument,
    });
    const sequenced = await peakOver(1400);

    for (const t of taps) {
        try { t.node.disconnect(t.analyser); } catch { /* already gone */ }
    }

    console.log('%c[testPlayback] track ' + track, 'color:#22d3ee;font-weight:bold');
    console.log('  played live (keyboard path):  ' + verdict(live));
    console.log('  scheduled (sequencer path):   ' + verdict(sequenced));

    if (live.mix > AUDIBLE && live.out <= AUDIBLE) {
        console.log('%c  -> Sound reaches the mix bus but not the output. The master output is detached from the speakers; meters read the mix, so they still move.', 'color:#ff4d4d;font-weight:bold');
    } else if (live.out > AUDIBLE && sequenced.out <= AUDIBLE) {
        console.log('%c  -> The instrument works but scheduled notes are silent. That is why nothing recorded plays back.', 'color:#ff4d4d;font-weight:bold');
    } else if (live.out <= AUDIBLE && sequenced.out <= AUDIBLE) {
        console.log('%c  -> Nothing from this track reaches the master. Check the track routing, mute and volume.', 'color:#ff4d4d;font-weight:bold');
    } else {
        console.log('%c  -> Both paths make sound; the fault is not in note playback itself.', 'color:#4ade80');
    }
}

// Make these available in the global scope for console debugging
if (typeof window !== 'undefined') {
    (window as any).audioDebug = {
        getInfo: getAudioDebugInfo,
        log: logAudioDebugInfo,
        testContext: testAudioContext,
        testUrl: testAudioUrl,
        measureLatency,
        whySilent,
        testPlayback,
    };
}
