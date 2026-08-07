/**
 * Multi-Output Instrument - Base Class for Instruments with Multiple Outputs
 *
 * Features:
 * - Multiple discrete audio outputs per instrument
 * - Each output routed to separate mixer channel
 * - Individual effects processing per output
 * - Single MIDI input triggers all outputs
 * - Output naming and color coding
 *
 * Use Cases:
 * - Drum machine: Kick, Snare, Hats to separate channels
 * - Multi-timbral synth: Different patches per output
 * - Sampler: Different zones to different outputs
 */

export interface InstrumentOutput {
  id: string;
  name: string;
  index: number;         // Output number (0 = main)
  gain: number;          // 0-1
  pan: number;           // -1 to 1
  muted: boolean;
  soloed: boolean;
  color: string;
  connected: boolean;    // Is this output connected to mixer?
  meterLevel: number;    // Current level for metering
}

export interface MultiOutputInstrumentConfig {
  id: string;
  name: string;
  type: string;
  outputCount: number;   // Total outputs (including main)
  mainOutputIndex: number; // Index of main output
  outputs: InstrumentOutput[];
}

export interface MultiOutputInstrumentState {
  config: MultiOutputInstrumentConfig;
  activeNotes: Map<number, Set<number>>; // pitch → set of output indices
  outputBuffers: Map<number, Float32Array>;
}

export interface MultiOutputInstrumentOptions {
  name?: string;
  type?: string;
  outputCount?: number;
  outputs?: Partial<InstrumentOutput>[];
}

