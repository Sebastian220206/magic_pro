/**
 * Automation Modes - Touch/Latch/Write/Trim
 *
 * Modes:
 * - Read: Plays back existing automation
 * - Write: Overwrites automation while playing
 * - Touch: Writes while touching fader, returns to previous value
 * - Latch: Writes while touching, continues after release
 * - Trim: Adjusts existing automation relatively
 */

export type AutomationModeType = 'read' | 'write' | 'touch' | 'latch' | 'trim';

export interface AutomationModeConfig {
  mode: AutomationModeType;
  isActive: boolean;
  lastValue: number;
  startBeat: number;
  touchStartBeat: number | null;
  isTouching: boolean;
}

export interface AutomationModeState {
  modes: Map<string, AutomationModeConfig>; // parameter → mode config
  globalMode: AutomationModeType;
  trimAmount: number; // dB for trim mode
}

export interface AutomationPoint {
  id: string;
  beat: number;
  value: number;
  curve: 'linear' | 'exponential' | 'logarithmic' | 'bezier' | 'hold';
  curveAmount?: number;
}

export interface AutomationLane {
  id: string;
  trackId: string;
  parameter: string;
  points: AutomationPoint[];
  min: number;
  max: number;
  defaultValue: number;
}

export interface AutomationRecordingEvent {
  beat: number;
  value: number;
  parameter: string;
  trackId: string;
}

export class AutomationModeManager {
  private state: AutomationModeState;
  private recordingBuffer: AutomationRecordingEvent[] = [];
  private listeners: Array<(state: AutomationModeState) => void> = [];

  constructor() {
    this.state = {
      modes: new Map(),
      globalMode: 'read',
      trimAmount: 0,
    };
  }

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  public setMode(parameter: string, mode: AutomationModeType): void {
    const existing = this.state.modes.get(parameter);
    this.state.modes.set(parameter, {
      mode,
      isActive: existing?.isActive ?? false,
      lastValue: existing?.lastValue ?? 0,
      startBeat: existing?.startBeat ?? 0,
      touchStartBeat: null,
      isTouching: false,
    });
    this.notifyListeners();
  }

  public getMode(parameter: string): AutomationModeType {
    return this.state.modes.get(parameter)?.mode ?? 'read';
  }

  public setGlobalMode(mode: AutomationModeType): void {
    this.state.globalMode = mode;
    // Apply to all parameters
    for (const [param, config] of this.state.modes) {
      this.state.modes.set(param, { ...config, mode });
    }
    this.notifyListeners();
  }

  public getGlobalMode(): AutomationModeType {
    return this.state.globalMode;
  }

  // ===========================================================================
  // Touch Control
  // ===========================================================================

  public startTouch(parameter: string, currentBeat: number, currentValue: number): void {
    const config = this.state.modes.get(parameter);
    if (!config) return;

    config.isTouching = true;
    config.touchStartBeat = currentBeat;
    config.lastValue = currentValue;

    if (config.mode === 'write') {
      config.isActive = true;
      config.startBeat = currentBeat;
    } else if (config.mode === 'touch' || config.mode === 'latch') {
      config.isActive = true;
      config.startBeat = currentBeat;
    }

    this.notifyListeners();
  }

  public updateTouch(parameter: string, currentBeat: number, currentValue: number): void {
    const config = this.state.modes.get(parameter);
    if (!config || !config.isTouching) return;

    this.recordingBuffer.push({
      beat: currentBeat,
      value: currentValue,
      parameter,
      trackId: '', // Will be set by caller
    });

    this.notifyListeners();
  }

  public endTouch(parameter: string, currentBeat: number, currentValue: number): void {
    const config = this.state.modes.get(parameter);
    if (!config) return;

    config.isTouching = false;

    if (config.mode === 'touch') {
      // Return to previous value
      config.isActive = false;
    } else if (config.mode === 'latch') {
      // Continue at current value
      config.lastValue = currentValue;
    } else if (config.mode === 'write') {
      config.isActive = false;
    }

    config.touchStartBeat = null;
    this.notifyListeners();
  }

