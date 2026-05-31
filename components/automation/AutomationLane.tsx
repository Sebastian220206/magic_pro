'use client';

/**
 * AutomationLane Component - Full automation lane with grid, points, and curves
 * 
 * Features:
 * - Grid lines for beats and values
 * - Automation curves
 * - Draggable points
 * - Parameter label
 * - Expand/collapse
 * - Value axis
 */

import React, { useRef, useCallback, useState } from 'react';
import { AutomationLane, AutomationPoint } from '../../engine/automation/types';
import { AutomationCurves } from './AutomationCurve';
import { AutomationPointComponent } from './AutomationPoint';

interface AutomationLaneProps {
  lane: AutomationLane;
  isSelected: boolean;
  selectedPointIds: string[];
  draggingPointId: string | null;
  viewStartBeat: number;
  viewEndBeat: number;
  pixelsPerBeat: number;
  height: number;
  trackColor?: string;
  onPointMouseDown: (e: React.MouseEvent, pointId: string) => void;
  onPointContextMenu: (e: React.MouseEvent, pointId: string) => void;
  onPointDoubleClick: (pointId: string) => void;
  onCurveClick?: (pointAId: string, pointBId: string) => void;
  onLaneClick?: (e: React.MouseEvent) => void;
  onLaneDoubleClick?: (e: React.MouseEvent) => void;
  onAddPoint?: (beat: number, value: number) => void;
}

