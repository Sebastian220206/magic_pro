/**
 * Beat Map Engine - Non-linear Time Mapping
 *
 * Features:
 * - Convert between beat and time positions
 * - Add/remove/move anchor points
 * - Interpolate curves between points
 * - Snap to grid
 * - Undo/redo
 * - Analysis and statistics
 */

import {
  BeatMapPoint,
  BeatMapConfig,
  BeatMapState,
  BeatMapEditMode,
  BeatMapViewport,
  BeatMapDragState,
  BeatMapAnalysis,
  BeatMapPreset,
  BeatMapPresetType,
  BeatToTimeResult,
  TimeToBeatResult,
  TimeSignature,
  CurveType,
  createBeatMapPoint,
  createDefaultBeatMapConfig,
  calculateBeatMapBPM,
  calculateBeatMapAnalysis,
} from './beatMapTypes';

// =============================================================================
// Beat Map Engine
// =============================================================================

export class BeatMapEngine {
  private state: BeatMapState;
  private listeners: Array<(state: BeatMapState) => void> = [];
  private undoStack: BeatMapEditAction[] = [];
  private redoStack: BeatMapEditAction[] = [];
  private maxUndoSize: number = 100;

  constructor(config?: Partial<BeatMapConfig>) {
    const defaultConfig = createDefaultBeatMapConfig();
    this.state = {
      config: { ...defaultConfig, ...config },
      selectedIds: new Set(),
      hoveredId: null,
      dragState: null,
      viewport: {
        startBeat: 0,
        endBeat: 16,
        startTime: 0,
        endTime: 8,
      },
      editMode: 'select',
    };
  }

  // ===========================================================================
  // Point Management
  // ===========================================================================

  public addPoint(beat: number, time: number, curve: CurveType = 'linear'): BeatMapPoint {
    const point = createBeatMapPoint(beat, time, curve);
    this.pushUndo({ type: 'add', points: [point] });

    this.state.config.points.push(point);
    this.sortPoints();
    this.notifyListeners();
    return point;
  }

  public removePoint(id: string): boolean {
    const index = this.state.config.points.findIndex(p => p.id === id);
    if (index < 0) return false;

    const point = this.state.config.points[index];
    if (point.locked) return false;

    this.pushUndo({ type: 'remove', points: [point] });

    this.state.config.points.splice(index, 1);
    this.state.selectedIds.delete(id);
    this.notifyListeners();
    return true;
  }

  public removeSelectedPoints(): number {
    const toRemove = this.state.config.points.filter(
      p => this.state.selectedIds.has(p.id) && !p.locked
    );

    if (toRemove.length === 0) return 0;

    this.pushUndo({ type: 'remove', points: toRemove });

    this.state.config.points = this.state.config.points.filter(
      p => !this.state.selectedIds.has(p.id) || p.locked
    );
    this.state.selectedIds.clear();
    this.notifyListeners();
    return toRemove.length;
  }

  public movePoint(id: string, newBeat: number, newTime: number): boolean {
    const point = this.state.config.points.find(p => p.id === id);
    if (!point || point.locked) return false;

    const oldPoint = { ...point };
    this.pushUndo({ type: 'move', points: [{ ...point }], oldPoints: [oldPoint] });

    point.beat = this.snapBeat(newBeat);
    point.time = Math.max(0, newTime);
    this.sortPoints();
    this.notifyListeners();
    return true;
  }

  public setPointCurve(id: string, curve: CurveType, intensity?: number): boolean {
    const point = this.state.config.points.find(p => p.id === id);
    if (!point) return false;

    this.pushUndo({ type: 'modify', points: [{ ...point }] });

    point.curve = curve;
    if (intensity !== undefined) {
      point.curveIntensity = Math.max(0, Math.min(1, intensity));
    }
    this.notifyListeners();
    return true;
  }

  public lockPoint(id: string, locked: boolean): void {
    const point = this.state.config.points.find(p => p.id === id);
    if (point) {
      point.locked = locked;
      this.notifyListeners();
    }
  }

