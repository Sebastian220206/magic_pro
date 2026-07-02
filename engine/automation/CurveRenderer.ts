import { AutomationPoint, AutomationSegment, CurveType, AutomationLane } from './types';
import { evaluateCurveAtT } from './AutomationInterpolation';

export interface CurveRenderPoint {
  x: number;
  y: number;
}

export function generateCurvePath(
  pointA: AutomationPoint,
  pointB: AutomationPoint,
  pixelsPerBeat: number,
  pixelsPerValue: number,
  numPoints: number = 32
): CurveRenderPoint[] {
  const points: CurveRenderPoint[] = [];
  const startX = pointA.beat * pixelsPerBeat;
  const endX = pointB.beat * pixelsPerBeat;
  const width = endX - startX;

  if (width <= 0) return [{ x: startX, y: (1 - pointA.value) * pixelsPerValue }];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const value = evaluateCurveAtT(pointA, pointB, t);
    const x = startX + width * t;
    const y = (1 - value) * pixelsPerValue;
    points.push({ x, y });
  }

  return points;
}

export function curvePathToSvgD(points: CurveRenderPoint[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

export function renderSegmentCurve(
  segment: AutomationSegment,
  lane: AutomationLane,
  pixelsPerBeat: number,
  pixelsPerValue: number
): CurveRenderPoint[] {
  const pointA = lane.points.find(p => p.id === segment.startPointId);
  const pointB = lane.points.find(p => p.id === segment.endPointId);
  if (!pointA || !pointB) return [];

  return generateCurvePath(pointA, pointB, pixelsPerBeat, pixelsPerValue);
}

export function getSegmentCenter(
  segment: AutomationSegment,
  pixelsPerBeat: number,
  pixelsPerValue: number
): { x: number; y: number } {
  const midBeat = (segment.startBeat + segment.endBeat) / 2;
  const midValue = (segment.startValue + segment.endValue) / 2;
  return {
    x: midBeat * pixelsPerBeat,
    y: (1 - midValue) * pixelsPerValue,
  };
}

export function getCurveTooltipText(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${(amount * 100).toFixed(0)}%`;
}

export function getSegmentColor(
  segment: AutomationSegment,
  isHovered: boolean,
  isSelected: boolean,
  laneColor: string
): string {
  if (isSelected) return '#60A5FA';
  if (isHovered) return '#93C5FD';
  if (segment.curveType !== 'linear' && Math.abs(segment.curveAmount) > 0.01) {
    return '#FCD34D';
  }
  return laneColor;
}

export function getSegmentStrokeWidth(
  isHovered: boolean,
  isSelected: boolean,
  isDragging: boolean
): number {
  if (isDragging) return 4;
  if (isSelected) return 3;
  if (isHovered) return 2;
  return 1.5;
}
