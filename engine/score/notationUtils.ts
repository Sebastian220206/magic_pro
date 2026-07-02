export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function pitchToOctave(pitch: number): number {
  return Math.floor(pitch / 12) - 1;
}

export function pitchToNoteClass(pitch: number): number {
  return pitch % 12;
}

export function pitchToNoteName(pitch: number): string {
  return NOTE_NAMES[pitch % 12] + pitchToOctave(pitch);
}

export function pitchToStaffPosition(pitch: number, clef: ClefType): number {
  const MIDDLE_C = 60;
  if (clef === 'treble') {
    return (pitch - MIDDLE_C) + 1;
  } else {
    return (pitch - MIDDLE_C) + 7;
  }
}

export function isAccidentalRequired(pitch: number, keySignature: number): boolean {
  const noteClass = pitchToNoteClass(pitch);
  const accidental = getAccidentalForKey(noteClass, keySignature);
  return accidental !== 0;
}

export function getAccidentalForKey(noteClass: number, keySignature: number): number {
  if (keySignature >= 0) {
    const sharps = SHARP_ORDER;
    const count = keySignature;
    return sharps.slice(0, count).includes(noteClass) ? 1 : 0;
  } else {
    const flats = FLAT_ORDER;
    const count = Math.abs(keySignature);
    return flats.slice(0, count).includes(noteClass) ? -1 : 0;
  }
}

export const SHARP_ORDER = [7, 2, 9, 4, 11, 6, 1];
export const FLAT_ORDER = [11, 4, 9, 2, 7, 1, 6];

export function getKeySignatureName(keySig: number): string {
  const names = [
    'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
    'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  ];
  return names[keySig + 7] || 'C';
}

export function noteDurationToType(durationBeats: number): NoteheadType {
  if (durationBeats >= 4) return 'whole';
  if (durationBeats >= 2) return 'half';
  if (durationBeats >= 1) return 'quarter';
  if (durationBeats >= 0.5) return 'eighth';
  return 'sixteenth';
}

export type ClefType = 'treble' | 'bass';
export type NoteheadType = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export const TREBLE_CLEF_POSITIONS: Record<string, number> = {
  'E4': 4, 'F4': 3, 'G4': 2, 'A4': 1, 'B4': 0,
  'C5': -1, 'D5': -2, 'E5': -3, 'F5': -4,
};

export const BASS_CLEF_POSITIONS: Record<string, number> = {
  'G2': 6, 'A2': 5, 'B2': 4, 'C3': 3, 'D3': 2,
  'E3': 1, 'F3': 0, 'G3': -1, 'A3': -2,
};

export function getLedgerLines(pitch: number, clef: ClefType): number[] {
  const pos = pitchToStaffPosition(pitch, clef);
  const lines: number[] = [];
  if (clef === 'treble') {
    if (pos > 4) {
      for (let l = 5; l <= pos; l += 2) lines.push(l);
    } else if (pos < 0) {
      for (let l = -1; l >= pos; l -= 2) lines.push(l);
    }
  } else {
    if (pos > 6) {
      for (let l = 7; l <= pos; l += 2) lines.push(l);
    } else if (pos < 0) {
      for (let l = -1; l >= pos; l -= 2) lines.push(l);
    }
  }
  return lines;
}
