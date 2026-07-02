'use client';

/**
 * AutomationCurve Component - Renders automation curves between points
 * 
 * Features:
 * - Renders curve lines between automation points
 * - Supports multiple curve types (linear, exponential, bezier)
 * - Visual distinction for different curve types
 * - Handles partial curves (when points are off-screen)
 */

import React, { useMemo } from 'react';
import { AutomationPoint, CurveType } from '../../engine/automation/types';
import { generateCurvePoints } from '../../engine/automation/curves';

interface AutomationCurveProps {
  pointA: AutomationPoint;
  pointB: AutomationPoint;
  laneMin: number;
  laneMax: number;
  viewStartBeat: number;
  viewEndBeat: number;
  height: number;
  pixelsPerBeat: number;
  color: string;
  isSelected: boolean;
  onCurveClick?: (pointAId: string, pointBId: string) => void;
}

export function AutomationCurve({
  pointA,
  pointB,
  laneMin,
  laneMax,
  viewStartBeat,
  viewEndBeat,
  height,
  pixelsPerBeat,
  color,
  isSelected,
  onCurveClick,
}: AutomationCurveProps) {
  // Generate path data for the curve
  const pathData = useMemo(() => {
    // Check if segment is visible
    if (pointB.beat < viewStartBeat || pointA.beat > viewEndBeat) {
      return null;
    }
    
    // Generate points along the curve
    const numPoints = Math.max(2, Math.ceil((pointB.beat - pointA.beat) * pixelsPerBeat / 5));
    const curvePoints = generateCurvePoints(pointA, pointB, numPoints);
    
    // Filter to visible range and convert to coordinates
    const visiblePoints = curvePoints.filter(p => 
      p.beat >= viewStartBeat && p.beat <= viewEndBeat
    );
    
    if (visiblePoints.length < 2) return null;
    
    // Convert to SVG path
    const valueToY = (value: number) => {
      const normalized = (value - laneMin) / (laneMax - laneMin);
      return height - (normalized * height);
    };
    
    const beatToX = (beat: number) => {
      return (beat - viewStartBeat) * pixelsPerBeat;
    };
    
    // Build path
    let path = `M ${beatToX(visiblePoints[0].beat)} ${valueToY(visiblePoints[0].value)}`;
    
    for (let i = 1; i < visiblePoints.length; i++) {
      path += ` L ${beatToX(visiblePoints[i].beat)} ${valueToY(visiblePoints[i].value)}`;
    }
    
    return path;
  }, [pointA, pointB, viewStartBeat, viewEndBeat, laneMin, laneMax, height, pixelsPerBeat]);
  
  // Get curve style based on type
  const getCurveStyle = (curve: CurveType) => {
    switch (curve) {
      case 'linear':
        return { strokeDasharray: 'none' };
      case 'exponential':
        return { strokeDasharray: '4,2' };
      case 'logarithmic':
        return { strokeDasharray: '2,2' };
      case 'bezier':
        return { strokeDasharray: '6,3,2,3' };
      case 'sCurve':
        return { strokeDasharray: '8,3' };
      case 'equalPower':
        return { strokeDasharray: '2,4' };
      case 'hold':
        return { strokeDasharray: 'none', strokeWidth: 1 };
      default:
        return { strokeDasharray: 'none' };
    }
  };
  
  // Handle click on curve
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCurveClick?.(pointA.id, pointB.id);
  };
  
  if (!pathData) return null;
  
  const curveStyle = getCurveStyle(pointA.curve);
  const hasNonLinearCurve = pointA.curve !== 'linear' && pointA.curve !== 'hold';
  const hasCurveAmount = Math.abs(pointA.curveAmount ?? 0) > 0.01;
  const curveColor = hasCurveAmount ? '#FCD34D' : color;
  
  return (
    <path
      d={pathData}
      fill="none"
      stroke={isSelected ? '#60A5FA' : curveColor}
      strokeWidth={isSelected ? 3 : hasCurveAmount ? 2.5 : 2}
      opacity={isSelected ? 1 : hasCurveAmount ? 0.9 : 0.6}
      style={{
        ...curveStyle,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onClick={handleClick}
    />
  );
}

// =============================================================================
// Multiple Curves Component
// =============================================================================

interface AutomationCurvesProps {
  points: AutomationPoint[];
  laneMin: number;
  laneMax: number;
  viewStartBeat: number;
  viewEndBeat: number;
  height: number;
  pixelsPerBeat: number;
  color: string;
  selectedPointIds: string[];
  selectedSegmentId?: string | null;
  hoveredSegmentId?: string | null;
  onCurveClick?: (pointAId: string, pointBId: string) => void;
}

export function AutomationCurves({
  points,
  laneMin,
  laneMax,
  viewStartBeat,
  viewEndBeat,
  height,
  pixelsPerBeat,
  color,
  selectedPointIds,
  selectedSegmentId,
  hoveredSegmentId,
  onCurveClick,
}: AutomationCurvesProps) {
  // Sort points by beat
  const sortedPoints = useMemo(() => {
    return [...points].sort((a, b) => a.beat - b.beat);
  }, [points]);
  
  // Generate curve segments
  const curves = useMemo(() => {
    const result: Array<{
      pointA: AutomationPoint;
      pointB: AutomationPoint;
      isPointSelected: boolean;
      isSegmentSelected: boolean;
      isSegmentHovered: boolean;
      key: string;
    }> = [];
    
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const pointA = sortedPoints[i];
      const pointB = sortedPoints[i + 1];
      const segmentId = `seg-${pointA.id}-${pointB.id}`;
      const isPointSelected = selectedPointIds.includes(pointA.id) || selectedPointIds.includes(pointB.id);
      
      result.push({
        pointA,
        pointB,
        isPointSelected,
        isSegmentSelected: selectedSegmentId === segmentId,
        isSegmentHovered: hoveredSegmentId === segmentId,
        key: segmentId,
      });
    }
    
    return result;
  }, [sortedPoints, selectedPointIds, selectedSegmentId, hoveredSegmentId]);
  
  return (
    <g>
      {curves.map(({ pointA, pointB, isPointSelected, isSegmentSelected, isSegmentHovered, key }) => (
        <AutomationCurve
          key={key}
          pointA={pointA}
          pointB={pointB}
          laneMin={laneMin}
          laneMax={laneMax}
          viewStartBeat={viewStartBeat}
          viewEndBeat={viewEndBeat}
          height={height}
          pixelsPerBeat={pixelsPerBeat}
          color={color}
          isSelected={isPointSelected || isSegmentSelected || isSegmentHovered}
          onCurveClick={onCurveClick}
        />
      ))}
    </g>
  );
}

export default AutomationCurves;