const DEFAULT_OUTPUT_COLORS = [
  '#3B82F6', // Blue (Main)
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

const DEFAULT_OUTPUT_NAMES = [
  'Main',
  'Output 2',
  'Output 3',
  'Output 4',
  'Output 5',
  'Output 6',
  'Output 7',
  'Output 8',
  'Output 9',
  'Output 10',
];

export class MultiOutputInstrument {
  protected config: MultiOutputInstrumentConfig;
  protected state: MultiOutputInstrumentState;
  protected audioContext: AudioContext | null = null;
  protected outputNodes: Map<number, GainNode> = new Map();
  protected outputAnalyzers: Map<number, AnalyserNode> = new Map();
  protected listeners: Array<(event: MultiOutputEvent) => void> = [];

  constructor(options: MultiOutputInstrumentOptions = {}) {
    const outputCount = options.outputCount ?? 4;
    const outputs: InstrumentOutput[] = [];

    for (let i = 0; i < outputCount; i++) {
      const partial = options.outputs?.[i] ?? {};
      outputs.push({
        id: `output-${i}`,
        name: partial.name ?? DEFAULT_OUTPUT_NAMES[i] ?? `Output ${i + 1}`,
        index: i,
        gain: partial.gain ?? 1,
        pan: partial.pan ?? 0,
        muted: partial.muted ?? false,
        soloed: partial.soloed ?? false,
        color: partial.color ?? DEFAULT_OUTPUT_COLORS[i % DEFAULT_OUTPUT_COLORS.length],
        connected: false,
        meterLevel: 0,
      });
    }

    this.config = {
      id: options.type ?? `multi-output-${Date.now()}`,
      name: options.name ?? 'Multi-Output Instrument',
      type: options.type ?? 'instrument',
      outputCount,
      mainOutputIndex: 0,
      outputs,
    };

    this.state = {
      config: this.config,
      activeNotes: new Map(),
      outputBuffers: new Map(),
    };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;

    // Create output gain nodes and analyzers
    for (let i = 0; i < this.config.outputCount; i++) {
      const gainNode = audioContext.createGain();
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.3;

      gainNode.connect(analyzer);
      this.outputNodes.set(i, gainNode);
      this.outputAnalyzers.set(i, analyzer);
    }
  }

  // ===========================================================================
  // Output Management
  // ===========================================================================

  public getOutput(index: number): InstrumentOutput | undefined {
    return this.config.outputs[index];
  }

  public getOutputs(): ReadonlyArray<InstrumentOutput> {
    return this.config.outputs;
  }

  public getOutputCount(): number {
    return this.config.outputCount;
  }

  public setOutputName(index: number, name: string): void {
    const output = this.config.outputs[index];
    if (output) {
      output.name = name;
      this.notifyListeners({ type: 'output-changed', outputIndex: index });
    }
  }

  public setOutputGain(index: number, gain: number): void {
    const output = this.config.outputs[index];
    if (output) {
      output.gain = Math.max(0, Math.min(1, gain));
      const gainNode = this.outputNodes.get(index);
      if (gainNode) {
        gainNode.gain.setTargetAtTime(output.gain, this.audioContext?.currentTime ?? 0, 0.01);
      }
      this.notifyListeners({ type: 'output-changed', outputIndex: index });
    }
  }

  public setOutputPan(index: number, pan: number): void {
    const output = this.config.outputs[index];
    if (output) {
      output.pan = Math.max(-1, Math.min(1, pan));
      this.notifyListeners({ type: 'output-changed', outputIndex: index });
    }
  }

  public setOutputMute(index: number, muted: boolean): void {
    const output = this.config.outputs[index];
    if (output) {
      output.muted = muted;
      const gainNode = this.outputNodes.get(index);
      if (gainNode) {
        gainNode.gain.setTargetAtTime(muted ? 0 : output.gain, this.audioContext?.currentTime ?? 0, 0.01);
      }
      this.notifyListeners({ type: 'output-changed', outputIndex: index });
    }
  }

  public setOutputSolo(index: number, soloed: boolean): void {
    const output = this.config.outputs[index];
    if (output) {
      output.soloed = soloed;
      this.notifyListeners({ type: 'output-changed', outputIndex: index });
    }
  }

  public setOutputColor(index: number, color: string): void {
    const output = this.config.outputs[index];
    if (output) {
      output.color = color;
      this.notifyListeners({ type: 'output-changed', outputIndex: index });
    }
  }

  // ===========================================================================
  // Audio Routing
  // ===========================================================================

  public getOutputNode(index: number): GainNode | null {
    return this.outputNodes.get(index) ?? null;
  }

  public getAnalyzerNode(index: number): AnalyserNode | null {
    return this.outputAnalyzers.get(index) ?? null;
  }

  public connectOutput(index: number, destination: AudioNode): void {
    const gainNode = this.outputNodes.get(index);
    if (gainNode) {
      gainNode.connect(destination);
      const output = this.config.outputs[index];
      if (output) {
        output.connected = true;
      }
    }
  }

  public disconnectOutput(index: number): void {
    const gainNode = this.outputNodes.get(index);
    if (gainNode) {
      gainNode.disconnect();
      const output = this.config.outputs[index];
      if (output) {
        output.connected = false;
      }
    }
  }

  public disconnectAllOutputs(): void {
    for (const [index] of this.outputNodes) {
      this.disconnectOutput(index);
    }
  }

  // ===========================================================================
  // Note Processing (Override in subclass)
  // ===========================================================================

  public noteOn(pitch: number, velocity: number, outputIndex: number = 0): void {
    // Track active notes per output
    let outputs = this.state.activeNotes.get(pitch);
    if (!outputs) {
      outputs = new Set();
      this.state.activeNotes.set(pitch, outputs);
    }
    outputs.add(outputIndex);

    this.notifyListeners({
      type: 'note-on',
      pitch,
      velocity,
      outputIndex,
    });
  }

  public noteOff(pitch: number, outputIndex: number = 0): void {
    const outputs = this.state.activeNotes.get(pitch);
    if (outputs) {
      outputs.delete(outputIndex);
      if (outputs.size === 0) {
        this.state.activeNotes.delete(pitch);
      }
    }

    this.notifyListeners({
      type: 'note-off',
      pitch,
      outputIndex,
    });
  }

  public allNotesOff(): void {
    this.state.activeNotes.clear();
    this.notifyListeners({ type: 'all-notes-off' });
  }

  // ===========================================================================
  // Metering
  // ===========================================================================

  public getOutputLevel(index: number): number {
    const analyzer = this.outputAnalyzers.get(index);
    if (!analyzer) return 0;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length / 255;
  }

  public updateMeterLevels(): void {
    for (let i = 0; i < this.config.outputCount; i++) {
      const output = this.config.outputs[i];
      if (output) {
        output.meterLevel = this.getOutputLevel(i);
      }
    }
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getConfig(): Readonly<MultiOutputInstrumentConfig> {
    return this.config;
  }

  public getState(): Readonly<MultiOutputInstrumentState> {
    return this.state;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (event: MultiOutputEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  protected notifyListeners(event: MultiOutputEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.allNotesOff();
    for (const [, gainNode] of this.outputNodes) {
      gainNode.disconnect();
    }
    for (const [, analyzer] of this.outputAnalyzers) {
      analyzer.disconnect();
    }
    this.outputNodes.clear();
    this.outputAnalyzers.clear();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): MultiOutputInstrumentConfig {
    return {
      ...this.config,
      outputs: this.config.outputs.map(o => ({ ...o })),
    };
  }

  public deserialize(config: Partial<MultiOutputInstrumentConfig>): void {
    if (config.outputs) {
      this.config.outputs = config.outputs.map(o => ({ ...o }));
    }
    if (config.outputCount !== undefined) {
      this.config.outputCount = config.outputCount;
    }
  }
}

// =============================================================================
// Event Types
// =============================================================================

export type MultiOutputEvent =
  | { type: 'note-on'; pitch: number; velocity: number; outputIndex: number }
  | { type: 'note-off'; pitch: number; outputIndex: number }
  | { type: 'all-notes-off' }
  | { type: 'output-changed'; outputIndex: number };

// =============================================================================
// Factory
// =============================================================================

export function createMultiOutputInstrument(options?: MultiOutputInstrumentOptions): MultiOutputInstrument {
  return new MultiOutputInstrument(options);
}

export default MultiOutputInstrument;
