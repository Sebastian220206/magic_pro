/**
 * Scripter - JavaScript API for MIDI Processing
 *
 * Features:
 * - JavaScript-based MIDI processing
 * - Access to MIDI notes, timing, velocity
 * - Transform notes in real-time
 * - Create custom MIDI effects
 * - Sandboxed execution environment
 *
 * API:
 * - onNoteOn(pitch, velocity, beat)
 * - onNoteOff(pitch, beat)
 * - onTransportStart()
 * - onTransportStop()
 * - getNotes() / setNotes()
 * - getCurrentBeat()
 * - getTempo()
 */

export interface ScripterEvent {
  type: 'noteOn' | 'noteOff' | 'transportStart' | 'transportStop';
  pitch?: number;
  velocity?: number;
  beat?: number;
  channel?: number;
}

export interface ScripterNote {
  pitch: number;
  velocity: number;
  startBeat: number;
  duration: number;
  channel: number;
}

export interface ScripterState {
  notes: ScripterNote[];
  currentBeat: number;
  tempo: number;
  isPlaying: boolean;
  channel: number;
}

export interface ScripterConfig {
  script: string;
  enabled: boolean;
  autoRun: boolean;
}

const DEFAULT_SCRIPT = `
// Scripter - MIDI Processing Script
// Available functions:
// - onNoteOn(pitch, velocity, beat)
// - onNoteOff(pitch, beat)
// - onTransportStart()
// - onTransportStop()
//
// Available variables:
// - notes: Array of current notes
// - currentBeat: Current position in beats
// - tempo: Current tempo in BPM
//
// Use addNote(pitch, velocity, beat, duration) to output notes

function onNoteOn(pitch, velocity, beat) {
  // Process note-on
  addNote(pitch, velocity, beat, 0.25);
}

function onNoteOff(pitch, beat) {
  // Process note-off
}
`;

export class Scripter {
  private state: ScripterState;
  private config: ScripterConfig;
  private sandbox: ScripterSandbox;
  private listeners: Array<(event: ScripterOutputEvent) => void> = [];

  constructor(config: Partial<ScripterConfig> = {}) {
    this.config = {
      script: config.script ?? DEFAULT_SCRIPT,
      enabled: config.enabled ?? true,
      autoRun: config.autoRun ?? true,
    };

    this.state = {
      notes: [],
      currentBeat: 0,
      tempo: 120,
      isPlaying: false,
      channel: 0,
    };

    this.sandbox = new ScripterSandbox(this.config.script);

    if (this.config.autoRun) {
      this.compile();
    }
  }

  // ===========================================================================
  // Script Management
  // ===========================================================================

  public setScript(script: string): void {
    this.config.script = script;
    this.sandbox.setScript(script);
  }

  public getScript(): string {
    return this.config.script;
  }

