/**
 * Parameter Binding - Connect automation to audio parameters
 * 
 * Responsibilities:
 * - Map automation lanes to AudioParam nodes
 * - Handle track parameters (volume, pan, mute)
 * - Handle plugin parameters
 * - Handle instrument parameters
 * - Support for send levels
 */

import { AutomationLane, ParameterPath, parseParameterPath, buildParameterPath, ParameterTarget } from './types';
import { getValueAtBeat, mapToParameterRange, normalizedToVolumeDb, dbToGain, normalizedToPan } from './curves';

// =============================================================================
// Parameter Binding Interface
// =============================================================================

export interface ParameterBinding {
  laneId: string;
  parameter: string;
  audioParam: AudioParam | null;
  target: ParameterTarget;
  trackId: string;
  pluginId?: string;
  lastValue: number;
  isConnected: boolean;
}

export interface ParameterValue {
  laneId: string;
  parameter: string;
  value: number;        // Raw value in parameter range
  normalizedValue: number; // 0-1 range
  beat: number;
}

// =============================================================================
// Parameter Registry
// =============================================================================

export interface RegisteredParameter {
  path: string;
  audioParam: AudioParam;
  min: number;
  max: number;
  logarithmic: boolean;
  displayName: string;
}

export class ParameterRegistry {
  private parameters: Map<string, RegisteredParameter> = new Map();
  private trackParams: Map<string, Map<string, AudioParam>> = new Map();
  private pluginParams: Map<string, Map<string, AudioParam>> = new Map();
  private masterParams: Map<string, AudioParam> = new Map();

  /**
   * Register a parameter for automation
   */
  registerParameter(
    path: string,
    audioParam: AudioParam,
    min: number,
    max: number,
    options: { logarithmic?: boolean; displayName?: string } = {}
  ): void {
    this.parameters.set(path, {
      path,
      audioParam,
      min,
      max,
      logarithmic: options.logarithmic || false,
      displayName: options.displayName || path,
    });

    // Store in category maps for quick lookup
    const parsed = parseParameterPath(path);
    if (parsed) {
      if (parsed.target === 'track' && parsed.trackId) {
        if (!this.trackParams.has(parsed.trackId)) {
          this.trackParams.set(parsed.trackId, new Map());
        }
        this.trackParams.get(parsed.trackId)!.set(parsed.parameterId, audioParam);
      } else if (parsed.target === 'plugin' && parsed.trackId && parsed.pluginId) {
        const key = `${parsed.trackId}.${parsed.pluginId}`;
        if (!this.pluginParams.has(key)) {
          this.pluginParams.set(key, new Map());
        }
        this.pluginParams.get(key)!.set(parsed.parameterId, audioParam);
      } else if (parsed.target === 'master') {
        this.masterParams.set(parsed.parameterId, audioParam);
      }
    }
  }

  /**
   * Unregister a parameter
   */
  unregisterParameter(path: string): void {
    this.parameters.delete(path);
    
    // Clean up category maps
    const parsed = parseParameterPath(path);
    if (parsed) {
      if (parsed.target === 'track' && parsed.trackId) {
        const trackMap = this.trackParams.get(parsed.trackId);
        if (trackMap) {
          trackMap.delete(parsed.parameterId);
          if (trackMap.size === 0) {
            this.trackParams.delete(parsed.trackId);
          }
        }
      } else if (parsed.target === 'plugin' && parsed.trackId && parsed.pluginId) {
        const key = `${parsed.trackId}.${parsed.pluginId}`;
        const pluginMap = this.pluginParams.get(key);
        if (pluginMap) {
          pluginMap.delete(parsed.parameterId);
          if (pluginMap.size === 0) {
            this.pluginParams.delete(key);
          }
        }
      } else if (parsed.target === 'master') {
        this.masterParams.delete(parsed.parameterId);
      }
    }
  }

  /**
   * Get registered parameter info
   */
  getParameter(path: string): RegisteredParameter | undefined {
    return this.parameters.get(path);
  }

  /**
   * Get AudioParam by path
   */
  getAudioParam(path: string): AudioParam | undefined {
    return this.parameters.get(path)?.audioParam;
  }

  /**
   * Get track parameters
   */
  getTrackParameters(trackId: string): Map<string, AudioParam> | undefined {
    return this.trackParams.get(trackId);
  }

  /**
   * Get plugin parameters
   */
  getPluginParameters(trackId: string, pluginId: string): Map<string, AudioParam> | undefined {
    return this.pluginParams.get(`${trackId}.${pluginId}`);
  }

