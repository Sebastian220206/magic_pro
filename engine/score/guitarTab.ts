/**
 * Guitar Tab Notation - Professional Tab Display
 *
 * Features:
 * - Standard guitar tuning (E A D G B E)
 * - Custom tuning support
 * - Fret number display on 6 strings
 * - Guitar techniques:
 *   - Bend (full, half, quarter)
 *   - Slide (up, down, into, out of)
 *   - Hammer-on / Pull-off
 *   - Vibrato
 *   - Palm mute
 *   - Harmonics (natural, artificial, pinch)
 *   - Tapping
 *   - Trill
 *   - Muted notes (X)
 *   - Dead notes
 *   - Let ring
 *   - Staccato
 *   - Accents
 * - Rhythm notation above tab
 * - Duration lines/dots
 * - Multi-voice support
 * - Conversion from MIDI notes
 */

import { MidiNote } from '../midi/types';

// =============================================================================
// Guitar Tab Types
// =============================================================================

export type GuitarString = 1 | 2 | 3 | 4 | 5 | 6;  // 1 = high E, 6 = low E

export type TuningName =
  | 'standard'
  | 'drop_d'
  | 'drop_c'
  | 'open_g'
  | 'open_d'
  | 'open_e'
  | 'open_a'
  | 'dADGAD'
  | 'half_step_down'
  | 'whole_step_down'
  | 'custom';

export interface GuitarTuning {
  name: TuningName;
  /** String pitches from 1 (high E) to 6 (low E) */
  strings: [number, number, number, number, number, number];
  displayName: string;
}

export type GuitarTechnique =
  | 'none'
  | 'bend_full'
  | 'bend_half'
  | 'bend_quarter'
  | 'bend_release'
  | 'slide_up'
  | 'slide_down'
  | 'slide_into'
  | 'slide_out_of'
  | 'hammer_on'
  | 'pull_off'
  | 'vibrato'
  | 'palm_mute'
  | 'harmonic_natural'
  | 'harmonic_artificial'
  | 'harmonic_pinch'
  | 'tapping'
  | 'trill'
  | 'muted'
  | 'dead_note'
  | 'let_ring'
  | 'staccato'
  | 'accent'
  | 'ghost_note';

export type RhythmDuration =
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | 'sixteenth'
  | 'thirty_second'
  | 'triplet_eighth'
  | 'triplet_sixteenth'
  | 'dotted_quarter'
  | 'dotted_eighth'
  | 'dotted_sixteenth';

export interface TabNote {
  /** String number (1-6) */
  string: GuitarString;
  /** Fret number (0-24, or -1 for muted) */
  fret: number;
  /** Guitar technique applied */
  technique: GuitarTechnique;
  /** Bend amount in semitones (for bend techniques) */
  bendAmount?: number;
  /** Vibrato depth (0-1) */
  vibratoDepth?: number;
  /** Whether to let ring */
  letRing?: boolean;
  /** Dynamic marking */
  dynamic?: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
}

export interface TabPosition {
  /** Beat position */
  beat: number;
  /** Notes at this position (multiple for chords) */
  notes: TabNote[];
  /** Rhythm duration */
  rhythm: RhythmDuration;
  /** Whether this is a rest */
  isRest?: boolean;
  /** Stem direction for standard notation ('up' | 'down' | 'none') */
  stemDirection?: 'up' | 'down' | 'none';
  /** Beam group index */
  beamGroup?: number;
}

export interface TabSection {
  /** Section name (e.g., "Verse", "Chorus") */
  name: string;
  /** Start beat */
  startBeat: number;
  /** End beat */
  endBeat: number;
  /** Positions in this section */
  positions: TabPosition[];
}

export interface TabScore {
  /** Score title */
  title: string;
  /** Composer/artist */
  artist: string;
  /** Tuning used */
  tuning: GuitarTuning;
  /** Sections */
  sections: TabSection[];
  /** Time signature */
  timeSignature: [number, number];
  /** Tempo */
  tempo: number;
  /** Capo position (fret) */
  capo?: number;
}