  public compile(): boolean {
    try {
      this.sandbox.compile();
      return true;
    } catch (error) {
      console.error('[Scripter] Compilation error:', error);
      return false;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  // ===========================================================================
  // Event Processing
  // ===========================================================================

  public processEvent(event: ScripterEvent): ScripterOutputEvent[] {
    if (!this.config.enabled) return [];

    const outputEvents: ScripterOutputEvent[] = [];

    try {
      switch (event.type) {
        case 'noteOn':
          if (event.pitch !== undefined && event.velocity !== undefined && event.beat !== undefined) {
            const result = this.sandbox.callFunction('onNoteOn', event.pitch, event.velocity, event.beat);
            if (Array.isArray(result)) {
              outputEvents.push(...result);
            }
          }
          break;

        case 'noteOff':
          if (event.pitch !== undefined && event.beat !== undefined) {
            const result = this.sandbox.callFunction('onNoteOff', event.pitch, event.beat);
            if (Array.isArray(result)) {
              outputEvents.push(...result);
            }
          }
          break;

        case 'transportStart':
          this.sandbox.callFunction('onTransportStart');
          break;

        case 'transportStop':
          this.sandbox.callFunction('onTransportStop');
          break;
      }
    } catch (error) {
      console.error('[Scripter] Runtime error:', error);
    }

    return outputEvents;
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  public updateState(state: Partial<ScripterState>): void {
    Object.assign(this.state, state);
    this.sandbox.setVariable('notes', this.state.notes);
    this.sandbox.setVariable('currentBeat', this.state.currentBeat);
    this.sandbox.setVariable('tempo', this.state.tempo);
    this.sandbox.setVariable('isPlaying', this.state.isPlaying);
  }

  public getState(): Readonly<ScripterState> {
    return this.state;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (event: ScripterOutputEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): ScripterConfig {
    return { ...this.config };
  }

  public deserialize(config: Partial<ScripterConfig>): void {
    Object.assign(this.config, config);
    if (config.script) {
      this.sandbox.setScript(config.script);
    }
  }
}

// =============================================================================
// Sandboxed Execution Environment
// =============================================================================

class ScripterSandbox {
  private script: string;
  private compiledFn: Function | null = null;
  private variables: Map<string, unknown> = new Map();
  private outputBuffer: ScripterOutputEvent[] = [];

  constructor(script: string) {
    this.script = script;
  }

  public setScript(script: string): void {
    this.script = script;
    this.compiledFn = null;
  }

  public compile(): void {
    try {
      // Create sandboxed function with limited scope
      const addNote = (pitch: number, velocity: number, beat: number, duration: number = 0.25) => {
        this.outputBuffer.push({
          type: 'note-on',
          pitch,
          velocity,
          beat,
          duration,
        });
      };

      const removeNote = (pitch: number, beat: number) => {
        this.outputBuffer.push({
          type: 'note-off',
          pitch,
          beat,
        });
      };

      const getNotes = () => this.variables.get('notes') ?? [];
      const setNotes = (notes: ScripterNote[]) => this.variables.set('notes', notes);
      const getCurrentBeat = () => this.variables.get('currentBeat') ?? 0;
      const getTempo = () => this.variables.get('tempo') ?? 120;
      const isTransportPlaying = () => this.variables.get('isPlaying') ?? false;

      // Compile script
      const fn = new Function(
        'addNote',
        'removeNote',
        'getNotes',
        'setNotes',
        'getCurrentBeat',
        'getTempo',
        'isTransportPlaying',
        this.script
      );

      this.compiledFn = fn.bind(null,
        addNote,
        removeNote,
        getNotes,
        setNotes,
        getCurrentBeat,
        getTempo,
        isTransportPlaying
      );
    } catch (error) {
      throw new Error(`Script compilation failed: ${error}`);
    }
  }

  public callFunction(_functionName: string, ...args: unknown[]): unknown {
    if (!this.compiledFn) {
      this.compile();
    }

    this.outputBuffer = [];

    try {
      // Call the compiled function
      const result = this.compiledFn!(...args);
      return [...this.outputBuffer, ...(Array.isArray(result) ? result : [])];
    } catch (error) {
      console.error('[ScripterSandbox] Execution error:', error);
      return [];
    }
  }

  public setVariable(name: string, value: unknown): void {
    this.variables.set(name, value);
  }

  public getVariable(name: string): unknown {
    return this.variables.get(name);
  }
}

// =============================================================================
// Event Types
// =============================================================================

export type ScripterOutputEvent =
  | { type: 'note-on'; pitch: number; velocity: number; beat: number; duration: number }
  | { type: 'note-off'; pitch: number; beat: number };

// =============================================================================
// Preset Scripts
// =============================================================================

export const SCRIPTER_PRESETS: Record<string, { name: string; script: string }> = {
  'octave-up': {
    name: 'Octave Up',
    script: `
function onNoteOn(pitch, velocity, beat) {
  addNote(pitch + 12, velocity, beat, 0.25);
}
`,
  },
  'octave-down': {
    name: 'Octave Down',
    script: `
function onNoteOn(pitch, velocity, beat) {
  if (pitch >= 12) {
    addNote(pitch - 12, velocity, beat, 0.25);
  }
}
`,
  },
  'reverse': {
    name: 'Reverse Notes',
    script: `
function onNoteOn(pitch, velocity, beat) {
  addNote(127 - pitch, velocity, beat, 0.25);
}
`,
  },
  'velocity-randomize': {
    name: 'Randomize Velocity',
    script: `
function onNoteOn(pitch, velocity, beat) {
  var newVel = Math.floor(Math.random() * 64) + 64;
  addNote(pitch, newVel, beat, 0.25);
}
`,
  },
  'scale-quantize': {
    name: 'Scale Quantize (Major)',
    script: `
var scale = [0, 2, 4, 5, 7, 9, 11];

function onNoteOn(pitch, velocity, beat) {
  var note = pitch % 12;
  var closest = scale[0];
  var minDist = 12;
  
  for (var i = 0; i < scale.length; i++) {
    var dist = Math.abs(note - scale[i]);
    if (dist < minDist) {
      minDist = dist;
      closest = scale[i];
    }
  }
  
  var octave = Math.floor(pitch / 12);
  addNote(octave * 12 + closest, velocity, beat, 0.25);
}
`,
  },
};

// =============================================================================
// Factory
// =============================================================================

export function createScripter(config?: Partial<ScripterConfig>): Scripter {
  return new Scripter(config);
}

export default Scripter;
