/**
 * Automation Scheduler - Real-time automation playback engine
 * 
 * Responsibilities:
 * - Schedule automation value changes using Web Audio API
 * - Interpolate between points during playback
 * - Batch updates for performance
 * - Connect to transport/playback system
 * 
 * Uses Web Audio clock for sample-accurate automation
 */

import { AutomationLane, AutomationPoint, AutomationMode, AutomationModeState, CurveType } from './types';
import { ParameterBindingManager, ParameterBinding } from './parameterBinding';
import { AutomationIndex } from './indexing/AutomationIndex';
import { evaluateCurve } from './AutomationInterpolation';
import { getParameterMapping } from './AutomationParameterMap';
import { AutomationStateResolver } from './AutomationStateResolver';

// =============================================================================
// Configuration
// =============================================================================

export interface AutomationSchedulerConfig {
  lookaheadSeconds: number;    // How far ahead to schedule
  updateIntervalMs: number;      // Update interval for non-audio sync
  smoothingTimeConstant: number; // AudioParam smoothing (seconds)
  enableLogging: boolean;
}

const DEFAULT_CONFIG: AutomationSchedulerConfig = {
  lookaheadSeconds: 0.1,
  updateIntervalMs: 16, // ~60fps
  smoothingTimeConstant: 0.01,
  enableLogging: false,
};

// =============================================================================
// Scheduler State
// =============================================================================

export interface AutomationScheduleState {
  isPlaying: boolean;
  currentBeat: number;
  isRecording: boolean;
  activeModes: Map<string, AutomationModeState>; // key: "trackId.parameter"
}

// =============================================================================
// Automation Scheduler
// =============================================================================

export class AutomationScheduler {
  private audioContext: AudioContext;
  private bindingManager: ParameterBindingManager;
  private config: AutomationSchedulerConfig;
  
  // State
  private state: AutomationScheduleState = {
    isPlaying: false,
    currentBeat: 0,
    isRecording: false,
    activeModes: new Map(),
  };
  
  // Lanes and scheduling
  private lanes: Map<string, AutomationLane> = new Map();
  private lastScheduledBeat: number = 0;
  private nextScheduleTime: number = 0;
  private updateIntervalId: number | null = null;
  
  // Recording
  private recordingBuffer: Map<string, Array<{ beat: number; value: number }>> = new Map();
  private recordingStartBeat: number = 0;
  
  // Transport sync
  private tempo: number = 120;
  private beatsPerSecond: number = 2; // 120 BPM = 2 beats/sec
  private startTime: number = 0;
  private startBeat: number = 0;