export interface TabRenderOptions {
  /** Width of each position in pixels */
  positionWidth: number;
  /** Height between strings */
  stringSpacing: number;
  /** Font size for fret numbers */
  fretFontSize: number;
  /** Show rhythm notation */
  showRhythm: boolean;
  /** Show technique symbols */
  showTechniques: boolean;
  /** Show string names */
  showStringNames: boolean;
  /** Color for technique symbols */
  techniqueColor: string;
  /** Color for fret numbers */
  fretColor: string;
}

// =============================================================================
// Standard Tunings
// =============================================================================

export const GUITAR_TUNINGS: Record<TuningName, GuitarTuning> = {
  standard: {
    name: 'standard',
    strings: [64, 59, 55, 50, 45, 40],  // E4 B3 G3 D3 A2 E2
    displayName: 'Standard (E A D G B E)',
  },
  drop_d: {
    name: 'drop_d',
    strings: [64, 59, 55, 50, 45, 38],  // E4 B3 G3 D3 A2 D2
    displayName: 'Drop D (D A D G B E)',
  },
  drop_c: {
    name: 'drop_c',
    strings: [62, 57, 53, 48, 43, 36],  // D4 A3 F3 C3 G1 C2
    displayName: 'Drop C (C G C F A D)',
  },
  open_g: {
    name: 'open_g',
    strings: [62, 55, 50, 43, 38, 38],  // D4 G3 D3 G2 D2 D2
    displayName: 'Open G (D G D G B D)',
  },
  open_d: {
    name: 'open_d',
    strings: [62, 54, 50, 45, 38, 38],  // D4 F#3 D3 A2 D2 D2
    displayName: 'Open D (D A D F# A D)',
  },
  open_e: {
    name: 'open_e',
    strings: [64, 55, 48, 43, 38, 38],  // E4 G3 C3 G2 E2 E2
    displayName: 'Open E (E B G# E B E)',
  },
  open_a: {
    name: 'open_a',
    strings: [64, 57, 52, 45, 40, 33],  // E4 A3 E3 A2 E2 A1
    displayName: 'Open A (A E A C# E A)',
  },
  dADGAD: {
    name: 'dADGAD',
    strings: [62, 57, 50, 45, 38, 38],  // D4 A3 D3 G2 D2 D2
    displayName: 'DADGAD (D A D G A D)',
  },
  half_step_down: {
    name: 'half_step_down',
    strings: [63, 58, 54, 49, 44, 39],  // Eb4 Bb3 Gb3 Db3 Ab2 Eb2
    displayName: 'Half Step Down (Eb Ab Db Gb Bb Eb)',
  },
  whole_step_down: {
    name: 'whole_step_down',
    strings: [62, 57, 53, 48, 43, 38],  // D4 A3 F3 C3 G2 D2
    displayName: 'Whole Step Down (D G C F A D)',
  },
  custom: {
    name: 'custom',
    strings: [64, 59, 55, 50, 45, 40],
    displayName: 'Custom',
  },
};

// =============================================================================
// Rhythm Duration Mapping
// =============================================================================

export const RHYTHM_DURATIONS: Record<RhythmDuration, { beats: number; display: string }> = {
  whole: { beats: 4, display: 'w' },
  half: { beats: 2, display: 'h' },
  quarter: { beats: 1, display: 'q' },
  eighth: { beats: 0.5, display: 'e' },
  sixteenth: { beats: 0.25, display: 's' },
  thirty_second: { beats: 0.125, display: 't' },
  triplet_eighth: { beats: 1 / 3, display: '3' },
  triplet_sixteenth: { beats: 1 / 6, display: '3' },
  dotted_quarter: { beats: 1.5, display: 'q.' },
  dotted_eighth: { beats: 0.75, display: 'e.' },
  dotted_sixteenth: { beats: 0.375, display: 's.' },
};

// =============================================================================
// Guitar Tab Utilities
// =============================================================================

export class GuitarTabUtils {
  /**
   * Get tuning by name
   */
  static getTuning(name: TuningName): GuitarTuning {
    return GUITAR_TUNINGS[name];
  }

  /**
   * Create custom tuning
   */
  static createCustomTuning(
    strings: [number, number, number, number, number, number],
    displayName: string
  ): GuitarTuning {
    return {
      name: 'custom',
      strings,
      displayName,
    };
  }