  public getPoint(id: string): BeatMapPoint | undefined {
    return this.state.config.points.find(p => p.id === id);
  }

  public getPoints(): ReadonlyArray<BeatMapPoint> {
    return this.state.config.points;
  }

  public getSortedPoints(): BeatMapPoint[] {
    return [...this.state.config.points].sort((a, b) => a.beat - b.beat);
  }

  private sortPoints(): void {
    this.state.config.points.sort((a, b) => a.beat - b.beat);
  }

  // ===========================================================================
  // Beat ↔ Time Conversion
  // ===========================================================================

  public beatToTime(beat: number): number {
    const points = this.getSortedPoints();
    if (points.length === 0) return beat * 0.5; // Default: 120 BPM

    // Find surrounding points
    let before = points[0];
    let after = points[points.length - 1];

    for (let i = 0; i < points.length - 1; i++) {
      if (beat >= points[i].beat && beat <= points[i + 1].beat) {
        before = points[i];
        after = points[i + 1];
        break;
      }
    }

    // Clamp to range
    if (beat <= before.beat) return before.time;
    if (beat >= after.beat) return after.time;

    // Interpolate
    const t = (beat - before.beat) / (after.beat - before.beat);
    const interpolatedT = this.interpolateCurve(t, before.curve, before.curveIntensity);

    return before.time + (after.time - before.time) * interpolatedT;
  }

  public timeToBeat(time: number): number {
    const points = this.getSortedPoints();
    if (points.length === 0) return time * 2; // Default: 120 BPM

    // Find surrounding points
    let before = points[0];
    let after = points[points.length - 1];

    for (let i = 0; i < points.length - 1; i++) {
      if (time >= points[i].time && time <= points[i + 1].time) {
        before = points[i];
        after = points[i + 1];
        break;
      }
    }

    // Clamp to range
    if (time <= before.time) return before.beat;
    if (time >= after.time) return after.beat;

    // Inverse interpolation
    const t = (time - before.time) / (after.time - before.time);
    const inverseT = this.inverseInterpolateCurve(t, before.curve, before.curveIntensity);

    return before.beat + (after.beat - before.beat) * inverseT;
  }

  public beatToTimeDetailed(beat: number): BeatToTimeResult {
    const time = this.beatToTime(beat);
    const bpm = this.getBPMAtBeat(beat);
    const timeSignature = this.getTimeSignatureAtBeat(beat);
    const bar = Math.floor(beat / timeSignature.numerator) + 1;
    const beatInBar = (beat % timeSignature.numerator) + 1;

    return { time, bpm, timeSignature, bar, beatInBar };
  }

  public timeToBeatDetailed(time: number): TimeToBeatResult {
    const beat = this.timeToBeat(time);
    const bpm = this.getBPMAtTime(time);
    const timeSignature = this.getTimeSignatureAtBeat(beat);
    const bar = Math.floor(beat / timeSignature.numerator) + 1;
    const beatInBar = (beat % timeSignature.numerator) + 1;

    return { beat, bpm, timeSignature, bar, beatInBar };
  }

  // ===========================================================================
  // BPM Calculation
  // ===========================================================================

  public getBPMAtBeat(beat: number): number {
    const points = this.getSortedPoints();
    if (points.length < 2) return 120;

    for (let i = 0; i < points.length - 1; i++) {
      if (beat >= points[i].beat && beat <= points[i + 1].beat) {
        return calculateBeatMapBPM(points[i], points[i + 1]);
      }
    }

    // Outside range, use last segment
    return calculateBeatMapBPM(points[points.length - 2], points[points.length - 1]);
  }

  public getBPMAtTime(time: number): number {
    const beat = this.timeToBeat(time);
    return this.getBPMAtBeat(beat);
  }

  public getAverageBPM(): number {
    const points = this.getSortedPoints();
    if (points.length < 2) return 120;
    return calculateBeatMapBPM(points[0], points[points.length - 1]);
  }

  // ===========================================================================
  // Time Signature
  // ===========================================================================