  constructor(
    audioContext: AudioContext,
    bindingManager: ParameterBindingManager,
    config: Partial<AutomationSchedulerConfig> = {}
  ) {
    this.audioContext = audioContext;
    this.bindingManager = bindingManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // =============================================================================
  // Lane Management
  // =============================================================================

  addLane(lane: AutomationLane): void {
    this.lanes.set(lane.id, lane);
    this.bindingManager.createBinding(lane);
    
    // Sort points by beat
    lane.points.sort((a, b) => a.beat - b.beat);
    
    if (this.config.enableLogging) {
      console.log(`[AutomationScheduler] Added lane: ${lane.parameter}`);
    }
  }

  removeLane(laneId: string): void {
    const lane = this.lanes.get(laneId);
    if (lane) {
      this.lanes.delete(laneId);
      this.bindingManager.removeBinding(laneId);
    }
  }

  updateLane(lane: AutomationLane): void {
    this.lanes.set(lane.id, lane);
    this.bindingManager.updateBinding(lane);
    
    // Re-sort points
    lane.points.sort((a, b) => a.beat - b.beat);
    
    // Re-schedule if playing
    if (this.state.isPlaying) {
      this.scheduleLane(lane, this.state.currentBeat);
    }
  }

  getLanes(): AutomationLane[] {
    return Array.from(this.lanes.values());
  }

  getLanesForTrack(trackId: string): AutomationLane[] {
    return Array.from(this.lanes.values()).filter(lane => lane.trackId === trackId);
  }

  // =============================================================================
  // Playback Control
  // =============================================================================

  start(startBeat: number = 0, tempo: number = 120): void {
    this.state.isPlaying = true;
    this.state.currentBeat = startBeat;
    this.startBeat = startBeat;
    this.startTime = this.audioContext.currentTime;
    this.tempo = tempo;
    this.beatsPerSecond = tempo / 60;
    
    // Schedule all lanes immediately
    this.scheduleAllLanes(startBeat);
    
    // Start update loop for non-audio-synced updates
    this.startUpdateLoop();
    
    if (this.config.enableLogging) {
      console.log(`[AutomationScheduler] Started at beat ${startBeat}, tempo ${tempo}`);
    }
  }

  stop(): void {
    this.state.isPlaying = false;
    this.stopUpdateLoop();
    
    if (this.config.enableLogging) {
      console.log('[AutomationScheduler] Stopped');
    }
  }

  pause(): void {
    this.state.isPlaying = false;
    this.stopUpdateLoop();
    this.holdCurrentValues();
  }

  seek(beat: number): void {
    this.state.currentBeat = beat;
    this.startBeat = beat;
    this.startTime = this.audioContext.currentTime - (beat / this.beatsPerSecond);
    
    if (this.state.isPlaying) {
      // Seek-safe execution: Resolve state immediately and cancel old ramps
      this.applyAllLanesAtBeat(beat);
      this.scheduleAllLanes(beat);
    } else {
      // Apply values immediately at seek position
      this.applyAllLanesAtBeat(beat);
    }
  }

  setTempo(tempo: number): void {
    const oldBeatsPerSecond = this.beatsPerSecond;
    this.tempo = tempo;
    this.beatsPerSecond = tempo / 60;
    
    // Adjust start time to maintain current beat position
    const elapsedBeats = (this.audioContext.currentTime - this.startTime) * oldBeatsPerSecond;
    this.startBeat = this.state.currentBeat - elapsedBeats;
    this.startTime = this.audioContext.currentTime;
  }

  // =============================================================================
  // Scheduling
  // =============================================================================

  private scheduleAllLanes(fromBeat: number): void {
    const lanesArray = Array.from(this.lanes.values());
    for (const lane of lanesArray) {
      this.scheduleLane(lane, fromBeat);
    }
    
    this.lastScheduledBeat = fromBeat + (this.config.lookaheadSeconds * this.beatsPerSecond);
  }

  private scheduleLane(lane: AutomationLane, fromBeat: number): void {
    const currentTime = this.audioContext.currentTime;
    const endTime = currentTime + this.config.lookaheadSeconds;
    this.scheduleLaneRange(lane, fromBeat, endTime);
  }

  private scheduleLaneRange(
    lane: AutomationLane,
    fromBeat: number,
    endTime: number
  ): void {
    const binding = this.bindingManager.getBinding(lane.id);
    if (!binding || !binding.audioParam) return;
    
    const points = lane.points;
    const mapFn = getParameterMapping(lane.parameter);

    if (points.length === 0) {
      const mappedValue = mapFn(lane.defaultValue);
      binding.audioParam.setValueAtTime(mappedValue, this.audioContext.currentTime);
      return;
    }
    
    const endBeat = fromBeat + ((endTime - this.audioContext.currentTime) * this.beatsPerSecond);
    
    // Use O(log n) index to find points
    const index = new AutomationIndex(points);
    const [entryFloor] = index.findSegmentAtTime(fromBeat);
    const [, exitCeil] = index.findSegmentAtTime(endBeat);

    const startIndex = entryFloor ? points.indexOf(entryFloor) : 0;
    const endIndex = exitCeil ? points.indexOf(exitCeil) : points.length - 1;

    // Schedule value changes
    for (let i = startIndex; i < endIndex; i++) {
      const currentPoint = points[i];
      const nextPoint = points[i + 1];
      
      const pointTime = this.beatToTime(currentPoint.beat);
      
      if (pointTime >= this.audioContext.currentTime) {
        this.scheduleCurveSegment(
          binding,
          lane,
          currentPoint,
          nextPoint,
          pointTime
        );
      }
    }
  }

  private scheduleCurveSegment(
    binding: ParameterBinding,
    lane: AutomationLane,
    pointA: AutomationPoint,
    pointB: AutomationPoint,
    startTime: number
  ): void {
    if (!binding.audioParam) return;
    
    const endTime = this.beatToTime(pointB.beat);
    const duration = endTime - startTime;
    const mapFn = getParameterMapping(lane.parameter);
    
    if (duration <= 0) return;
    
    if (pointA.curve === 'hold') {
      const value = mapFn(pointA.value);
      binding.audioParam.setValueAtTime(value, startTime);
      return;
    }
    
    if (pointA.curve === 'linear') {
      const startMapped = mapFn(pointA.value);
      const endMapped = mapFn(pointB.value);
      binding.audioParam.setValueAtTime(startMapped, startTime);
      binding.audioParam.linearRampToValueAtTime(endMapped, endTime);
      return;
    }

    // For other curves, schedule multiple points for smoothness
    const numSteps = Math.max(2, Math.ceil(duration * 10)); // 10 points per second
    const stepDuration = duration / (numSteps - 1);
    
    for (let i = 0; i < numSteps; i++) {
      const t = i / (numSteps - 1);
      const beat = pointA.beat + (pointB.beat - pointA.beat) * t;
      const value = evaluateCurve(pointA, pointB, beat);
      const mappedValue = mapFn(value);
      const time = startTime + (i * stepDuration);
      
      if (i === 0) {
        binding.audioParam.setValueAtTime(mappedValue, time);
      } else {
        binding.audioParam.linearRampToValueAtTime(mappedValue, time);
      }
    }
  }

  private beatToTime(beat: number): number {
    return this.startTime + ((beat - this.startBeat) / this.beatsPerSecond);
  }

  private timeToBeat(time: number): number {
    return this.startBeat + ((time - this.startTime) * this.beatsPerSecond);
  }

  // =============================================================================
  // Update Loop (for UI sync and non-audio parameters)
  // =============================================================================

  private startUpdateLoop(): void {
    if (this.updateIntervalId !== null) return;
    
    this.updateIntervalId = window.setInterval(() => {
      this.update();
    }, this.config.updateIntervalMs);
  }

  private stopUpdateLoop(): void {
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  private update(): void {
    if (!this.state.isPlaying) return;
    
    const currentTime = this.audioContext.currentTime;
    this.state.currentBeat = this.timeToBeat(currentTime);
    
    const scheduleThreshold = this.lastScheduledBeat - (this.config.lookaheadSeconds * this.beatsPerSecond);
    if (this.state.currentBeat > scheduleThreshold) {
      this.scheduleAllLanes(this.state.currentBeat);
    }
    
    if (this.state.isRecording) {
      this.processRecording();
    }
  }

  // =============================================================================
  // Recording
  // =============================================================================

  setAutomationMode(trackId: string, parameter: string, mode: AutomationMode): void {
    const key = `${trackId}.${parameter}`;
    const existingMode = this.state.activeModes.get(key);
    
    if (existingMode) {
      existingMode.mode = mode;
    } else {
      this.state.activeModes.set(key, {
        mode,
        trackId,
        parameter,
        isWriting: false,
      });
    }
  }

  startRecording(): void {
    this.state.isRecording = true;
    this.recordingStartBeat = this.state.currentBeat;
    this.recordingBuffer.clear();
    
    for (const [key, modeState] of Array.from(this.state.activeModes.entries())) {
      if (modeState.mode !== 'read') {
        modeState.isWriting = true;
        modeState.writeStartBeat = this.state.currentBeat;
        this.recordingBuffer.set(key, []);
      }
    }
  }

  stopRecording(): Promise<AutomationLane[]> {
    this.state.isRecording = false;
    const updatedLanes: AutomationLane[] = [];
    
    for (const [key, points] of Array.from(this.recordingBuffer.entries())) {
      const modeState = this.state.activeModes.get(key);
      if (!modeState || points.length === 0) continue;
      
      const lane = Array.from(this.lanes.values()).find(
        l => l.trackId === modeState.trackId && l.parameter === modeState.parameter
      );
      
      if (lane) {
        this.mergeRecordedPoints(lane, points);
        updatedLanes.push(lane);
      }
      modeState.isWriting = false;
    }
    
    this.recordingBuffer.clear();
    return Promise.resolve(updatedLanes);
  }

  private processRecording(): void {
    const currentBeat = this.state.currentBeat;
    
    for (const [key, modeState] of Array.from(this.state.activeModes.entries())) {
      if (!modeState.isWriting || modeState.mode === 'read') continue;
      
      const binding = this.bindingManager.getBinding(
        Array.from(this.lanes.values()).find(
          l => l.trackId === modeState.trackId && l.parameter === modeState.parameter
        )?.id || ''
      );
      
      if (!binding) continue;
      
      const currentValue = binding.lastValue;
      const buffer = this.recordingBuffer.get(key);
      if (buffer) {
        const lastPoint = buffer[buffer.length - 1];
        if (!lastPoint || Math.abs(lastPoint.value - currentValue) > 0.001) {
          buffer.push({ beat: currentBeat, value: currentValue });
        }
      }
    }
  }

  recordValue(trackId: string, parameter: string, value: number): void {
    const key = `${trackId}.${parameter}`;
    const modeState = this.state.activeModes.get(key);
    
    if (!modeState || modeState.mode === 'read') return;
    
    if (modeState.mode === 'touch' || modeState.mode === 'write') {
      const buffer = this.recordingBuffer.get(key);
      if (buffer) {
        buffer.push({ beat: this.state.currentBeat, value });
      }
    }
  }

  private mergeRecordedPoints(
    lane: AutomationLane,
    recordedPoints: Array<{ beat: number; value: number }>
  ): void {
    const newPoints: AutomationPoint[] = recordedPoints.map((rp, index) => ({
      id: `recorded-${Date.now()}-${index}`,
      beat: rp.beat,
      value: this.mapToAutomationValue(lane, rp.value),
      curve: index < recordedPoints.length - 1 ? 'linear' : 'hold',
    }));
    
    const startBeat = newPoints[0]?.beat ?? 0;
    const endBeat = newPoints[newPoints.length - 1]?.beat ?? startBeat;
    
    lane.points = lane.points.filter(p => p.beat < startBeat || p.beat > endBeat);
    lane.points.push(...newPoints);
    lane.points.sort((a, b) => a.beat - b.beat);
    
    this.updateLane(lane);
  }

  private mapToAutomationValue(lane: AutomationLane, parameterValue: number): number {
    const path = lane.parameter;
    
    if (path.endsWith('.volume')) {
      const db = 20 * Math.log10(Math.max(parameterValue, 0.0001));
      return Math.max(0, Math.min(1, (db + 60) / 72));
    }
    
    if (path.endsWith('.pan')) {
      return (parameterValue + 1) / 2;
    }
    
    return (parameterValue - lane.min) / (lane.max - lane.min);
  }

  // =============================================================================
  // Immediate Value Application
  // =============================================================================

  private applyAllLanesAtBeat(beat: number): void {
    const lanesArray = Array.from(this.lanes.values());
    
    // 1. Resolve immediate exact state at T using Resolver
    const resolvedState = AutomationStateResolver.resolveStateAtBeat(lanesArray, beat);

    for (const lane of lanesArray) {
      const binding = this.bindingManager.getBinding(lane.id);
      if (!binding || !binding.audioParam) continue;
      
      const key = `${lane.trackId}.${lane.parameter}`;
      const value = resolvedState[key];
      
      // Cancel previous scheduled values to ensure seek safety
      binding.audioParam.cancelScheduledValues(this.audioContext.currentTime);

      if (value !== undefined) {
        binding.audioParam.setValueAtTime(value, this.audioContext.currentTime);
        binding.lastValue = value;
      }
    }
  }

  private holdCurrentValues(): void {
    // Values are already held by the audio parameter's current value
    const lanesArray = Array.from(this.lanes.values());
    for (const lane of lanesArray) {
      const binding = this.bindingManager.getBinding(lane.id);
      if (!binding || !binding.audioParam) continue;
      binding.audioParam.cancelScheduledValues(this.audioContext.currentTime);
      binding.audioParam.setValueAtTime(binding.audioParam.value, this.audioContext.currentTime);
    }
  }

  // =============================================================================
  // Getters
  // =============================================================================

  getCurrentBeat(): number {
    return this.state.currentBeat;
  }

  isPlaying(): boolean {
    return this.state.isPlaying;
  }

  isRecording(): boolean {
    return this.state.isRecording;
  }

  getAutomationMode(trackId: string, parameter: string): AutomationMode | null {
    const key = `${trackId}.${parameter}`;
    return this.state.activeModes.get(key)?.mode || null;
  }

  // =============================================================================
  // Cleanup
  // =============================================================================

  dispose(): void {
    this.stop();
    this.stopRecording();
    this.lanes.clear();
    this.recordingBuffer.clear();
    this.state.activeModes.clear();
  }
}

export function createAutomationScheduler(
  audioContext: AudioContext,
  bindingManager: ParameterBindingManager,
  config?: Partial<AutomationSchedulerConfig>
): AutomationScheduler {
  return new AutomationScheduler(audioContext, bindingManager, config);
}