  /**
   * Get note name for a fret position
   */
  static getNoteName(pitch: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(pitch / 12) - 1;
    const noteClass = pitch % 12;
    return `${noteNames[noteClass]}${octave}`;
  }

  /**
   * Get string name (note) for a string
   */
  static getStringName(tuning: GuitarTuning, string: GuitarString): string {
    return this.getNoteName(tuning.strings[string - 1]);
  }

  /**
   * Convert MIDI note to fret position on a string
   */
  static midiToFret(
    midiNote: number,
    string: GuitarString,
    tuning: GuitarTuning
  ): number {
    const openString = tuning.strings[string - 1];
    return midiNote - openString;
  }

  /**
   * Convert fret position to MIDI note on a string
   */
  static fretToMidi(
    fret: number,
    string: GuitarString,
    tuning: GuitarTuning
  ): number {
    return tuning.strings[string - 1] + fret;
  }

  /**
   * Find best string for a MIDI note (lowest fret possible)
   */
  static findBestString(
    midiNote: number,
    tuning: GuitarTuning,
    maxFret: number = 24
  ): { string: GuitarString; fret: number } | null {
    let bestString: GuitarString | null = null;
    let bestFret = maxFret + 1;

    for (let s = 1; s <= 6; s++) {
      const fret = this.midiToFret(midiNote, s as GuitarString, tuning);
      if (fret >= 0 && fret <= maxFret && fret < bestFret) {
        bestFret = fret;
        bestString = s as GuitarString;
      }
    }

    return bestString ? { string: bestString, fret: bestFret } : null;
  }

  /**
   * Find all possible positions for a MIDI note
   */
  static findAllPositions(
    midiNote: number,
    tuning: GuitarTuning,
    maxFret: number = 24
  ): Array<{ string: GuitarString; fret: number }> {
    const positions: Array<{ string: GuitarString; fret: number }> = [];

    for (let s = 1; s <= 6; s++) {
      const fret = this.midiToFret(midiNote, s as GuitarString, tuning);
      if (fret >= 0 && fret <= maxFret) {
        positions.push({ string: s as GuitarString, fret });
      }
    }

    return positions;
  }

  /**
   * Convert MIDI notes to tab positions
   */
  static midiToTab(
    notes: MidiNote[],
    tuning: GuitarTuning,
    maxFret: number = 24
  ): TabPosition[] {
    const positions: TabPosition[] = [];
    const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);

    // Group notes by start beat (chords)
    const groups = new Map<number, MidiNote[]>();
    for (const note of sorted) {
      const beat = Math.round(note.startBeat * 1000) / 1000;  // Round for grouping
      if (!groups.has(beat)) {
        groups.set(beat, []);
      }
      groups.get(beat)!.push(note);
    }

    for (const [beat, groupNotes] of groups) {
      const tabNotes: TabNote[] = [];

      for (const note of groupNotes) {
        const pos = this.findBestString(note.pitch, tuning, maxFret);
        if (pos) {
          tabNotes.push({
            string: pos.string,
            fret: pos.fret,
            technique: 'none',
          });
        }
      }

      if (tabNotes.length > 0) {
        positions.push({
          beat,
          notes: tabNotes,
          rhythm: 'quarter',  // Default, can be refined
        });
      }
    }

    return positions;
  }
}

// =============================================================================
// Tab Renderer
// =============================================================================

