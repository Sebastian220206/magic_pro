/**
 * Automation Integration - Connect automation system to mixer and audio engine
 * 
 * Responsibilities:
 * - Register mixer parameters for automation
 * - Connect automation scheduler to transport
 * - Handle automation modes (read, write, touch, latch)
 * - Coordinate between UI, store, and audio engine
 */

import { AutomationScheduler } from './automationScheduler';
import { ParameterRegistry, ParameterBindingManager, createParameterRegistry, createParameterBindingManager } from './parameterBinding';
import { AutomationLane, AutomationMode } from './types';

// =============================================================================
// Automation Integration
// =============================================================================

export interface AutomationIntegrationConfig {
  audioContext: AudioContext;
  onLaneChange?: (lane: AutomationLane) => void;
  onModeChange?: (trackId: string, parameter: string, mode: AutomationMode) => void;
}

export class AutomationIntegration {
  private audioContext: AudioContext;
  private registry: ParameterRegistry;
  private bindingManager: ParameterBindingManager;
  private scheduler: AutomationScheduler;
  private config: AutomationIntegrationConfig;

  constructor(config: AutomationIntegrationConfig) {
    this.config = config;
    this.audioContext = config.audioContext;
    
    // Create parameter system
    this.registry = createParameterRegistry();
    this.bindingManager = createParameterBindingManager(this.registry);
    
    // Create scheduler
    this.scheduler = new AutomationScheduler(this.audioContext, this.bindingManager);
  }

  // =============================================================================
  // Parameter Registration
  // =============================================================================

  /**
   * Register a track volume parameter
   */
  registerTrackVolume(trackId: string, gainNode: { gain: AudioParam }): void {
    const path = `track.${trackId}.volume`;
    this.registry.registerParameter(path, gainNode.gain, 0, 2, {
      displayName: 'Volume',
    });
  }

  /**
   * Register a track pan parameter
   */
  registerTrackPan(trackId: string, pannerNode: { pan: AudioParam }): void {
    const path = `track.${trackId}.pan`;
    this.registry.registerParameter(path, pannerNode.pan, -1, 1, {
      displayName: 'Pan',
    });
  }

  /**
   * Register a plugin parameter
   */
  registerPluginParameter(
    trackId: string,
    pluginId: string,
    parameterId: string,
    audioParam: AudioParam,
    min: number,
    max: number,
    options: { displayName?: string; logarithmic?: boolean } = {}
  ): void {
    const path = `plugin.${trackId}.${pluginId}.${parameterId}`;
    this.registry.registerParameter(path, audioParam, min, max, options);
  }

  /**
   * Register an instrument parameter
   */
  registerInstrumentParameter(
    trackId: string,
    parameterId: string,
    audioParam: AudioParam,
    min: number,
    max: number,
    options: { displayName?: string; logarithmic?: boolean } = {}
  ): void {
    const path = `instrument.${trackId}.${parameterId}`;
    this.registry.registerParameter(path, audioParam, min, max, options);
  }

  /**
   * Register a send level parameter
   */
  registerSendLevel(
    trackId: string,
    sendId: string,
    gainNode: { gain: AudioParam }
  ): void {
    const path = `send.${trackId}.${sendId}.level`;
    this.registry.registerParameter(path, gainNode.gain, 0, 1, {
      displayName: 'Send Level',
    });
  }

  /**
   * Register master volume
   */
  registerMasterVolume(gainNode: { gain: AudioParam }): void {
    this.registry.registerParameter('master.volume', gainNode.gain, 0, 2, {
      displayName: 'Master Volume',
    });
  }

  // =============================================================================
  // Lane Management
  // =============================================================================

  /**
   * Add an automation lane to the scheduler
   */
  addAutomationLane(lane: AutomationLane): void {
    this.scheduler.addLane(lane);
    
    // Create binding if parameter exists
    if (this.registry.hasParameter(lane.parameter)) {
      this.bindingManager.createBinding(lane);
    }
  }

  /**
   * Update an automation lane
   */
  updateAutomationLane(lane: AutomationLane): void {
    this.scheduler.updateLane(lane);
    this.config.onLaneChange?.(lane);
  }

  /**
   * Remove an automation lane
   */
  removeAutomationLane(laneId: string): void {
    this.scheduler.removeLane(laneId);
  }

  /**
   * Get all registered lanes
   */
  getAutomationLanes(): AutomationLane[] {
    return this.scheduler.getLanes();
  }

  // =============================================================================
  // Transport Control
  // =============================================================================

  /**
   * Start automation playback
   */
  start(startBeat: number = 0, tempo: number = 120): void {
    this.scheduler.start(startBeat, tempo);
  }

  /**
   * Stop automation playback
   */
  stop(): void {
    this.scheduler.stop();
  }

  /**
   * Pause automation
   */
  pause(): void {
    this.scheduler.pause();
  }

  /**
   * Seek to beat
   */
  seek(beat: number): void {
    this.scheduler.seek(beat);
  }

  /**
   * Set tempo
   */
  setTempo(tempo: number): void {
    this.scheduler.setTempo(tempo);
  }

  // =============================================================================
  // Recording
  // =============================================================================

  /**
   * Set automation mode for a parameter
   */
  setAutomationMode(
    trackId: string,
    parameter: string,
    mode: AutomationMode
  ): void {
    this.scheduler.setAutomationMode(trackId, parameter, mode);
    this.config.onModeChange?.(trackId, parameter, mode);
  }

  /**
   * Start recording automation
   */
  startRecording(): void {
    this.scheduler.startRecording();
  }

  /**
   * Stop recording and get updated lanes
   */
  async stopRecording(): Promise<AutomationLane[]> {
    return this.scheduler.stopRecording();
  }

  /**
   * Check if recording
   */
  isRecording(): boolean {
    return this.scheduler.isRecording();
  }

  // =============================================================================
  // Current Value
  // =============================================================================

  /**
   * Get current automation value at beat for a lane
   */
  getValueAtBeat(laneId: string, beat: number): number {
    const lane = this.scheduler.getLanes().find(l => l.id === laneId);
    if (!lane) return 0;
    
    return this.bindingManager.getCurrentValue(lane, beat);
  }

  // =============================================================================
  // Cleanup
  // =============================================================================

  dispose(): void {
    this.scheduler.dispose();
    this.bindingManager.dispose();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createAutomationIntegration(
  config: AutomationIntegrationConfig
): AutomationIntegration {
  return new AutomationIntegration(config);
}

export default AutomationIntegration;
