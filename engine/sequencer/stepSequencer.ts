/**
 * Step Sequencer - Pattern-based Drum/Melodic Sequencing
 *
 * Features:
 * - 16/32/64 step patterns
 * - Multiple lanes (drums, melody, chords)
 * - Velocity per step
 * - Probability per step
 * - Slide/portamento per step
 * - Pattern banks (A/B/C/D)
 * - Chain patterns
 * - Copy/paste patterns
 * - Swing per lane
 *
 * Signal Flow:
 * Pattern → Step Clock → Velocity/Probability → Output Notes
 */

import { MidiNote, createNote } from '../midi/types';

export type StepResolution = '1/4' | '1/8' | '1/16' | '1/32';
export type SequencerMode = 'drum' | 'melodic';

export interface StepData {
  active: boolean;
  velocity: number;      // 0-127
  probability: number;   // 0-1
  slide: boolean;
  accent: boolean;
}

export interface StepLane {
  id: string;
  name: string;
  pitch: number;         // MIDI pitch (for melodic) or drum note
  steps: StepData[];
  muted: boolean;
  soloed: boolean;
  swing: number;         // 0-1
  volume: number;        // 0-1
}

export interface StepPattern {
  id: string;
  name: string;
  lanes: StepLane[];
  stepsPerPattern: number;  // 16, 32, 64
  resolution: StepResolution;
  length: number;           // In beats
}

export interface StepSequencerState {
  patterns: StepPattern[];
  currentPatternIndex: number;
  currentStep: number;
  isPlaying: boolean;
  tempo: number;
  mode: SequencerMode;
  bankIndex: number;        // 0-3 (A-D)
}

export interface StepSequencerConfig {
  stepsPerPattern: number;
  resolution: StepResolution;
  mode: SequencerMode;
  swing: number;
  velocity: number;
}

export interface StepSequencerOptions {
  stepsPerPattern?: number;
  resolution?: StepResolution;
  mode?: SequencerMode;
  swing?: number;
  lanes?: Array<{ name: string; pitch: number }>;
}

const DEFAULT_DRUM_LANES = [
  { name: 'Kick', pitch: 36 },
  { name: 'Snare', pitch: 38 },
  { name: 'Hi-Hat Closed', pitch: 42 },
  { name: 'Hi-Hat Open', pitch: 46 },
  { name: 'Clap', pitch: 39 },
  { name: 'Rim', pitch: 37 },
  { name: 'Tom High', pitch: 50 },
  { name: 'Tom Mid', pitch: 47 },
  { name: 'Tom Low', pitch: 45 },
  { name: 'Cymbal', pitch: 49 },
  { name: 'Perc 1', pitch: 53 },
  { name: 'Perc 2', pitch: 54 },
];

const DEFAULT_MELODIC_LANES = [
  { name: 'C3', pitch: 48 },
  { name: 'D3', pitch: 50 },
  { name: 'E3', pitch: 52 },
  { name: 'F3', pitch: 53 },
  { name: 'G3', pitch: 55 },
  { name: 'A3', pitch: 57 },
  { name: 'B3', pitch: 59 },
  { name: 'C4', pitch: 60 },
];

const RESOLUTION_BEATS: Record<StepResolution, number> = {
  '1/4': 1,
  '1/8': 0.5,
  '1/16': 0.25,
  '1/32': 0.125,
};

const DEFAULT_CONFIG: StepSequencerConfig = {
  stepsPerPattern: 16,
  resolution: '1/16',
  mode: 'drum',
  swing: 0,
  velocity: 100,
};

export class StepSequencer {
  private state: StepSequencerState;
  private config: StepSequencerConfig;
  private listeners: Array<(event: SequencerEvent) => void> = [];
  private lastStepTime = 0;

  constructor(options: StepSequencerOptions = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...options,
    };

    const defaultLanes = this.config.mode === 'drum' ? DEFAULT_DRUM_LANES : DEFAULT_MELODIC_LANES;
    const lanes = (options.lanes ?? defaultLanes).map((lane, i) =>
      this.createLane(lane.name, lane.pitch, this.config.stepsPerPattern)
    );