export function AutomationLaneComponent({
  lane,
  isSelected,
  selectedPointIds,
  draggingPointId,
  viewStartBeat,
  viewEndBeat,
  pixelsPerBeat,
  height,
  trackColor = '#3B82F6',
  onPointMouseDown,
  onPointContextMenu,
  onPointDoubleClick,
  onCurveClick,
  onLaneClick,
  onLaneDoubleClick,
  onAddPoint,
}: AutomationLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Calculate dimensions
  const width = (viewEndBeat - viewStartBeat) * pixelsPerBeat;
  const valueRange = lane.max - lane.min;
  
  // Value to Y coordinate
  const valueToY = useCallback((value: number) => {
    const normalized = (value - lane.min) / valueRange;
    return height - (normalized * height);
  }, [lane.min, lane.max, height, valueRange]);
  
  // Y coordinate to value
  const yToValue = useCallback((y: number) => {
    const normalized = (height - y) / height;
    return lane.min + (normalized * valueRange);
  }, [lane.min, lane.max, height, valueRange]);
  
  // Beat to X coordinate
  const beatToX = useCallback((beat: number) => {
    return (beat - viewStartBeat) * pixelsPerBeat;
  }, [viewStartBeat, pixelsPerBeat]);
  
  // X coordinate to beat
  const xToBeat = useCallback((x: number) => {
    return viewStartBeat + (x / pixelsPerBeat);
  }, [viewStartBeat, pixelsPerBeat]);
  
  // Generate grid lines
  const generateGridLines = () => {
    const lines = [];
    
    // Vertical lines (beats)
    const beatStep = 1;
    for (let beat = Math.ceil(viewStartBeat); beat <= viewEndBeat; beat += beatStep) {
      const x = beatToX(beat);
      const isBar = beat % 4 === 0;
      lines.push(
        <line
          key={`v-${beat}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          stroke={isBar ? '#4B5563' : '#374151'}
          strokeWidth={isBar ? 1 : 0.5}
          opacity={isBar ? 0.6 : 0.3}
        />
      );
    }
    
    // Horizontal lines (values)
    const valueStep = valueRange / 4;
    for (let i = 0; i <= 4; i++) {
      const value = lane.min + (i * valueStep);
      const y = valueToY(value);
      lines.push(
        <line
          key={`h-${i}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="#374151"
          strokeWidth={0.5}
          opacity={0.3}
          strokeDasharray="2,2"
        />
      );
    }
    
    return lines;
  };
  
  // Generate value labels
  const generateValueLabels = () => {
    const labels = [];
    const valueStep = valueRange / 4;
    
    for (let i = 0; i <= 4; i++) {
      const value = lane.min + (i * valueStep);
      const y = valueToY(value);
      labels.push(
        <text
          key={`label-${i}`}
          x={5}
          y={y - 4}
          fill="#9CA3AF"
          fontSize={10}
          style={{ userSelect: 'none' }}
        >
          {value.toFixed(1)}
        </text>
      );
    }
    
    return labels;
  };
  
  // Handle click on lane (add point)
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === 'svg') {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const beat = xToBeat(x);
        const value = yToValue(y);
        
        if (onAddPoint && e.detail === 2) {
          // Double click - don't add, let parent handle
          onLaneDoubleClick?.(e);
        } else if (onAddPoint) {
          onAddPoint(beat, value);
        } else {
          onLaneClick?.(e);
        }
      }
    }
  }, [xToBeat, yToValue, onAddPoint, onLaneClick, onLaneDoubleClick]);
  
  // Filter visible points
  const visiblePoints = lane.points.filter(p => 
    p.beat >= viewStartBeat - 1 && p.beat <= viewEndBeat + 1
  );
  
  if (lane.collapsed) {
    return (
      <div 
        className="h-6 bg-gray-800 border-b border-gray-700 flex items-center px-2 cursor-pointer hover:bg-gray-750"
        style={{ borderLeft: `3px solid ${lane.color}` }}
      >
        <span className="text-xs text-gray-400 truncate">{lane.displayName}</span>
        <span className="ml-auto text-xs text-gray-500">{lane.points.length} points</span>
      </div>
    );
  }
  
  return (
    <div 
      className={`relative bg-gray-900 border-b border-gray-800 ${isSelected ? 'ring-1 ring-blue-500' : ''}`}
      style={{ height }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Lane header */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-24 bg-gray-800 border-r border-gray-700 flex flex-col justify-center px-2 z-10"
        style={{ borderLeft: `3px solid ${lane.color}` }}
      >
        <span className="text-xs font-medium text-gray-300 truncate" title={lane.displayName}>
          {lane.displayName}
        </span>
        <span className="text-xs text-gray-500">
          {lane.min.toFixed(0)} - {lane.max.toFixed(0)}
        </span>
      </div>
      
      {/* Automation canvas */}
      <svg
        ref={svgRef}
        className="absolute left-24 right-0 top-0 bottom-0 cursor-crosshair"
        onClick={handleClick}
        style={{ background: 'transparent' }}
      >
        {/* Grid */}
        <g className="grid-lines">
          {generateGridLines()}
        </g>
        
        {/* Value labels */}
        <g className="value-labels">
          {generateValueLabels()}
        </g>
        
        {/* Default value line */}
        <line
          x1={0}
          y1={valueToY(lane.defaultValue)}
          x2={width}
          y2={valueToY(lane.defaultValue)}
          stroke={lane.color}
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.3}
        />
        
        {/* Automation curves */}
        <AutomationCurves
          points={lane.points}
          laneMin={lane.min}
          laneMax={lane.max}
          viewStartBeat={viewStartBeat}
          viewEndBeat={viewEndBeat}
          height={height}
          pixelsPerBeat={pixelsPerBeat}
          color={lane.color}
          selectedPointIds={selectedPointIds}
          onCurveClick={onCurveClick}
        />
        
        {/* Automation points */}
        <g className="automation-points">
          {visiblePoints.map(point => (
            <AutomationPointComponent
              key={point.id}
              point={point}
              isSelected={selectedPointIds.includes(point.id)}
              isDragging={draggingPointId === point.id}
              x={beatToX(point.beat)}
              y={valueToY(point.value)}
              color={lane.color}
              laneMin={lane.min}
              laneMax={lane.max}
              onMouseDown={onPointMouseDown}
              onContextMenu={onPointContextMenu}
              onDoubleClick={onPointDoubleClick}
            />
          ))}
        </g>
        
        {/* Hover indicator for adding points */}
        {isHovered && onAddPoint && (
          <text
            x={width / 2}
            y={20}
            fill="#9CA3AF"
            fontSize={10}
            textAnchor="middle"
            opacity={0.6}
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            Click to add point
          </text>
        )}
      </svg>
    </div>
  );
}

export default AutomationLaneComponent;
