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

// Make these available in the global scope for console debugging
if (typeof window !== 'undefined') {
    (window as any).audioDebug = {
        getInfo: getAudioDebugInfo,
        log: logAudioDebugInfo,
        testContext: testAudioContext,
        testUrl: testAudioUrl,
        measureLatency,
        whySilent,
    };
}
