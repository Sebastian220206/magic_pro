/**
 * index.ts
 * Main export file for the advanced audio engine.
 * 
 * This file exports all engine modules and provides a unified interface
 * for the browser DAW audio system.
 */

// Core engine modules
import { audioContextManager, initializeAudio as initAudioContext, getCurrentTime as getAudioCurrentTime, getSampleRate as getAudioSampleRate } from './audioContext';
import { advancedScheduler } from './scheduler';
import { recordingEngine } from './recordingEngine';
import { routingEngine } from './routingEngine';
import { bufferCacheManager } from './bufferCache';
import { bounceEngine } from './bounceEngine';

export { audioContextManager, initAudioContext, getAudioCurrentTime, getAudioSampleRate };
export { advancedScheduler };
export { recordingEngine };
export { routingEngine };
export { bufferCacheManager };
export { bounceEngine };

// Mixer modules
export { ChannelStrip, createChannelStrip, dbToGain, gainToDb } from './channelStrip';
export type { ChannelStripConfig, ChannelStripState, InsertSlot, SendState } from './channelStrip';

export { AudioMeter, createAudioMeter } from './audioMeter';
export type { MeterData, MeterOptions } from './audioMeter';

export { LoudnessMeter } from './loudnessMeter';
export type { LoudnessData } from './loudnessMeter';

export { MasterBus, createMasterBus } from './masterBus';
export type { MasterBusState, LimiterOptions } from './masterBus';

export { MasteringChain, PRESETS, DEFAULT_MASTERING_STATE } from './masteringChain';
export type { MasteringPresetId, MasteringChainState, MasteringLimiterConfig, MasteringEQConfig, MasteringMultibandConfig } from './masteringChain';

export { MasteringProcessor, createMasteringProcessor } from './masteringProcessor';

// Types
export * from './types';

// Convenience exports - main entry points
export const initializeAudio = () => audioContextManager.initialize();
export const getCurrentTime = () => audioContextManager.getCurrentTime();
export const getSampleRate = () => audioContextManager.getSampleRate();

// Playback control
export const startPlayback = (clips: any[], tracks: any[], startBeat?: number, tempo?: number) => 
    advancedScheduler.startPlayback(clips, tracks, startBeat, tempo);

export const stopPlayback = () => advancedScheduler.stopPlayback();
export const stopPlaybackAndReset = () => advancedScheduler.stopPlaybackAndReset();
export const setTempo = (tempo: number) => advancedScheduler.setTempo(tempo);

// Recording control
export const startRecording = (config: any, trackId: string) => 
    recordingEngine.startRecording(config, trackId);

export const stopRecording = () => recordingEngine.stopRecording();
export const setMonitoringEnabled = (enabled: boolean) => 
    recordingEngine.setMonitoringEnabled(enabled);

// Routing control
export const initializeRouting = () => routingEngine.initialize();
export const createTrack = (track: any) => routingEngine.createTrack(track);
export const updateTrack = (trackId: string, updates: any) => 
    routingEngine.updateTrack(trackId, updates);

// Buffer management
export const addBuffer = (id: string, buffer: AudioBuffer, url?: string) => 
    bufferCacheManager.addBuffer(id, buffer, url);

export const getBuffer = (id: string) => bufferCacheManager.getBuffer(id);
export const clearCache = () => bufferCacheManager.clearCache();

// Bounce/export control
export const bounceProject: (
    clips: any[], 
    tracks: any[], 
    startBeat: number, 
    endBeat: number, 
    tempo: number, 
    config?: any
) => Promise<{ url: string; size: number }> = (clips, tracks, startBeat, endBeat, tempo, config) => 
    bounceEngine.bounceProject(clips, tracks, startBeat, endBeat, tempo, config);

// Engine initialization
export const initializeEngine = async () => {
    await initializeAudio();
    await initializeRouting();
    console.log('[AudioEngine] All modules initialized');
};