  public getTimeSignatureAtBeat(beat: number): TimeSignature {
    // Default 4/4 time signature
    // Can be extended with time signature events
    return { numerator: 4, denominator: 4 };
  }

  // ===========================================================================
  // Curve Interpolation
  // ===========================================================================

  private interpolateCurve(
    t: number,
    curve: CurveType,
    intensity: number
  ): number {
    switch (curve) {
      case 'linear':
        return t;

      case 'ease-in':
        return Math.pow(t, 1 + intensity);

      case 'ease-out':
        return 1 - Math.pow(1 - t, 1 + intensity);

      case 'ease-in-out':
        if (t < 0.5) {
          return 0.5 * Math.pow(2 * t, 1 + intensity);
        } else {
          return 1 - 0.5 * Math.pow(2 * (1 - t), 1 + intensity);
        }

      case 'bezier':
        // Cubic bezier approximation
        return this.cubicBezier(t, intensity);

      case 'step':
        return t < 0.5 ? 0 : 1;

      case 's-curve':
        // Sigmoid-like curve
        const s = (t - 0.5) * 6 * (1 + intensity);
        return 1 / (1 + Math.exp(-s));

      default:
        return t;
    }
  }

  private inverseInterpolateCurve(
    t: number,
    curve: CurveType,
    intensity: number
  ): number {
    // For most curves, approximate inverse numerically
    // For linear, it's the same
    if (curve === 'linear') return t;
    if (curve === 'step') return t < 0.5 ? 0 : 1;

    // Binary search for inverse
    let low = 0;
    let high = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const interpolated = this.interpolateCurve(mid, curve, intensity);
      if (interpolated < t) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return (low + high) / 2;
  }

  private cubicBezier(t: number, intensity: number): number {
    // Simplified cubic bezier
    const p1 = intensity * 0.5;
    const p2 = 1 - intensity * 0.5;

    // Newton-Raphson approximation
    let x = t;
    for (let i = 0; i < 8; i++) {
      const cx = 3 * p1 * (1 - x) * (1 - x) * x + 3 * p2 * (1 - x) * x * x + x * x * x - t;
      const dx = 3 * p1 * ((1 - x) * (1 - x) - 2 * (1 - x) * x) + 3 * p2 * ((1 - x) * x - x * x) + 3 * x * x;
      if (Math.abs(dx) < 1e-6) break;
      x -= cx / dx;
      x = Math.max(0, Math.min(1, x));
    }

    // Calculate y
    return 3 * p1 * (1 - x) * (1 - x) * x + 3 * p2 * (1 - x) * x * x + x * x * x;
  }

  // ===========================================================================
  // Grid Snapping
  // ===========================================================================

  private snapBeat(beat: number): number {
    if (!this.state.config.snapEnabled) return beat;
    const gridSize = this.state.config.gridSize;
    return Math.round(beat / gridSize) * gridSize;
  }

  public setGridSize(size: number): void {
    this.state.config.gridSize = Math.max(0.0625, Math.min(4, size));
    this.notifyListeners();
  }

  public setSnapEnabled(enabled: boolean): void {
    this.state.config.snapEnabled = enabled;
    this.notifyListeners();
  }

  // ===========================================================================
  // Selection
  // ===========================================================================

  public selectPoint(id: string, addToSelection: boolean = false): void {
    if (!addToSelection) {
      this.deselectAll();
    }
    this.state.selectedIds.add(id);
    this.notifyListeners();
  }

  public deselectPoint(id: string): void {
    this.state.selectedIds.delete(id);
    this.notifyListeners();
  }

  public deselectAll(): void {
    this.state.selectedIds.clear();
    this.notifyListeners();
  }

  public selectAll(): void {
    for (const point of this.state.config.points) {
      this.state.selectedIds.add(point.id);
    }
    this.notifyListeners();
  }

  public selectRange(startBeat: number, endBeat: number): void {
    this.state.selectedIds.clear();
    for (const point of this.state.config.points) {
      if (point.beat >= startBeat && point.beat <= endBeat) {
        this.state.selectedIds.add(point.id);
      }
    }
    this.notifyListeners();
  }