  /**
   * Get master parameters
   */
  getMasterParameters(): Map<string, AudioParam> {
    return this.masterParams;
  }

  /**
   * Get all registered parameter paths
   */
  getAllPaths(): string[] {
    return Array.from(this.parameters.keys());
  }

  /**
   * Get parameters for a specific target
   */
  getParametersByTarget(target: ParameterTarget, trackId?: string): string[] {
    return this.getAllPaths().filter(path => {
      const parsed = parseParameterPath(path);
      if (!parsed) return false;
      if (parsed.target !== target) return false;
      if (trackId && parsed.trackId !== trackId) return false;
      return true;
    });
  }

  /**
   * Check if parameter exists
   */
  hasParameter(path: string): boolean {
    return this.parameters.has(path);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.parameters.clear();
    this.trackParams.clear();
    this.pluginParams.clear();
    this.masterParams.clear();
  }
}

// =============================================================================
// Parameter Binding Manager
// =============================================================================

export class ParameterBindingManager {
  private registry: ParameterRegistry;
  private bindings: Map<string, ParameterBinding> = new Map();
  private lastUpdateTime: number = 0;
  private batchUpdates: Map<string, { value: number; audioParam: AudioParam }> = new Map();

  constructor(registry: ParameterRegistry) {
    this.registry = registry;
  }

  /**
   * Create a binding between an automation lane and an audio parameter
   */
  createBinding(lane: AutomationLane): ParameterBinding | null {
    const parameter = this.registry.getParameter(lane.parameter);
    
    if (!parameter) {
      console.warn(`Parameter not found: ${lane.parameter}`);
      return null;
    }

    const parsed = parseParameterPath(lane.parameter);
    if (!parsed) return null;

    const binding: ParameterBinding = {
      laneId: lane.id,
      parameter: lane.parameter,
      audioParam: parameter.audioParam,
      target: parsed.target,
      trackId: parsed.trackId || '',
      pluginId: parsed.pluginId,
      lastValue: lane.defaultValue,
      isConnected: true,
    };

    this.bindings.set(lane.id, binding);
    return binding;
  }

  /**
   * Remove a binding
   */
  removeBinding(laneId: string): void {
    const binding = this.bindings.get(laneId);
    if (binding) {
      // Reset to default if needed
      this.bindings.delete(laneId);
    }
  }

  /**
   * Get binding for a lane
   */
  getBinding(laneId: string): ParameterBinding | undefined {
    return this.bindings.get(laneId);
  }

  /**
   * Check if lane has a binding
   */
  hasBinding(laneId: string): boolean {
    return this.bindings.has(laneId);
  }

  /**
   * Update a binding when lane changes
   */
  updateBinding(lane: AutomationLane): void {
    const existing = this.bindings.get(lane.id);
    if (existing) {
      // Re-check if parameter still exists
      const param = this.registry.getParameter(lane.parameter);
      if (param) {
        existing.audioParam = param.audioParam;
        existing.parameter = lane.parameter;
      }
    }
  }

  /**
   * Evaluate automation and apply to parameter at specific beat
   * Uses Web Audio scheduling for smooth transitions
   */
  evaluateAndApply(
    lane: AutomationLane,
    beat: number,
    audioTime: number,
    timeConstant: number = 0.01
  ): number {
    const binding = this.bindings.get(lane.id);
    if (!binding || !binding.isConnected || !binding.audioParam) {
      return lane.defaultValue;
    }

    // Get normalized value from automation
    const normalizedValue = getValueAtBeat(lane.points, beat, 
      mapToParameterRange(lane.defaultValue, lane.min, lane.max, false));

    // Convert to parameter range
    const param = this.registry.getParameter(lane.parameter);
    let value = mapToParameterRange(
      normalizedValue,
      lane.min,
      lane.max,
      param?.logarithmic || false
    );

    // Special handling for volume (convert dB to gain)
    const parsed = parseParameterPath(lane.parameter);
    if (parsed?.parameterId === 'volume') {
      const db = normalizedToVolumeDb(normalizedValue);
      value = dbToGain(db);
    }

    // Special handling for pan
    if (parsed?.parameterId === 'pan') {
      value = normalizedToPan(normalizedValue);
    }

    // Schedule value change using Web Audio API
    // This ensures sample-accurate automation
    if (audioTime >= this.lastUpdateTime) {
      this.scheduleValueChange(binding.audioParam, value, audioTime, timeConstant);
    }

    binding.lastValue = value;
    return value;
  }

