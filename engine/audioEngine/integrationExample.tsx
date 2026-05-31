/**
 * integrationExample.ts
 * Complete integration example for the advanced audio engine.
 * 
 * This file demonstrates how to use all engine modules together
 * in a React component for timeline playback.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
    initializeEngine, 
    startPlayback, 
    stopPlayback, 
    setTempo,
    startRecording,
    stopRecording,
    createTrack,
    updateTrack,
    addBuffer,
    getBuffer,
    bounceProject
} from './index';

import { 
    AudioClip, 
    AudioTrack, 
    RecordingConfig,
    BounceConfig 
} from './types';

// ─── Example Audio Engine Hook ──────────────────────────────────────────────────────

export function useAdvancedAudioEngine() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [tempo, setTempoState] = useState(120);
    const [currentTime, setCurrentTime] = useState(0);
    
    const clipsRef = useRef<AudioClip[]>([]);
    const tracksRef = useRef<AudioTrack[]>([]);

    // Initialize engine
    useEffect(() => {
        const initEngine = async () => {
            try {
                await initializeEngine();
                setIsInitialized(true);
                console.log('[AudioEngine] Engine initialized successfully');
            } catch (error) {
                console.error('[AudioEngine] Failed to initialize engine:', error);
            }
        };

        initEngine();
    }, []);

    // Playback control
    const startPlaybackCallback = useCallback(async (clips: AudioClip[], tracks: AudioTrack[], startBeat = 0) => {
        try {
            clipsRef.current = clips;
            tracksRef.current = tracks;
            
            // Preload buffers
            for (const clip of clips) {
                if (clip.buffer) {
                    addBuffer(clip.id, clip.buffer, clip.url);
                }
            }
            
            // Create tracks in routing engine
            for (const track of tracks) {
                createTrack(track);
            }
            
            await startPlayback(clips, tracks, startBeat, tempo);
            setIsPlaying(true);
            
            console.log('[AudioEngine] Playback started');
        } catch (error) {
            console.error('[AudioEngine] Failed to start playback:', error);
        }
    }, [tempo]);

    const stopPlaybackCallback = useCallback(() => {
        stopPlayback();
        setIsPlaying(false);
        console.log('[AudioEngine] Playback stopped');
    }, []);

    const setTempoCallback = useCallback((newTempo: number) => {
        setTempo(newTempo);
        setTempoState(newTempo);
        setTempo(newTempo);
    }, []);

    // Recording control
    const startRecordingCallback = useCallback(async (trackId: string, config?: RecordingConfig) => {
        try {
            const recordingConfig: RecordingConfig = {
                channels: 2,
                sampleRate: 48000,
                bufferSize: 4096,
                monitorInput: true,
                autoCreateClip: true,
                ...config
            };
            
            await startRecording(recordingConfig, trackId);
            setIsRecording(true);
            
            console.log('[AudioEngine] Recording started on track:', trackId);
        } catch (error) {
            console.error('[AudioEngine] Failed to start recording:', error);
        }
    }, []);

    const stopRecordingCallback = useCallback(() => {
        stopRecording();
        setIsRecording(false);
        console.log('[AudioEngine] Recording stopped');
    }, []);

    // Bounce/export control
    const bounceProjectCallback = useCallback(async (
        clips: AudioClip[], 
        tracks: AudioTrack[], 
        startBeat: number, 
        endBeat: number, 
        config?: BounceConfig
    ) => {
        try {
            const result = await bounceProject(clips, tracks, startBeat, endBeat, tempo, config);
            
            // Create download link
            const link = document.createElement('a');
            link.href = result.url;
            link.download = `project-bounce-${Date.now()}.${config?.format || 'wav'}`;
            link.click();
            
            console.log('[AudioEngine] Project bounced:', result);
            return result;
        } catch (error) {
            console.error('[AudioEngine] Failed to bounce project:', error);
            throw error;
        }
    }, [tempo]);

    return {
        // State
        isInitialized,
        isPlaying,
        isRecording,
        tempo,
        currentTime,
        
        // Playback controls
        startPlayback: startPlaybackCallback,
        stopPlayback: stopPlaybackCallback,
        setTempo: setTempoCallback,
        
        // Recording controls
        startRecording: startRecordingCallback,
        stopRecording: stopRecordingCallback,
        
        // Export controls
        bounceProject: bounceProjectCallback,
        
        // Utilities
        addBuffer,
        getBuffer,
        createTrack,
        updateTrack
    };
}

// ─── Example Component Usage ──────────────────────────────────────────────────────

export function AudioEngineExample() {
    const {
        isInitialized,
        isPlaying,
        isRecording,
        tempo,
        startPlayback,
        stopPlayback,
        setTempo,
        startRecording,
        stopRecording,
        bounceProject
    } = useAdvancedAudioEngine();

    // Example data
    const exampleTracks: AudioTrack[] = [
        {
            id: 'track-1',
            name: 'Audio Track 1',
            volume: 0.8,
            pan: 0,
            muted: false,
            solo: false,
            armed: false,
            type: 'audio',
            effects: [],
            sends: []
        }
    ];

    const exampleClips: AudioClip[] = [
        {
            id: 'clip-1',
            name: 'Example Audio',
            startBeat: 0,
            duration: 4,
            trackId: 'track-1',
            pitchShift: 0,
            timeStretch: 1,
            volume: 1,
            pan: 0,
            muted: false,
            loop: false,
            buffer: undefined // Would be loaded from file
        }
    ];

    const handleStartPlayback = () => {
        if (isInitialized) {
            startPlayback(exampleClips, exampleTracks, 0);
        }
    };

    const handleStopPlayback = () => {
        stopPlayback();
    };

    const handleTempoChange = (newTempo: number) => {
        setTempo(newTempo);
    };

    const handleStartRecording = () => {
        startRecording('track-1');
    };

    const handleStopRecording = () => {
        stopRecording();
    };

    const handleBounceProject = () => {
        bounceProject(exampleClips, exampleTracks, 0, 8, {
            format: 'wav',
            bitDepth: 24,
            normalize: true,
            dither: true
        });
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
            <h2>Advanced Audio Engine Example</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <h3>Engine Status</h3>
                <p>Initialized: {isInitialized ? '✅' : '❌'}</p>
                <p>Playing: {isPlaying ? '🔊' : '⏹️'}</p>
                <p>Recording: {isRecording ? '🔴' : '⏹️'}</p>
                <p>Tempo: {tempo} BPM</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3>Playback Controls</h3>
                <button 
                    onClick={handleStartPlayback} 
                    disabled={!isInitialized || isPlaying}
                    style={{ marginRight: '10px', padding: '10px' }}
                >
                    Start Playback
                </button>
                <button 
                    onClick={handleStopPlayback} 
                    disabled={!isPlaying}
                    style={{ marginRight: '10px', padding: '10px' }}
                >
                    Stop Playback
                </button>
                <input 
                    type="number" 
                    value={tempo} 
                    onChange={(e) => handleTempoChange(Number(e.target.value))}
                    min="60" 
                    max="200" 
                    style={{ marginRight: '10px', padding: '10px' }}
                />
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3>Recording Controls</h3>
                <button 
                    onClick={handleStartRecording} 
                    disabled={!isInitialized || isRecording}
                    style={{ marginRight: '10px', padding: '10px' }}
                >
                    Start Recording
                </button>
                <button 
                    onClick={handleStopRecording} 
                    disabled={!isRecording}
                    style={{ marginRight: '10px', padding: '10px' }}
                >
                    Stop Recording
                </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3>Export Controls</h3>
                <button 
                    onClick={handleBounceProject}
                    disabled={!isInitialized}
                    style={{ padding: '10px' }}
                >
                    Bounce Project (WAV)
                </button>
            </div>

            <div style={{ marginTop: '30px', fontSize: '12px', color: '#666' }}>
                <h4>Features Demonstrated:</h4>
                <ul>
                    <li>✅ Low-latency scheduling with lookahead</li>
                    <li>✅ Audio recording with monitoring</li>
                    <li>✅ Flexible audio routing (tracks, buses, effects)</li>
                    <li>✅ Intelligent buffer caching</li>
                    <li>✅ Offline bounce with multiple formats</li>
                    <li>✅ Time stretching and pitch shifting</li>
                    <li>✅ Real-time progress reporting</li>
                    <li>✅ Memory management and cleanup</li>
                </ul>
            </div>
        </div>
    );
}

// ─── Integration with Existing Store ──────────────────────────────────────────────────────

/**
 * Example of how to integrate the advanced audio engine
 * with an existing Zustand store.
 */
export function integrateWithStore(store: any) {
    return {
        // Initialize engine when store is ready
        initializeEngine: async () => {
            await initializeEngine();
            console.log('[AudioEngine] Integrated with store');
        },

        // Playback methods
        startPlayback: async () => {
            const { clips, tracks, playhead, tempo } = store.getState();
            await startPlayback(clips, tracks, playhead, tempo);
            store.setState({ playing: true });
        },

        stopPlayback: () => {
            stopPlayback();
            store.setState({ playing: false });
        },

        // Recording methods
        startRecording: async (trackId: string) => {
            const recording = await startRecording(trackId, {
                monitorInput: true,
                autoCreateClip: true
            });
            store.setState({ recording });
            return recording;
        },

        stopRecording: () => {
            stopRecording();
            store.setState({ recording: null });
        },

        // Export methods
        bounceProject: async () => {
            const { clips, tracks, tempo } = store.getState();
            const result = await bounceProject(clips, tracks, 0, 32, tempo);
            return result;
        }
    };
}