  public getSelectedPoints(): BeatMapPoint[] {
    return this.state.config.points.filter(p => this.state.selectedIds.has(p.id));
  }

  // ===========================================================================
  // Viewport
  // ===========================================================================

  public setViewport(viewport: Partial<BeatMapViewport>): void {
    Object.assign(this.state.viewport, viewport);
    this.notifyListeners();
  }

  public getViewport(): Readonly<BeatMapViewport> {
    return this.state.viewport;
  }

  // ===========================================================================
  // Edit Mode
  // ===========================================================================

  public setEditMode(mode: BeatMapEditMode): void {
    this.state.editMode = mode;
    this.notifyListeners();
  }

  public getEditMode(): BeatMapEditMode {
    return this.state.editMode;
  }

  // ===========================================================================
  // Undo/Redo
  // ===========================================================================

  public undo(): boolean {
    const action = this.undoStack.pop();
    if (!action) return false;

    this.redoStack.push(action);
    this.applyUndoAction(action);
    this.notifyListeners();
    return true;
  }

  public redo(): boolean {
    const action = this.redoStack.pop();
    if (!action) return false;

    this.undoStack.push(action);
    this.applyRedoAction(action);
    this.notifyListeners();
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private pushUndo(action: BeatMapEditAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxUndoSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  private applyUndoAction(action: BeatMapEditAction): void {
    switch (action.type) {
      case 'add':
        for (const point of action.points) {
          const index = this.state.config.points.findIndex(p => p.id === point.id);
          if (index >= 0) {
            this.state.config.points.splice(index, 1);
          }
        }
        break;
      case 'remove':
        this.state.config.points.push(...action.points);
        this.sortPoints();
        break;
      case 'move':
        if (action.oldPoints) {
          for (const oldPoint of action.oldPoints) {
            const point = this.state.config.points.find(p => p.id === oldPoint.id);
            if (point) {
              point.beat = oldPoint.beat;
              point.time = oldPoint.time;
            }
          }
        }
        break;
      case 'modify':
        if (action.oldPoints) {
          for (const oldPoint of action.oldPoints) {
            const point = this.state.config.points.find(p => p.id === oldPoint.id);
            if (point) {
              Object.assign(point, oldPoint);
            }
          }
        }
        break;
    }
  }

  private applyRedoAction(action: BeatMapEditAction): void {
    switch (action.type) {
      case 'add':
        this.state.config.points.push(...action.points);
        this.sortPoints();
        break;
      case 'remove':
        for (const point of action.points) {
          const index = this.state.config.points.findIndex(p => p.id === point.id);
          if (index >= 0) {
            this.state.config.points.splice(index, 1);
          }
        }
        break;
      case 'move':
        for (const point of action.points) {
          const existing = this.state.config.points.find(p => p.id === point.id);
          if (existing) {
            existing.beat = point.beat;
            existing.time = point.time;
          }
        }
        break;
      case 'modify':
        for (const point of action.points) {
          const existing = this.state.config.points.find(p => p.id === point.id);
          if (existing) {
            Object.assign(existing, point);
          }
        }
        break;
    }
  }

  // ===========================================================================
  // Presets
  // ===========================================================================

  public applyPreset(preset: BeatMapPreset): void {
    this.pushUndo({ type: 'modify', points: [...this.state.config.points] });

    this.state.config.points = preset.points.map(p =>
      createBeatMapPoint(p.beat, p.time, p.curve, {
        curveIntensity: p.curveIntensity,
        locked: p.locked,
      })
    );
    this.sortPoints();
    this.notifyListeners();
  }

  public static getPresets(): BeatMapPreset[] {
    return [
      {
        name: 'Linear (Constant Tempo)',
        type: 'linear',
        description: 'No tempo change, constant BPM',
        points: [
          { beat: 0, time: 0, curve: 'linear', curveIntensity: 0.5, locked: true, selected: false },
          { beat: 16, time: 8, curve: 'linear', curveIntensity: 0.5, locked: false, selected: false },
        ],
      },
      {
        name: 'Accelerando',
        type: 'accelerando',
        description: 'Gradually speed up',
        points: [
          { beat: 0, time: 0, curve: 'linear', curveIntensity: 0.5, locked: true, selected: false },
          { beat: 8, time: 6, curve: 'ease-in', curveIntensity: 0.7, locked: false, selected: false },
          { beat: 16, time: 8, curve: 'ease-in', curveIntensity: 0.5, locked: false, selected: false },
        ],
      },
      {
        name: 'Ritardando',
        type: 'ritardando',
        description: 'Gradually slow down',
        points: [
          { beat: 0, time: 0, curve: 'linear', curveIntensity: 0.5, locked: true, selected: false },
          { beat: 8, time: 4, curve: 'ease-out', curveIntensity: 0.7, locked: false, selected: false },
          { beat: 16, time: 10, curve: 'ease-out', curveIntensity: 0.5, locked: false, selected: false },
        ],
      },
      {
        name: 'Rubato',
        type: 'rubato',
        description: 'Free tempo with expressive timing',
        points: [
          { beat: 0, time: 0, curve: 'ease-in-out', curveIntensity: 0.5, locked: true, selected: false },
          { beat: 4, time: 2.5, curve: 'ease-in-out', curveIntensity: 0.6, locked: false, selected: false },
          { beat: 8, time: 4, curve: 'ease-in-out', curveIntensity: 0.4, locked: false, selected: false },
          { beat: 12, time: 7, curve: 'ease-in-out', curveIntensity: 0.5, locked: false, selected: false },
          { beat: 16, time: 9, curve: 'ease-in-out', curveIntensity: 0.5, locked: false, selected: false },
        ],
      },
      {
        name: 'Swing',
        type: 'swing',
        description: 'Swing feel (long-short pattern)',
        points: [
          { beat: 0, time: 0, curve: 'linear', curveIntensity: 0.5, locked: true, selected: false },
          { beat: 0.5, time: 0.35, curve: 'ease-in', curveIntensity: 0.3, locked: false, selected: false },
          { beat: 1, time: 0.5, curve: 'linear', curveIntensity: 0.5, locked: false, selected: false },
          { beat: 1.5, time: 0.85, curve: 'ease-in', curveIntensity: 0.3, locked: false, selected: false },
          { beat: 2, time: 1, curve: 'linear', curveIntensity: 0.5, locked: false, selected: false },
          { beat: 4, time: 2, curve: 'linear', curveIntensity: 0.5, locked: false, selected: false },
        ],
      },
    ];
  }

  // ===========================================================================
  // Analysis
  // ===========================================================================

  public analyze(): BeatMapAnalysis {
    return calculateBeatMapAnalysis(this.state.config.points);
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<BeatMapState> {
    return this.state;
  }

  public getConfig(): Readonly<BeatMapConfig> {
    return this.state.config;
  }

  public setConfig(config: Partial<BeatMapConfig>): void {
    Object.assign(this.state.config, config);
    this.notifyListeners();
  }

  public setEnabled(enabled: boolean): void {
    this.state.config.enabled = enabled;
    this.notifyListeners();
  }

  public isEnabled(): boolean {
    return this.state.config.enabled;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (state: BeatMapState) => void): () => void {
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
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.state.config.points = [];
    this.state.selectedIds.clear();
    this.undoStack = [];
    this.redoStack = [];
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): BeatMapConfig {
    return { ...this.state.config };
  }

  public deserialize(config: Partial<BeatMapConfig>): void {
    Object.assign(this.state.config, config);
    this.sortPoints();
    this.notifyListeners();
  }
}

// =============================================================================
// Beat Map Edit Action
// =============================================================================

interface BeatMapEditAction {
  type: 'add' | 'remove' | 'move' | 'modify';
  points: BeatMapPoint[];
  oldPoints?: BeatMapPoint[];
}

// =============================================================================
// Factory
// =============================================================================

export function createBeatMapEngine(config?: Partial<BeatMapConfig>): BeatMapEngine {
  return new BeatMapEngine(config);
}

export default BeatMapEngine;
