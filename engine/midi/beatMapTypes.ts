/**
 * Beat Map Types - Non-linear Time Mapping
 *
 * Features:
 * - Map beats to arbitrary time positions
 * - Create accelerando/ritardando effects
 * - Define tempo curves with bezier interpolation
 * - Anchor points for locked positions
 * - Real-time conversion between beat and time
 */

// =============================================================================
// Beat Map Point Types
// =============================================================================

export interface BeatMapPoint {
  id: string;
  beat: number;           // Source beat position (can be fractional)
  time: number;           // Target time in seconds
  curve: CurveType;       // Interpolation curve to next point
  curveIntensity: number; // 0-1, how much the curve affects
  locked: boolean;        // Lock point from accidental moves
  selected: boolean;
  color?: string;
}

export type CurveType =
  | 'linear'       // Straight line
  | 'ease-in'      // Slow start, fast end
  | 'ease-out'     // Fast start, slow end
  | 'ease-in-out'  // Slow start and end
  | 'bezier'       // Custom bezier curve
  | 'step'         // No interpolation (jump)
  | 's-curve';     // S-shaped curve

export interface BezierHandle {
  x: number;        // -1 to 1 (relative to point)
  y: number;        // -1 to 1 (relative to point)
}

export interface BeatMapPointWithHandles extends BeatMapPoint {
  handleIn: BezierHandle;
  handleOut: BezierHandle;
}

// =============================================================================
// Beat Map Configuration
// =============================================================================

export interface BeatMapConfig {
  id: string;
  name: string;
  points: BeatMapPoint[];
  enabled: boolean;
  loop: boolean;
  loopStart: number;        // Beat
  loopEnd: number;          // Beat
  anchorToGrid: boolean;
  gridSize: number;         // Beat grid for snapping
  snapEnabled: boolean;
}

// =============================================================================
// Beat Map State
// =============================================================================

export interface BeatMapState {
  config: BeatMapConfig;
  selectedIds: Set<string>;
  hoveredId: string | null;
  dragState: BeatMapDragState | null;
  viewport: BeatMapViewport;
  editMode: BeatMapEditMode;
}

export type BeatMapEditMode = 'select' | 'draw' | 'erase' | 'curve';

export interface BeatMapDragState {
  type: 'move' | 'resize' | 'curve';
  pointId: string | null;
  startX: number;
  startY: number;
  originalBeat: number;
  originalTime: number;
  deltaX: number;
  deltaY: number;
}

export interface BeatMapViewport {
  startBeat: number;
  endBeat: number;
  startTime: number;
  endTime: number;
}

// =============================================================================
// Time Signature Integration
// =============================================================================

export interface TempoChangeEvent {
  beat: number;
  time: number;
  bpm: number;
  timeSignature: TimeSignature;
}

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

// =============================================================================
// Beat Map Conversion Results
// =============================================================================

export interface BeatToTimeResult {
  time: number;           // Time in seconds
  bpm: number;            // Instantaneous BPM at this beat
  timeSignature: TimeSignature;
  bar: number;
  beatInBar: number;
}

export interface TimeToBeatResult {
  beat: number;           // Beat position
  bpm: number;            // Instantaneous BPM at this time
  timeSignature: TimeSignature;
  bar: number;
  beatInBar: number;
}

// =============================================================================
// Beat Map Presets
// =============================================================================

export type BeatMapPresetType =
  | 'linear'              // No tempo change (constant)
  | 'accelerando'         // Gradually speed up
  | 'ritardando'          // Gradually slow down
  | 'rubato'              // Free tempo
  | 'swing'               // Swing feel
  | 'custom';             // User-defined

export interface BeatMapPreset {
  name: string;
  type: BeatMapPresetType;
  description: string;
  points: Omit<BeatMapPoint, 'id'>[];
}

// =============================================================================
// Beat Map Analysis
// =============================================================================

export interface BeatMapAnalysis {
  totalBeats: number;
  totalTime: number;
  averageBPM: number;
  minBPM: number;
  maxBPM: number;
  tempoRange: number;         // maxBPM - minBPM
  isLinear: boolean;          // All points on straight line
  pointCount: number;
  lockedCount: number;
}

// =============================================================================
// Beat Map Export
// =============================================================================

export interface BeatMapExport {
  format: 'json' | 'csv';
  version: number;
  config: BeatMapConfig;
  metadata: {
    exportedAt: number;
    totalBeats: number;
    totalTime: number;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

export function createBeatMapPoint(
  beat: number,
  time: number,
  curve: CurveType = 'linear',
  options: Partial<Omit<BeatMapPoint, 'id' | 'beat' | 'time' | 'curve'>> = {}
): BeatMapPoint {
  return {
    id: `bmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    beat,
    time,
    curve,
    curveIntensity: options.curveIntensity ?? 0.5,
    locked: options.locked ?? false,
    selected: options.selected ?? false,
    color: options.color,
  };
}

export function createDefaultBeatMapConfig(): BeatMapConfig {
  return {
    id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Beat Map',
    points: [
      createBeatMapPoint(0, 0, 'linear', { locked: true }),
      createBeatMapPoint(4, 2, 'linear'),
      createBeatMapPoint(8, 4, 'linear'),
    ],
    enabled: true,
    loop: false,
    loopStart: 0,
    loopEnd: 8,
    anchorToGrid: true,
    gridSize: 0.25,        // 16th note grid
    snapEnabled: true,
  };
}

export function calculateBeatMapBPM(
  point1: BeatMapPoint,
  point2: BeatMapPoint
): number {
  const beatDelta = point2.beat - point1.beat;
  const timeDelta = point2.time - point1.time;

  if (timeDelta <= 0 || beatDelta <= 0) return 120;

  // BPM = (beats per second) * 60
  const beatsPerSecond = beatDelta / timeDelta;
  return beatsPerSecond * 60;
}

export function calculateBeatMapAnalysis(points: BeatMapPoint[]): BeatMapAnalysis {
  if (points.length === 0) {
    return {
      totalBeats: 0,
      totalTime: 0,
      averageBPM: 120,
      minBPM: 120,
      maxBPM: 120,
      tempoRange: 0,
      isLinear: true,
      pointCount: 0,
      lockedCount: 0,
    };
  }

  const sorted = [...points].sort((a, b) => a.beat - b.beat);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalBeats = last.beat - first.beat;
  const totalTime = last.time - first.time;

  // Calculate BPM for each segment
  const bpms: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    bpms.push(calculateBeatMapBPM(sorted[i - 1], sorted[i]));
  }

  const minBPM = bpms.length > 0 ? Math.min(...bpms) : 120;
  const maxBPM = bpms.length > 0 ? Math.max(...bpms) : 120;
  const averageBPM = bpms.length > 0
    ? bpms.reduce((a, b) => a + b, 0) / bpms.length
    : 120;

  // Check if linear (all points on straight line)
  let isLinear = true;
  if (sorted.length > 2) {
    const avgBPM = calculateBeatMapBPM(first, last);
    for (let i = 1; i < sorted.length; i++) {
      const segBPM = calculateBeatMapBPM(sorted[i - 1], sorted[i]);
      if (Math.abs(segBPM - avgBPM) > 1) {
        isLinear = false;
        break;
      }
    }
  }

  return {
    totalBeats,
    totalTime,
    averageBPM,
    minBPM,
    maxBPM,
    tempoRange: maxBPM - minBPM,
    isLinear,
    pointCount: points.length,
    lockedCount: points.filter(p => p.locked).length,
  };
}

export default BeatMapPoint;
