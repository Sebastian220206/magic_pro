'use client';

/**
 * AutomationPoint Component - Individual automation point handle
 * 
 * Features:
 * - Draggable handle
 * - Selection state
 * - Curve type indicator
 * - Hover effects
 * - Value tooltip
 */

import React, { useState, useCallback } from 'react';
import { AutomationPoint as AutomationPointType, CurveType } from '../../engine/automation/types';
import { curveTypeLabels } from '../../engine/automation/curves';

interface AutomationPointProps {
  point: AutomationPointType;
  isSelected: boolean;
  isDragging: boolean;
  x: number;
  y: number;
  color: string;
  laneMin: number;
  laneMax: number;
  onMouseDown: (e: React.MouseEvent, pointId: string) => void;
  onContextMenu: (e: React.MouseEvent, pointId: string) => void;
  onDoubleClick?: (pointId: string) => void;
  showValue?: boolean;
}

export function AutomationPointComponent({
  point,
  isSelected,
  isDragging,
  x,
  y,
  color,
  laneMin,
  laneMax,
  onMouseDown,
  onContextMenu,
  onDoubleClick,
  showValue = true,
}: AutomationPointProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Calculate actual value for display
  const actualValue = laneMin + (point.value * (laneMax - laneMin));
  
  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMouseDown(e, point.id);
  }, [onMouseDown, point.id]);
  
  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, point.id);
  }, [onContextMenu, point.id]);
  
  // Handle double click
  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(point.id);
  }, [onDoubleClick, point.id]);
  
  // Get curve indicator symbol
  const getCurveSymbol = (curve: CurveType): string => {
    switch (curve) {
      case 'linear': return '─';
      case 'exponential': return '⌢';
      case 'logarithmic': return '⌣';
      case 'bezier': return '∿';
      case 'hold': return '├';
      default: return '─';
    }
  };
  
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Selection glow */}
      {isSelected && (
        <circle
          r={10}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.4}
        />
      )}
      
      {/* Hover glow */}
      {isHovered && !isSelected && (
        <circle
          r={8}
          fill="none"
          stroke={color}
          strokeWidth={1}
          opacity={0.3}
        />
      )}
      
      {/* Main point handle */}
      <circle
        r={isSelected ? 6 : 5}
        fill={isSelected ? color : '#1F2937'}
        stroke={color}
        strokeWidth={2}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          filter: isDragging ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none',
        }}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />
      
      {/* Curve type indicator (small icon) */}
      <text
        x={8}
        y={-8}
        fill={color}
        fontSize={10}
        fontFamily="monospace"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {getCurveSymbol(point.curve)}
      </text>
      
      {/* Value tooltip on hover */}
      {(isHovered || isSelected) && showValue && (
        <g transform="translate(12, -20)">
          <rect
            x={0}
            y={-12}
            width={80}
            height={24}
            rx={4}
            fill="#1F2937"
            stroke={color}
            strokeWidth={1}
          />
          <text
            x={40}
            y={4}
            fill="white"
            fontSize={10}
            textAnchor="middle"
            style={{ userSelect: 'none' }}
          >
            {`B:${point.beat.toFixed(2)} V:${actualValue.toFixed(2)}`}
          </text>
          <text
            x={40}
            y={16}
            fill={color}
            fontSize={8}
            textAnchor="middle"
            style={{ userSelect: 'none' }}
          >
            {curveTypeLabels[point.curve]}
          </text>
        </g>
      )}
    </g>
  );
}

export default AutomationPointComponent;
