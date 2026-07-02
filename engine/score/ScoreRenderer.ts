import { RendererContract } from '../rendering/contracts/RendererScheduler';
import { ViewportState } from '../navigation/types';
import { BoundingBox } from '../rendering/invalidation/DirtyRegionManager';
import type { ScoreConfig, ScoreNote, ScoreMeasure } from './types';
import { DEFAULT_SCORE_CONFIG } from './types';
import {
  pitchToStaffPosition,
  noteDurationToType,
  getLedgerLines,
  isAccidentalRequired,
  getAccidentalForKey,
  pitchToNoteClass,
  SHARP_ORDER,
  FLAT_ORDER,
  getKeySignatureName,
  type ClefType,
  type NoteheadType,
} from './notationUtils';

export const STAFF_LINE_SPACING = 10;
export const STAFF_LINES = 5;
const STAFF_HEIGHT = (STAFF_LINES - 1) * STAFF_LINE_SPACING;
const NOTEHEAD_W = 8;
const NOTEHEAD_H = 6;
const STEM_LENGTH = 30;

interface RenderedMeasure {
  x: number;
  measure: ScoreMeasure;
}

export class ScoreRenderer implements RendererContract {
  public priority = 30;
  private _config: ScoreConfig = { ...DEFAULT_SCORE_CONFIG };
  private _notes: ScoreNote[] = [];
  private _measures: RenderedMeasure[] = [];

  constructor(private ctx: CanvasRenderingContext2D) {}

  set config(c: Partial<ScoreConfig>) {
    this._config = { ...this._config, ...c };
  }

  get config(): ScoreConfig {
    return this._config;
  }

  set notes(n: ScoreNote[]) {
    this._notes = n;
    this._layoutMeasures();
  }

  get notes(): ScoreNote[] {
    return this._notes;
  }

  private _layoutMeasures() {
    const ppb = this._config.zoomX;
    const [numBeats, noteValue] = this._config.timeSignature;
    const measureDuration = (numBeats * 4) / noteValue;
    const sorted = [...this._notes].sort((a, b) => a.startBeat - b.startBeat);

    const measures: RenderedMeasure[] = [];
    let currentBeat = 0;
    let measureIndex = 0;

    while (currentBeat < 512) {
      const mStart = currentBeat;
      const mEnd = currentBeat + measureDuration;
      const measureNotes = sorted.filter(
        n => n.startBeat >= mStart && n.startBeat < mEnd
      );
      measures.push({
        x: measureIndex * measureDuration * ppb,
        measure: { index: measureIndex, startBeat: mStart, endBeat: mEnd, notes: measureNotes },
      });
      currentBeat = mEnd;
      measureIndex++;
      if (measureIndex > 64) break;
    }

    this._measures = measures;
  }

  renderFull(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>) {
    const staffY = 50;
    this._drawStaff(ctx, staffY);
    this._drawClef(ctx, this._config.clefType, staffY);
    this._drawKeySignature(ctx, this._config.keySignature, this._config.clefType, staffY);
    this._drawTimeSignature(ctx, this._config.timeSignature, staffY);

    for (const rm of this._measures) {
      if (rm.x + rm.measure.startBeat * this._config.zoomX > ctx.canvas.width) break;
      this._drawBarLine(ctx, rm.x, staffY);
      for (const note of rm.measure.notes) {
        if (note.muted) continue;
        this._drawNote(ctx, note, rm.x, staffY);
      }
    }
  }

  renderRegion(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>, region: BoundingBox) {
    const staffY = 50;
    const regionStartBeat = region.x / this._config.zoomX;
    const regionEndBeat = (region.x + region.width) / this._config.zoomX;

    ctx.save();
    ctx.beginPath();
    ctx.rect(region.x, region.y, region.width, region.height);
    ctx.clip();

    this._drawStaff(ctx, staffY);

    for (const rm of this._measures) {
      if (rm.x + rm.measure.endBeat * this._config.zoomX < region.x) continue;
      if (rm.x > region.x + region.width) break;
      this._drawBarLine(ctx, rm.x, staffY);
      for (const note of rm.measure.notes) {
        if (note.muted) continue;
        this._drawNote(ctx, note, rm.x, staffY);
      }
    }

    ctx.restore();
  }

