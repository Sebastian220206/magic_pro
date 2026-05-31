/**
 * audioDebug.ts
 * Debug utilities for audio loading and playback issues.
 */

import { audioEngine2 } from './AudioEngineAdapter';
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

// Make these available in the global scope for console debugging
if (typeof window !== 'undefined') {
    (window as any).audioDebug = {
        getInfo: getAudioDebugInfo,
        log: logAudioDebugInfo,
        testContext: testAudioContext,
        testUrl: testAudioUrl,
        measureLatency,
    };
}
