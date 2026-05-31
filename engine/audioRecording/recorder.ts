import { audioContextManager } from '../audioEngine/audioContext';
import { RecordingBufferManager } from './bufferManager';
import { createRecordingClip, addClipToTimeline, RecordingClip } from './recordingClip';
import { generateWaveformData } from './waveformAnalyzer';
import { encodeWav, downloadWav } from './wavEncoder';
import { useProjectStore } from '@/store/projectStore';

export interface RecordingConfig {
  trackId: string;
  startTime: number;
  batchSize?: number;
}

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * AudioRecorder - DAW Grade
 * Refined for zero-latency monitoring, live metering, and sample-accurate timing.
 */
export class AudioRecorder {
  private ctx: AudioContext | null = null;
  private bufferManager = new RecordingBufferManager();
  private state: RecordingState = 'idle';
  private config: RecordingConfig | null = null;
  
  // Audio Nodes
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private recorderNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private silentGain: GainNode | null = null;
  private monitorGain: GainNode | null = null;
  private stream: MediaStream | null = null;
  private onDataCallbacks: Set<(samples: Float32Array) => void> = new Set();

  // Metering
  private meterLevel = 0;
  private peakLevel = 0;
  private peakHoldTime = 0;
  private analysisBuffer: Float32Array = new Float32Array(2048);

  // Timing & Accuracy
  private recordingStartTime = 0;
  private totalSamplesRecorded = 0;
  private maxAmplitude = 0;
  private hasClipped = false;
  private isMonitoring = false;
  private isArmed = false;
  private isWorkletLoaded = false;

  constructor() {
    this.bufferManager = new RecordingBufferManager();
  }