  /**
   * Schedule a value change on an AudioParam
   */
  private scheduleValueChange(
    param: AudioParam,
    value: number,
    time: number,
    timeConstant: number
  ): void {
    // Use setTargetAtTime for smooth transitions
    // or setValueAtTime for immediate changes
    param.setTargetAtTime(value, time, timeConstant);
  }

  /**
   * Batch evaluate and apply automation for multiple lanes
   * More efficient than individual evaluations
   */
  batchEvaluateAndApply(
    lanes: AutomationLane[],
    beat: number,
    audioTime: number
  ): Map<string, number> {
    const results = new Map<string, number>();
    
    // Clear previous batch
    this.batchUpdates.clear();

    for (const lane of lanes) {
      const value = this.evaluateAndApply(lane, beat, audioTime);
      results.set(lane.id, value);
    }

    return results;
  }

  /**
   * Apply a single automation value immediately (for recording)
   */
  applyImmediate(lane: AutomationLane, normalizedValue: number): void {
    const binding = this.bindings.get(lane.id);
    if (!binding || !binding.audioParam) return;

    const param = this.registry.getParameter(lane.parameter);
    let value = mapToParameterRange(
      normalizedValue,
      lane.min,
      lane.max,
      param?.logarithmic || false
    );

    // Special handling for volume/pan
    const parsed = parseParameterPath(lane.parameter);
    if (parsed?.parameterId === 'volume') {
      value = dbToGain(normalizedToVolumeDb(normalizedValue));
    } else if (parsed?.parameterId === 'pan') {
      value = normalizedToPan(normalizedValue);
    }

    // Apply immediately
    binding.audioParam.setValueAtTime(value, 0);
    binding.lastValue = value;
  }

  /**
   * Get current value for a lane without applying
   */
  getCurrentValue(lane: AutomationLane, beat: number): number {
    const normalizedValue = getValueAtBeat(lane.points, beat, 0.5);
    return mapToParameterRange(normalizedValue, lane.min, lane.max, false);
  }

  /**
   * Enable/disable a binding
   */
  setBindingEnabled(laneId: string, enabled: boolean): void {
    const binding = this.bindings.get(laneId);
    if (binding) {
      binding.isConnected = enabled;
    }
  }

  /**
   * Get all active bindings
   */
  getActiveBindings(): ParameterBinding[] {
    return Array.from(this.bindings.values()).filter(b => b.isConnected);
  }

  /**
   * Get bindings for a track
   */
  getBindingsForTrack(trackId: string): ParameterBinding[] {
    return Array.from(this.bindings.values()).filter(b => b.trackId === trackId);
  }

  /**
   * Clear all bindings
   */
  clearBindings(): void {
    this.bindings.clear();
    this.batchUpdates.clear();
  }

  /**
   * Dispose and clean up
   */
  dispose(): void {
    this.clearBindings();
    this.registry.clear();
  }
}

// =============================================================================
// Parameter Helpers
// =============================================================================

/**
 * Create standard track parameters
 */
export function createTrackParameters(
  trackId: string,
  gainNode: { gain: AudioParam },
  pannerNode: { pan: AudioParam }
): Array<{ path: string; param: AudioParam; min: number; max: number }> {
  return [
    {
      path: `track.${trackId}.volume`,
      param: gainNode.gain,
      min: 0,
      max: 2,
    },
    {
      path: `track.${trackId}.pan`,
      param: pannerNode.pan,
      min: -1,
      max: 1,
    },
  ];
}

/**
 * Create standard send parameters
 */
export function createSendParameters(
  trackId: string,
  sendId: string,
  gainNode: { gain: AudioParam }
): Array<{ path: string; param: AudioParam; min: number; max: number }> {
  return [
    {
      path: `send.${trackId}.${sendId}.level`,
      param: gainNode.gain,
      min: 0,
      max: 1,
    },
  ];
}

/**
 * Create master parameters
 */
export function createMasterParameters(
  gainNode: { gain: AudioParam }
): Array<{ path: string; param: AudioParam; min: number; max: number }> {
  return [
    {
      path: 'master.volume',
      param: gainNode.gain,
      min: 0,
      max: 2,
    },
  ];
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createParameterRegistry(): ParameterRegistry {
  return new ParameterRegistry();
}

export function createParameterBindingManager(
  registry: ParameterRegistry
): ParameterBindingManager {
  return new ParameterBindingManager(registry);
}
