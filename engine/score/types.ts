import type { ClefType } from './notationUtils';

export interface ScoreConfig {
  bpm: number;
  timeSignature: [number, number];
  keySignature: number;
  showClef: boolean;
  showKeySignature: boolean;
  showTimeSignature: boolean;
  clefType: ClefType;
  zoomX: number;
  zoomY: number;
}

export interface ScoreNote {
  id: string;
  pitch: number;
  velocity: number;
  startBeat: number;
  duration: number;
  muted?: boolean;
  selected?: boolean;
  articulation?: string;
}

export interface ScoreMeasure {
  index: number;
  startBeat: number;
  endBeat: number;
  notes: ScoreNote[];
}

export interface ScoreViewport {
  startBeat: number;
  endBeat: number;
  scrollY: number;
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  bpm: 120,
  timeSignature: [4, 4],
  keySignature: 0,
  showClef: true,
  showKeySignature: true,
  showTimeSignature: true,
  clefType: 'treble',
  zoomX: 80,
  zoomY: 24,
};