  async initialize(): Promise<void> {
    console.log('[AudioRecorder] Initializing...');
    if (!this.ctx) {
      await audioContextManager.initialize();
      this.ctx = audioContextManager.getContext();
    }
    
    if (!this.ctx) throw new Error('[AudioRecorder] AudioContext failed to initialize. Ensure this is called from a user gesture.');
    
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn('[AudioRecorder] Failed to resume context:', e);
      }
    }

    // Worklet pre-load
    if (!this.isWorkletLoaded && this.ctx.audioWorklet) {
      try {
        // Use a relative path that works in both dev and prod
        const workletPath = '/recorder-worklet.js';
        console.log('[AudioRecorder] Loading worklet from:', workletPath);
        await this.ctx.audioWorklet.addModule(workletPath);
        this.isWorkletLoaded = true;
        console.log('[AudioRecorder] Worklet loaded successfully.');
      } catch (e) {
        console.error('[AudioRecorder] Failed to load recorder worklet. Falling back to ScriptProcessor.', e);
        this.isWorkletLoaded = false;
      }
    }
  }

  /**
   * Arm the recorder - Enables live mic input and metering without recording yet.
   */
  async arm(): Promise<void> {
    if (this.isArmed) return;
    try {
      if (!this.ctx) await this.initialize();
      const context = this.ctx!;

      if (!this.stream) {
        // Get selected device from project store
        const { globalSettings } = useProjectStore.getState();
        const selectedDevice = globalSettings.audio.inputDevice;
        
        console.log('[AudioRecorder] Accessing microphone for device:', selectedDevice);
        
        const constraints: MediaStreamConstraints = {
          audio: { 
            channelCount: 1, 
            echoCancellation: false,
            // If it looks like a deviceId (not 'None' or 'default'), use it
            ...(selectedDevice && selectedDevice !== 'None' && selectedDevice !== 'default' ? { deviceId: { exact: selectedDevice } } : {})
          }
        };

        this.stream = await audioContextManager.requestMicrophoneAccess(constraints);
      }

      // Create Nodes if they don't exist
      if (!this.sourceNode) this.sourceNode = context.createMediaStreamSource(this.stream);
      
      if (!this.analyserNode) {
        this.analyserNode = context.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.analyserNode.smoothingTimeConstant = 0.8;
        this.analysisBuffer = new Float32Array(this.analyserNode.fftSize);
      }

      if (!this.monitorGain) {
        this.monitorGain = context.createGain();
        this.monitorGain.gain.value = this.isMonitoring ? 0.8 : 0;
      }

      // Routing for Arm State
      this.sourceNode.connect(this.analyserNode);
      this.sourceNode.connect(this.monitorGain);
      this.monitorGain.connect(context.destination);

      this.isArmed = true;
      console.log("[AudioRecorder] Armed | Metering and Monitoring live");
    } catch (error) {
        console.error("[AudioRecorder] Failed to arm:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[AudioRecorder] Arming error details: ${errorMsg}`);
        throw error;
    }
  }

  /**
   * Start Recording - DAW Path logic
   */
  async start(config: RecordingConfig): Promise<void> {
    if (this.state === 'recording') return;
    
    try {
      if (!this.isArmed) await this.arm();
      const context = this.ctx!;

      this.config = config;
      this.bufferManager.clear();
      this.maxAmplitude = 0;
      this.hasClipped = false;
      this.totalSamplesRecorded = 0;

      // 3. RECORDER NODE (Processing)
      const batchSize = config.batchSize || 1024;
      if (!this.recorderNode) {
        if (this.isWorkletLoaded && context.audioWorklet) {
          try {
            this.recorderNode = new AudioWorkletNode(context, 'recorder');
            this.recorderNode.port.onmessage = (e) => this.handleMessage(e.data);
          } catch (e) {
            console.warn('[AudioRecorder] Failed to create AudioWorkletNode, using ScriptProcessor fallback:', e);
            this.recorderNode = context.createScriptProcessor(batchSize, 1, 1);
            (this.recorderNode as ScriptProcessorNode).onaudioprocess = (e) => this.handleBatch(e.inputBuffer.getChannelData(0));
          }
        } else {
          console.log('[AudioRecorder] Using ScriptProcessor for recording.');
          this.recorderNode = context.createScriptProcessor(batchSize, 1, 1);
          (this.recorderNode as ScriptProcessorNode).onaudioprocess = (e) => this.handleBatch(e.inputBuffer.getChannelData(0));
        }
      }

      if (!this.silentGain) {
        this.silentGain = context.createGain();
        this.silentGain.gain.value = 0;
      }

      // Path A: Recording (Source -> Recorder -> Silent)
      this.sourceNode!.connect(this.recorderNode);
      this.recorderNode.connect(this.silentGain);
      this.silentGain.connect(context.destination);

      if (this.recorderNode instanceof AudioWorkletNode) {
        this.recorderNode.port.postMessage({ type: 'start', config: { batchSize } });
      }

      this.recordingStartTime = context.currentTime;
      this.state = 'recording';
    } catch (err) {
      console.error('[AudioRecorder] Start failed:', err);
      this.cleanup();
      throw err;
    }
  }

  private handleMessage(data: any) {
    if (data.type === 'data') {
      this.handleBatch(data.samples);
    }
  }

  private handleBatch(samples: Float32Array) {
    if (this.state !== 'recording') return;

    // CLIPPING DETECTION
    for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i]);
        if (abs > this.maxAmplitude) this.maxAmplitude = abs;
        if (abs > 0.98 && !this.hasClipped) {
            this.hasClipped = true;
        }
    }
    
    this.totalSamplesRecorded += samples.length;
    this.bufferManager.addChunk(samples);

    // Notify listeners for Live Waveform
    this.onDataCallbacks.forEach(cb => cb(samples));
  }

  async stop(): Promise<RecordingClip | null> {
    if (this.state !== 'recording' && this.state !== 'paused') return null;

    // Stop the worklet if active
    if (this.recorderNode instanceof AudioWorkletNode) {
      this.recorderNode.port.postMessage({ type: 'stop' });
    }

    // Capture context reference before we start nulling things
    const context = this.ctx!;

    // Disconnect and null recorder nodes so the next take gets fresh ones.
    // We intentionally KEEP sourceNode / analyserNode / monitorGain alive so
    // the input meter continues working while the track stays armed.
    this.recorderNode?.disconnect();
    this.silentGain?.disconnect();
    this.recorderNode = null;
    this.silentGain = null;
    this.state = 'stopped';

    const audioBuffer = this.bufferManager.toAudioBuffer(context, 1, context.sampleRate);
    const duration = this.totalSamplesRecorded / context.sampleRate;
    
    // Latency compensation in BEATS
    const latency = (context.baseLatency || 0) + (context.outputLatency || 0);
    const { tempo } = useProjectStore.getState();
    const latencyBeats = latency * (tempo / 60);
    const compensatedStartTime = Math.max(0, (this.config?.startTime || 0) - latencyBeats);
    
    const clip = createRecordingClip({
        trackId: this.config!.trackId,
        startTime: compensatedStartTime,
        duration: duration,
        audioBuffer,
        waveform: generateWaveformData(audioBuffer, 1000),
        name: `Rec ${new Date().toLocaleTimeString()}`
    });

    addClipToTimeline(clip);
    
    return clip;
  }

  disarm() {
    this.cleanup();
    this.isArmed = false;
  }

  private cleanup() {
    this.sourceNode?.disconnect();
    this.recorderNode?.disconnect();
    this.analyserNode?.disconnect();
    this.silentGain?.disconnect();
    this.monitorGain?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.sourceNode = null;
    this.recorderNode = null;
    this.analyserNode = null;
    this.silentGain = null;
    this.monitorGain = null;
    this.bufferManager.clear();
    // We do NOT clear onDataCallbacks here to allow global listeners to survive sessions.
  }

  setMonitoring(enabled: boolean): void {
    this.isMonitoring = enabled;
    if (this.monitorGain) {
      this.monitorGain.gain.setTargetAtTime(enabled ? 0.8 : 0, this.ctx?.currentTime || 0, 0.01);
    }
  }

  getInputLevel(): number {
    if (!this.analyserNode) return 0;
    this.analyserNode.getFloatTimeDomainData(this.analysisBuffer);
    
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < this.analysisBuffer.length; i++) {
        const v = Math.abs(this.analysisBuffer[i]);
        sum += v * v;
        if (v > peak) peak = v;
    }
    const rms = Math.sqrt(sum / this.analysisBuffer.length);
    
    // DB Scale Logic (-60dB to 0dB)
    const db = rms <= 0 ? -60 : Math.max(-60, 20 * Math.log10(rms));
    
    // Convert to normalized 0-1 range for the meter (Logarithmic display)
    const normalized = (db + 60) / 60;

    // Ballistics: Fast attack (0.2), slower decay (0.95) for a responsive DAW feel
    if (normalized > this.meterLevel) {
      this.meterLevel = (this.meterLevel * 0.1) + (normalized * 0.9); // Fast Rise
    } else {
      this.meterLevel = (this.meterLevel * 0.92) + (normalized * 0.08); // Slow Decay
    }
    
    return Math.max(0, Math.min(1.0, this.meterLevel));
  }

  getInputLevelDb(): number {
    const level = this.getInputLevel();
    return level <= 0 ? -60 : Math.max(-60, 20 * Math.log10(level));
  }

  onData(cb: (samples: Float32Array) => void) {
    this.onDataCallbacks.add(cb);
    return () => this.onDataCallbacks.delete(cb);
  }

  getState(): RecordingState { return this.state; }
  getClippingStatus(): boolean { return this.hasClipped; }
}

let instance: AudioRecorder | null = null;
export function getAudioRecorder(): AudioRecorder {
  if (!instance) instance = new AudioRecorder();
  return instance;
}

export default AudioRecorder;