    this.state = {
      patterns: [this.createPattern('Pattern 1', lanes, this.config.stepsPerPattern, this.config.resolution)],
      currentPatternIndex: 0,
      currentStep: 0,
      isPlaying: false,
      tempo: 120,
      mode: this.config.mode,
      bankIndex: 0,
    };
  }

  // ===========================================================================
  // Pattern Management
  // ===========================================================================

  public createPattern(
    name: string,
    lanes?: StepLane[],
    steps?: number,
    resolution?: StepResolution
  ): StepPattern {
    const stepsPerPattern = steps ?? this.config.stepsPerPattern;
    const res = resolution ?? this.config.resolution;

    const defaultLanes = this.config.mode === 'drum' ? DEFAULT_DRUM_LANES : DEFAULT_MELODIC_LANES;
    const patternLanes = lanes ?? defaultLanes.map(l => this.createLane(l.name, l.pitch, stepsPerPattern));

    return {
      id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      lanes: patternLanes,
      stepsPerPattern,
      resolution: res,
      length: stepsPerPattern * RESOLUTION_BEATS[res],
    };
  }

  public addPattern(name: string): StepPattern {
    const pattern = this.createPattern(name);
    this.state.patterns.push(pattern);
    return pattern;
  }

  public duplicatePattern(index: number, newName?: string): StepPattern | null {
    const source = this.state.patterns[index];
    if (!source) return null;

    const duplicate: StepPattern = {
      ...source,
      id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newName ?? `${source.name} Copy`,
      lanes: source.lanes.map(lane => ({
        ...lane,
        steps: lane.steps.map(step => ({ ...step })),
      })),
    };

    this.state.patterns.splice(index + 1, 0, duplicate);
    return duplicate;
  }

  public deletePattern(index: number): boolean {
    if (this.state.patterns.length <= 1) return false;
    this.state.patterns.splice(index, 1);
    if (this.state.currentPatternIndex >= this.state.patterns.length) {
      this.state.currentPatternIndex = this.state.patterns.length - 1;
    }
    return true;
  }

  public selectPattern(index: number): void {
    if (index >= 0 && index < this.state.patterns.length) {
      this.state.currentPatternIndex = index;
      this.state.currentStep = 0;
    }
  }

  public getCurrentPattern(): StepPattern {
    return this.state.patterns[this.state.currentPatternIndex];
  }

  public getPatterns(): ReadonlyArray<StepPattern> {
    return this.state.patterns;
  }

  // ===========================================================================
  // Lane Management
  // ===========================================================================

  private createLane(name: string, pitch: number, steps: number): StepLane {
    return {
      id: `lane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      pitch,
      steps: Array.from({ length: steps }, () => ({
        active: false,
        velocity: 100,
        probability: 1,
        slide: false,
        accent: false,
      })),
      muted: false,
      soloed: false,
      swing: 0,
      volume: 1,
    };
  }

  public addLane(name: string, pitch: number): void {
    const pattern = this.getCurrentPattern();
    const lane = this.createLane(name, pitch, pattern.stepsPerPattern);
    pattern.lanes.push(lane);
  }

  public removeLane(laneId: string): void {
    const pattern = this.getCurrentPattern();
    const index = pattern.lanes.findIndex(l => l.id === laneId);
    if (index >= 0) {
      pattern.lanes.splice(index, 1);
    }
  }

  public getLane(laneId: string): StepLane | undefined {
    return this.getCurrentPattern().lanes.find(l => l.id === laneId);
  }

  // ===========================================================================
  // Step Editing
  // ===========================================================================

  public toggleStep(laneId: string, stepIndex: number): void {
    const lane = this.getLane(laneId);
    if (lane && stepIndex >= 0 && stepIndex < lane.steps.length) {
      lane.steps[stepIndex].active = !lane.steps[stepIndex].active;
    }
  }

  public setStep(laneId: string, stepIndex: number, active: boolean): void {
    const lane = this.getLane(laneId);
    if (lane && stepIndex >= 0 && stepIndex < lane.steps.length) {
      lane.steps[stepIndex].active = active;
    }
  }

  public setStepVelocity(laneId: string, stepIndex: number, velocity: number): void {
    const lane = this.getLane(laneId);
    if (lane && stepIndex >= 0 && stepIndex < lane.steps.length) {
      lane.steps[stepIndex].velocity = Math.max(0, Math.min(127, velocity));
    }
  }

  public setStepProbability(laneId: string, stepIndex: number, probability: number): void {
    const lane = this.getLane(laneId);
    if (lane && stepIndex >= 0 && stepIndex < lane.steps.length) {
      lane.steps[stepIndex].probability = Math.max(0, Math.min(1, probability));
    }
  }

  public setStepSlide(laneId: string, stepIndex: number, slide: boolean): void {
    const lane = this.getLane(laneId);
    if (lane && stepIndex >= 0 && stepIndex < lane.steps.length) {
      lane.steps[stepIndex].slide = slide;
    }
  }

  public setStepAccent(laneId: string, stepIndex: number, accent: boolean): void {
    const lane = this.getLane(laneId);
    if (lane && stepIndex >= 0 && stepIndex < lane.steps.length) {
      lane.steps[stepIndex].accent = accent;
    }
  }

  // ===========================================================================
  // Playback
  // ===========================================================================

  public start(): void {
    this.state.isPlaying = true;
    this.state.currentStep = 0;
    this.lastStepTime = 0;
  }

  public stop(): void {
    this.state.isPlaying = false;
    this.state.currentStep = 0;
    this.emit({ type: 'stop' });
  }

  public processStep(currentBeat: number): SequencerEvent[] {
    if (!this.state.isPlaying) return [];

    const pattern = this.getCurrentPattern();
    const stepBeats = RESOLUTION_BEATS[pattern.resolution];
    const timeSinceLastStep = currentBeat - this.lastStepTime;

    // Check for swing
    const isOddStep = this.state.currentStep % 2 === 1;
    const swingOffset = isOddStep ? stepBeats * this.config.swing * 0.5 : 0;

    if (timeSinceLastStep < stepBeats - swingOffset) {
      return [];
    }

    this.lastStepTime = currentBeat;
    const events: SequencerEvent[] = [];

    // Process each lane
    for (const lane of pattern.lanes) {
      if (lane.muted) continue;

      const step = lane.steps[this.state.currentStep];
      if (!step.active) continue;

      // Check probability
      if (Math.random() > step.probability) continue;

      // Calculate velocity with accent
      let velocity = step.velocity;
      if (step.accent) {
        velocity = Math.min(127, velocity + 20);
      }
      velocity = Math.round(velocity * lane.volume * (this.config.velocity / 100));

      events.push({
        type: 'note-on',
        pitch: lane.pitch,
        velocity,
        step: this.state.currentStep,
        laneId: lane.id,
        slide: step.slide,
      });
    }

    // Advance step
    this.state.currentStep = (this.state.currentStep + 1) % pattern.stepsPerPattern;

    return events;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setResolution(resolution: StepResolution): void {
    this.config.resolution = resolution;
    const pattern = this.getCurrentPattern();
    pattern.resolution = resolution;
    pattern.length = pattern.stepsPerPattern * RESOLUTION_BEATS[resolution];
  }

  public setSwing(swing: number): void {
    this.config.swing = Math.max(0, Math.min(1, swing));
  }

  public setVelocity(velocity: number): void {
    this.config.velocity = Math.max(0, Math.min(127, velocity));
  }

  public setMode(mode: SequencerMode): void {
    this.config.mode = mode;
    this.state.mode = mode;
  }

  // ===========================================================================
  // Pattern Operations
  // ===========================================================================

  public clearPattern(): void {
    const pattern = this.getCurrentPattern();
    for (const lane of pattern.lanes) {
      for (const step of lane.steps) {
        step.active = false;
      }
    }
  }

  public clearLane(laneId: string): void {
    const lane = this.getLane(laneId);
    if (lane) {
      for (const step of lane.steps) {
        step.active = false;
      }
    }
  }

  public randomizePattern(density: number = 0.3): void {
    const pattern = this.getCurrentPattern();
    for (const lane of pattern.lanes) {
      for (const step of lane.steps) {
        step.active = Math.random() < density;
        step.velocity = Math.floor(Math.random() * 64) + 64;
      }
    }
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<StepSequencerState> {
    return this.state;
  }

  public getConfig(): Readonly<StepSequencerConfig> {
    return this.config;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (event: SequencerEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private emit(event: SequencerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): StepSequencerState {
    return {
      ...this.state,
      patterns: this.state.patterns.map(p => ({
        ...p,
        lanes: p.lanes.map(l => ({
          ...l,
          steps: l.steps.map(s => ({ ...s })),
        })),
      })),
    };
  }

  public deserialize(data: StepSequencerState): void {
    this.state = {
      ...data,
      patterns: data.patterns.map(p => ({
        ...p,
        lanes: p.lanes.map(l => ({
          ...l,
          steps: l.steps.map(s => ({ ...s })),
        })),
      })),
    };
  }
}

// =============================================================================
// Event Types
// =============================================================================

export type SequencerEvent =
  | { type: 'note-on'; pitch: number; velocity: number; step: number; laneId: string; slide: boolean }
  | { type: 'stop' };

// =============================================================================
// Factory
// =============================================================================

export function createStepSequencer(options?: StepSequencerOptions): StepSequencer {
  return new StepSequencer(options);
}

export default StepSequencer;