  // ===========================================================================
  // Trim Mode
  // ===========================================================================

  public setTrimAmount(db: number): void {
    this.state.trimAmount = Math.max(-60, Math.min(12, db));
    this.notifyListeners();
  }

  public getTrimAmount(): number {
    return this.state.trimAmount;
  }

  public applyTrim(points: AutomationPoint[], trimDb: number): AutomationPoint[] {
    return points.map(point => ({
      ...point,
      value: Math.max(0, Math.min(1, point.value + trimDb / 60)), // Normalize to 0-1
    }));
  }

  // ===========================================================================
  // Recording
  // ===========================================================================

  public startRecording(parameter: string, trackId: string, startBeat: number): void {
    this.recordingBuffer = [];
    const config = this.state.modes.get(parameter);
    if (config) {
      config.isActive = true;
      config.startBeat = startBeat;
      this.notifyListeners();
    }
  }

  public stopRecording(): AutomationRecordingEvent[] {
    const events = [...this.recordingBuffer];
    this.recordingBuffer = [];

    for (const config of this.state.modes.values()) {
      config.isActive = false;
    }
    this.notifyListeners();

    return events;
  }

  public isRecording(): boolean {
    for (const config of this.state.modes.values()) {
      if (config.isActive) return true;
    }
    return false;
  }

  // ===========================================================================
  // Value Interpolation
  // ===========================================================================

  public getInterpolatedValue(
    lane: AutomationLane,
    beat: number
  ): number {
    const { points, defaultValue } = lane;
    if (points.length === 0) return defaultValue;

    // Find surrounding points
    let prev = points[0];
    let next = points[points.length - 1];

    for (let i = 0; i < points.length - 1; i++) {
      if (beat >= points[i].beat && beat < points[i + 1].beat) {
        prev = points[i];
        next = points[i + 1];
        break;
      }
    }

    if (beat <= prev.beat) return prev.value;
    if (beat >= next.beat) return next.value;

    // Interpolate
    const t = (beat - prev.beat) / (next.beat - prev.beat);
    return this.interpolateValue(prev.value, next.value, t, prev.curve, prev.curveAmount);
  }

  private interpolateValue(
    from: number,
    to: number,
    t: number,
    curve: AutomationPoint['curve'],
    curveAmount: number = 0
  ): number {
    switch (curve) {
      case 'linear':
        return from + (to - from) * t;
      case 'exponential':
        return from + (to - from) * (t * t);
      case 'logarithmic':
        return from + (to - from) * Math.sqrt(t);
      case 'bezier':
        return this.bezierInterpolate(from, to, t, curveAmount);
      case 'hold':
        return from;
      default:
        return from + (to - from) * t;
    }
  }

  private bezierInterpolate(
    from: number,
    to: number,
    t: number,
    controlPoint: number
  ): number {
    const cp = controlPoint * 0.5;
    const u = 1 - t;
    return u * u * from + 2 * u * t * (from + cp) + t * t * to;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<AutomationModeState> {
    return this.state;
  }

  public getStateSnapshot(): AutomationModeState {
    return {
      modes: new Map(this.state.modes),
      globalMode: this.state.globalMode,
      trimAmount: this.state.trimAmount,
    };
  }

  // ===========================================================================
  // Listeners
  // ===========================================================================

  public subscribe(listener: (state: AutomationModeState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): AutomationModeState {
    return this.getStateSnapshot();
  }

  public deserialize(data: AutomationModeState): void {
    this.state = {
      modes: new Map(data.modes),
      globalMode: data.globalMode,
      trimAmount: data.trimAmount,
    };
    this.notifyListeners();
  }
}

export function createAutomationModeManager(): AutomationModeManager {
  return new AutomationModeManager();
}

export default AutomationModeManager;
