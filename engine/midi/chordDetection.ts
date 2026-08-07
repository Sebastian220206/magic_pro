/**
 * Chord Detection - Detect chord names from selected MIDI notes
 */

// Chord patterns: intervals from root
const CHORD_PATTERNS: Array<{ name: string; intervals: number[] }> = [
  // Triads
  { name: 'Major', intervals: [0, 4, 7] },
  { name: 'Minor', intervals: [0, 3, 7] },
  { name: 'Diminished', intervals: [0, 3, 6] },
  { name: 'Augmented', intervals: [0, 4, 8] },
  { name: 'Sus2', intervals: [0, 2, 7] },
  { name: 'Sus4', intervals: [0, 5, 7] },

  // Seventh chords
  { name: 'Major 7th', intervals: [0, 4, 7, 11] },
  { name: 'Minor 7th', intervals: [0, 3, 7, 10] },
  { name: 'Dominant 7th', intervals: [0, 4, 7, 10] },
  { name: 'Diminished 7th', intervals: [0, 3, 6, 9] },
  { name: 'Half-Diminished 7th', intervals: [0, 3, 6, 10] },
  { name: 'Minor-Major 7th', intervals: [0, 3, 7, 11] },
  { name: 'Augmented Major 7th', intervals: [0, 4, 8, 11] },

  // Sixth chords
  { name: 'Major 6th', intervals: [0, 4, 7, 9] },
  { name: 'Minor 6th', intervals: [0, 3, 7, 9] },

  // Extended chords
  { name: 'Dominant 9th', intervals: [0, 4, 7, 10, 14] },
  { name: 'Major 9th', intervals: [0, 4, 7, 11, 14] },
  { name: 'Minor 9th', intervals: [0, 3, 7, 10, 14] },

  // Power chord
  { name: 'Power', intervals: [0, 7] },

  // Suspended with 7th
  { name: 'Dominant 7th Sus4', intervals: [0, 5, 7, 10] },
  { name: 'Major 7th Sus4', intervals: [0, 5, 7, 11] },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Detect chord name from a set of MIDI pitches
 */
export function detectChord(pitches: number[]): string | null {
  if (pitches.length < 2) return null;

  // Get unique pitch classes (mod 12)
  const pitchClasses = [...new Set(pitches.map(p => p % 12))].sort((a, b) => a - b);

  if (pitchClasses.length < 2) return null;

  // Try each pitch class as root
  let bestMatch: { root: number; name: string; score: number } | null = null;

  for (let root = 0; root < 12; root++) {
    // Calculate intervals from this root
    const intervals = pitchClasses.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b);

    // Check each chord pattern
    for (const pattern of CHORD_PATTERNS) {
      const patternSet = new Set(pattern.intervals);
      const matchCount = intervals.filter(i => patternSet.has(i)).length;
      const coverage = matchCount / pattern.intervals.length;
      const precision = matchCount / intervals.length;

      // Score based on how well the pattern matches
      if (coverage >= 0.8 && precision >= 0.7) {
        const score = coverage * precision;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { root, name: pattern.name, score };
        }
      }
    }
  }

  if (bestMatch) {
    return `${NOTE_NAMES[bestMatch.root]}${bestMatch.name}`;
  }

  // Fallback: return interval analysis
  if (pitchClasses.length === 2) {
    const interval = (pitchClasses[1] - pitchClasses[0] + 12) % 12;
    const intervalNames: Record<number, string> = {
      0: 'Unison',
      1: 'Minor 2nd',
      2: 'Major 2nd',
      3: 'Minor 3rd',
      4: 'Major 3rd',
      5: 'Perfect 4th',
      6: 'Tritone',
      7: 'Perfect 5th',
      8: 'Minor 6th',
      9: 'Major 6th',
      10: 'Minor 7th',
      11: 'Major 7th',
    };
    return intervalNames[interval] || 'Unknown';
  }

  return 'Unknown';
}

/**
 * Get note name from MIDI pitch
 */
export function pitchToNoteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const noteName = NOTE_NAMES[pitch % 12];
  return `${noteName}${octave}`;
}