export class GuitarTabRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: TabRenderOptions;
  private tuning: GuitarTuning;

  constructor(
    canvas: HTMLCanvasElement,
    tuning: GuitarTuning = GUITAR_TUNINGS.standard,
    options: Partial<TabRenderOptions> = {}
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.tuning = tuning;
    this.options = {
      positionWidth: 40,
      stringSpacing: 12,
      fretFontSize: 14,
      showRhythm: true,
      showTechniques: true,
      showStringNames: true,
      techniqueColor: '#3b82f6',
      fretColor: '#1f2937',
      ...options,
    };
  }

  /**
   * Render tab to canvas
   */
  render(positions: TabPosition[], startX: number = 60): void {
    const { ctx, canvas, options, tuning } = this;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw string names
    if (options.showStringNames) {
      this.drawStringNames(startX - 30);
    }

    // Draw tab lines
    this.drawTabLines(startX, positions.length * options.positionWidth + startX);

    // Draw each position
    positions.forEach((pos, index) => {
      const x = startX + index * options.positionWidth;

      // Draw rhythm above tab
      if (options.showRhythm) {
        this.drawRhythm(x, 20, pos.rhythm);
      }

      // Draw notes
      pos.notes.forEach(note => {
        this.drawNote(x, note);
      });

      // Draw bar line at end of measure (every 4 beats)
      if ((index + 1) % 4 === 0) {
        this.drawBarLine(x + options.positionWidth / 2);
      }
    });
  }

  /**
   * Draw string names
   */
  private drawStringNames(x: number): void {
    const { ctx, options, tuning } = this;
    const startY = 50;

    ctx.font = '10px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';

    for (let s = 1; s <= 6; s++) {
      const y = startY + (s - 1) * options.stringSpacing;
      const name = GuitarTabUtils.getStringName(tuning, s as GuitarString);
      ctx.fillText(name, x, y + 4);
    }
  }

  /**
   * Draw tab lines
   */
  private drawTabLines(startX: number, endX: number): void {
    const { ctx, options } = this;
    const startY = 50;

    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;

    for (let s = 1; s <= 6; s++) {
      const y = startY + (s - 1) * options.stringSpacing;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }

  /**
   * Draw a note on the tab
   */
  private drawNote(x: number, note: TabNote): void {
    const { ctx, options } = this;
    const startY = 50;
    const y = startY + (note.string - 1) * options.stringSpacing;

    if (note.fret === -1) {
      // Muted note (X)
      ctx.font = `${options.fretFontSize}px monospace`;
      ctx.fillStyle = options.fretColor;
      ctx.textAlign = 'center';
      ctx.fillText('X', x, y + 4);
    } else if (note.fret === 0) {
      // Open string (O)
      ctx.font = `${options.fretFontSize}px monospace`;
      ctx.fillStyle = options.fretColor;
      ctx.textAlign = 'center';
      ctx.fillText('0', x, y + 4);
    } else {
      // Fret number
      ctx.font = `bold ${options.fretFontSize}px monospace`;
      ctx.fillStyle = options.fretColor;
      ctx.textAlign = 'center';
      ctx.fillText(String(note.fret), x, y + 4);
    }

    // Draw technique symbol
    if (options.showTechniques && note.technique !== 'none') {
      this.drawTechniqueSymbol(x, y, note);
    }
  }

  /**
   * Draw technique symbol
   */
  private drawTechniqueSymbol(x: number, y: number, note: TabNote): void {
    const { ctx, options } = this;

    ctx.font = '10px sans-serif';
    ctx.fillStyle = options.techniqueColor;
    ctx.textAlign = 'center';

    const symbol = this.getTechniqueSymbol(note.technique);
    if (symbol) {
      ctx.fillText(symbol, x, y - 8);
    }

    // Draw bend arrow if applicable
    if (note.technique.startsWith('bend') && note.bendAmount) {
      this.drawBendArrow(x, y, note.bendAmount);
    }
  }

  /**
   * Get symbol for technique
   */
  private getTechniqueSymbol(technique: GuitarTechnique): string | null {
    const symbols: Record<GuitarTechnique, string> = {
      none: '',
      bend_full: 'b',
      bend_half: '½b',
      bend_quarter: '¼b',
      bend_release: 'br',
      slide_up: '/',
      slide_down: '\\',
      slide_into: 's/',
      slide_out_of: '/s',
      hammer_on: 'h',
      pull_off: 'p',
      vibrato: '~',
      palm_mute: 'P.M.',
      harmonic_natural: '<>',
      harmonic_artificial: '<>a',
      harmonic_pinch: '<>p',
      tapping: 'T',
      trill: 'tr',
      muted: 'X',
      dead_note: 'x',
      let_ring: 'let ring',
      staccato: '.',
      accent: '>',
      ghost_note: '( )',
    };

    return symbols[technique] || null;
  }

  /**
   * Draw bend arrow
   */
  private drawBendArrow(x: number, y: number, semitones: number): void {
    const { ctx, options } = this;

    ctx.strokeStyle = options.techniqueColor;
    ctx.lineWidth = 1.5;

    const arrowHeight = semitones * 5;

    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y - 12 - arrowHeight);
    ctx.stroke();

    // Arrow head
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 12 - arrowHeight + 3);
    ctx.lineTo(x, y - 12 - arrowHeight);
    ctx.lineTo(x + 3, y - 12 - arrowHeight + 3);
    ctx.stroke();
  }

  /**
   * Draw rhythm notation
   */
  private drawRhythm(x: number, y: number, rhythm: RhythmDuration): void {
    const { ctx } = this;

    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';

    const info = RHYTHM_DURATIONS[rhythm];
    ctx.fillText(info.display, x, y);
  }

  /**
   * Draw bar line
   */
  private drawBarLine(x: number): void {
    const { ctx, options } = this;
    const startY = 50;
    const endY = startY + 5 * options.stringSpacing;

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x, startY - 5);
    ctx.lineTo(x, endY + 5);
    ctx.stroke();
  }

  /**
   * Update tuning
   */
  setTuning(tuning: GuitarTuning): void {
    this.tuning = tuning;
  }

  /**
   * Update options
   */
  setOptions(options: Partial<TabRenderOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// =============================================================================
// Tab Generator (MIDI to Tab)
// =============================================================================

export class GuitarTabGenerator {
  private tuning: GuitarTuning;
  private maxFret: number;

  constructor(
    tuning: GuitarTuning = GUITAR_TUNINGS.standard,
    maxFret: number = 24
  ) {
    this.tuning = tuning;
    this.maxFret = maxFret;
  }

  /**
   * Generate tab from MIDI notes
   */
  generate(notes: MidiNote[]): TabSection {
    const positions = GuitarTabUtils.midiToTab(notes, this.tuning, this.maxFret);

    return {
      name: 'Generated',
      startBeat: 0,
      endBeat: notes.length > 0
        ? Math.max(...notes.map(n => n.startBeat + n.duration))
        : 0,
      positions,
    };
  }

  /**
   * Detect techniques from note patterns
   */
  detectTechniques(positions: TabPosition[]): TabPosition[] {
    return positions.map((pos, index) => {
      if (index === 0) return pos;

      const prevPos = positions[index - 1];
      const enhancedNotes = pos.notes.map(note => {
        const prevNote = prevPos.notes.find(
          n => n.string === note.string && Math.abs(n.fret - note.fret) <= 2
        );

        if (!prevNote) return note;

        // Detect hammer-on/pull-off
        if (prevNote.fret !== note.fret) {
          if (note.fret > prevNote.fret) {
            return { ...note, technique: 'hammer_on' as GuitarTechnique };
          } else {
            return { ...note, technique: 'pull_off' as GuitarTechnique };
          }
        }

        // Detect slide
        if (Math.abs(note.fret - prevNote.fret) === 1) {
          return { ...note, technique: 'slide_up' as GuitarTechnique };
        }

        return note;
      });

      return { ...pos, notes: enhancedNotes };
    });
  }

  /**
   * Optimize string choices for playability
   */
  optimizePositions(positions: TabPosition[]): TabPosition[] {
    return positions.map(pos => {
      const optimizedNotes = pos.notes.map(note => {
        // Try to find a better string position
        const best = GuitarTabUtils.findBestString(
          GuitarTabUtils.fretToMidi(note.fret, note.string, this.tuning),
          this.tuning,
          this.maxFret
        );

        if (best && best.fret < note.fret) {
          return { ...note, string: best.string, fret: best.fret };
        }

        return note;
      });

      return { ...pos, notes: optimizedNotes };
    });
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createGuitarTabRenderer(
  canvas: HTMLCanvasElement,
  tuning?: GuitarTuning,
  options?: Partial<TabRenderOptions>
): GuitarTabRenderer {
  return new GuitarTabRenderer(canvas, tuning, options);
}

export function createGuitarTabGenerator(
  tuning?: GuitarTuning,
  maxFret?: number
): GuitarTabGenerator {
  return new GuitarTabGenerator(tuning, maxFret);
}

export default GuitarTabRenderer;