  private _drawStaff(ctx: CanvasRenderingContext2D, y: number) {
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let i = 0; i < STAFF_LINES; i++) {
      const ly = y + i * STAFF_LINE_SPACING;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(ctx.canvas.width, ly);
      ctx.stroke();
    }
  }

  private _drawClef(ctx: CanvasRenderingContext2D, clef: ClefType, y: number) {
    if (!this._config.showClef) return;
    ctx.fillStyle = '#aaa';
    ctx.font = `bold ${STAFF_HEIGHT * 1.4}px serif`;
    ctx.textBaseline = 'middle';

    if (clef === 'treble') {
      ctx.fillText('\u{1D11E}', 10, y + STAFF_HEIGHT / 2);
    } else {
      ctx.fillText('\u{1D122}', 10, y + STAFF_HEIGHT / 2 + 4);
    }
  }

  private _drawKeySignature(ctx: CanvasRenderingContext2D, keySig: number, clef: ClefType, y: number) {
    if (!this._config.showKeySignature || keySig === 0) return;
    ctx.fillStyle = '#aaa';
    ctx.font = `${STAFF_LINE_SPACING * 1.3}px serif`;

    const startX = 50;
    if (keySig > 0) {
      for (let i = 0; i < keySig; i++) {
        const pc = SHARP_ORDER[i];
        const pitch = this._sharpPosToPitch(pc, clef);
        const pos = pitchToStaffPosition(pitch, clef);
        const sy = y + pos * (STAFF_LINE_SPACING / 2) + STAFF_LINE_SPACING * 2;
        ctx.fillText('#', startX + i * 12, sy);
      }
    } else {
      for (let i = 0; i < Math.abs(keySig); i++) {
        const pc = FLAT_ORDER[i];
        const pitch = this._flatPosToPitch(pc, clef);
        const pos = pitchToStaffPosition(pitch, clef);
        const sy = y + pos * (STAFF_LINE_SPACING / 2) + STAFF_LINE_SPACING * 2;
        ctx.fillText('b', startX + i * 12, sy);
      }
    }
  }

  private _sharpPosToPitch(noteClass: number, clef: ClefType): number {
    const trebleMap: Record<number, number> = { 7: 71, 2: 66, 9: 73, 4: 68, 11: 75, 6: 70, 1: 65 };
    const bassMap: Record<number, number> = { 7: 59, 2: 54, 9: 61, 4: 56, 11: 63, 6: 58, 1: 53 };
    return clef === 'treble' ? (trebleMap[noteClass] ?? 71) : (bassMap[noteClass] ?? 59);
  }

  private _flatPosToPitch(noteClass: number, clef: ClefType): number {
    const trebleMap: Record<number, number> = { 11: 71, 4: 64, 9: 69, 2: 62, 7: 67, 1: 61, 6: 66 };
    const bassMap: Record<number, number> = { 11: 59, 4: 52, 9: 57, 2: 50, 7: 55, 1: 49, 6: 54 };
    return clef === 'treble' ? (trebleMap[noteClass] ?? 71) : (bassMap[noteClass] ?? 59);
  }

  private _drawTimeSignature(ctx: CanvasRenderingContext2D, ts: [number, number], y: number) {
    if (!this._config.showTimeSignature) return;
    ctx.fillStyle = '#aaa';
    ctx.font = `bold ${STAFF_LINE_SPACING * 1.5}px serif`;
    ctx.textAlign = 'center';
    const [num, den] = ts;
    const tx = 100;
    ctx.fillText(String(num), tx, y + STAFF_LINE_SPACING * 1.5);
    ctx.fillText(String(den), tx, y + STAFF_LINE_SPACING * 4.5);
    ctx.textAlign = 'start';
  }

  private _drawBarLine(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + STAFF_HEIGHT);
    ctx.stroke();
  }

  private _drawNote(ctx: CanvasRenderingContext2D, note: ScoreNote, measureX: number, staffY: number) {
    const ppb = this._config.zoomX;
    const nx = measureX + (note.startBeat % this._getMeasureDuration()) * ppb;
    const pos = pitchToStaffPosition(note.pitch, this._config.clefType);
    const ny = staffY + (STAFF_LINES - 1 - pos) * (STAFF_LINE_SPACING / 2);

    const noteType = noteDurationToType(note.duration);
    const ledgerLines = getLedgerLines(note.pitch, this._config.clefType);

    ctx.save();

    for (const ll of ledgerLines) {
      const lly = staffY + (STAFF_LINES - 1 - ll + 2) * (STAFF_LINE_SPACING / 2);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(nx - NOTEHEAD_W, lly);
      ctx.lineTo(nx + NOTEHEAD_W, lly);
      ctx.stroke();
    }

    if (note.selected) {
      ctx.shadowColor = '#3B82F6';
      ctx.shadowBlur = 8;
    }

    this._drawNotehead(ctx, nx, ny, noteType, note.pitch);

    if (noteType !== 'whole') {
      this._drawStem(ctx, nx, ny, noteType, pos);
    }

    if (pos <= 0 && noteType !== 'whole') {
      this._drawStem(ctx, nx, ny, noteType, 0);
    }

    if (isAccidentalRequired(note.pitch, this._config.keySignature)) {
      this._drawAccidental(ctx, nx, ny, note.pitch);
    }

    ctx.restore();
  }

  private _drawNotehead(ctx: CanvasRenderingContext2D, x: number, y: number, type: NoteheadType, _pitch: number) {
    const isFilled = type !== 'whole' && type !== 'half' || type === 'half';
    ctx.fillStyle = '#ddd';
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.ellipse(x, y, NOTEHEAD_W / 2, NOTEHEAD_H / 2, -0.2, 0, Math.PI * 2);
    if (isFilled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }

    if (type === 'eighth' || type === 'sixteenth') {
      ctx.fillStyle = '#ddd';
      ctx.beginPath();
      ctx.arc(x + NOTEHEAD_W / 2 + 2, y - STEM_LENGTH, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private _drawStem(ctx: CanvasRenderingContext2D, x: number, y: number, _type: NoteheadType, pos: number) {
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1.5;
    const stemUp = pos > 2;
    const stemX = stemUp ? x + NOTEHEAD_W / 2 : x - NOTEHEAD_W / 2;
    const stemTop = stemUp ? y - STEM_LENGTH : y + STEM_LENGTH;
    ctx.beginPath();
    ctx.moveTo(stemX, y);
    ctx.lineTo(stemX, stemTop);
    ctx.stroke();
  }

  private _drawAccidental(ctx: CanvasRenderingContext2D, x: number, y: number, pitch: number) {
    const nc = pitchToNoteClass(pitch);
    const acc = getAccidentalForKey(nc, this._config.keySignature);
    if (acc === 0) return;
    ctx.fillStyle = '#ddd';
    ctx.font = `${STAFF_LINE_SPACING * 1.1}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(acc > 0 ? '#' : 'b', x - NOTEHEAD_W - 4, y + 3);
    ctx.textAlign = 'start';
  }

  private _getMeasureDuration(): number {
    const [num, noteValue] = this._config.timeSignature;
    return (num * 4) / noteValue;
  }
}
