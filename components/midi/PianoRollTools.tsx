'use client';

/**
 * PianoRollTools - Toolbar for piano roll editing tools
 * 
 * Features:
 * - Tool selection (Select, Draw, Erase, Velocity)
 * - Grid division selector
 * - Zoom controls
 * - Quantize button
 * - Keyboard shortcuts
 */

import React, { memo, useCallback } from 'react';
import { 
  MousePointer2, 
  Pencil, 
  Eraser, 
  Activity,
  ZoomIn,
  ZoomOut,
  Grid3x3,
  Magnet,
  Music,
  Undo,
  Redo,
} from 'lucide-react';
import { PianoRollTool } from '../../engine/midi/types';

interface PianoRollToolsProps {
  currentTool: PianoRollTool;
  gridDivision: number;
  snapToGrid: boolean;
  onToolChange: (tool: PianoRollTool) => void;
  onGridDivisionChange: (division: number) => void;
  onToggleSnap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onQuantize: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

const TOOLS: Array<{ id: PianoRollTool; icon: React.ReactNode; label: string; shortcut: string }> = [
  { id: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select', shortcut: 'S' },
  { id: 'draw', icon: <Pencil className="w-4 h-4" />, label: 'Draw', shortcut: 'B' },
  { id: 'erase', icon: <Eraser className="w-4 h-4" />, label: 'Erase', shortcut: 'E' },
  { id: 'velocity', icon: <Activity className="w-4 h-4" />, label: 'Velocity', shortcut: 'V' },
];

const GRID_DIVISIONS = [
  { value: 4, label: '1/4' },
  { value: 8, label: '1/8' },
  { value: 16, label: '1/16' },
  { value: 32, label: '1/32' },
];

export const PianoRollTools = memo(function PianoRollTools({
  currentTool,
  gridDivision,
  snapToGrid,
  onToolChange,
  onGridDivisionChange,
  onToggleSnap,
  onZoomIn,
  onZoomOut,
  onQuantize,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: PianoRollToolsProps) {
  const handleToolClick = useCallback((tool: PianoRollTool) => {
    onToolChange(tool);
  }, [onToolChange]);

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
      {/* Tools */}
      <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1">
        {TOOLS.map(({ id, icon, label, shortcut }) => (
          <button
            key={id}
            onClick={() => handleToolClick(id)}
            className={`
              flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors
              ${currentTool === id 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }
            `}
            title={`${label} (${shortcut})`}
          >
            {icon}
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Grid Controls */}
      <div className="flex items-center gap-2">
        <Grid3x3 className="w-4 h-4 text-gray-500" />
        
        <select
          value={gridDivision}
          onChange={(e) => onGridDivisionChange(Number(e.target.value))}
          className="bg-gray-900 text-gray-300 text-sm rounded px-2 py-1 border border-gray-700 focus:outline-none focus:border-blue-500"
        >
          {GRID_DIVISIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button
          onClick={onToggleSnap}
          className={`
            p-1.5 rounded transition-colors
            ${snapToGrid 
              ? 'text-blue-400 bg-blue-400/10' 
              : 'text-gray-500 hover:text-gray-300'
            }
          `}
          title="Snap to Grid (Cmd+G)"
        >
          <Magnet className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomIn}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onQuantize}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
          title="Quantize (Q)"
        >
          <Music className="w-4 h-4" />
          <span>Quantize</span>
        </button>
      </div>

      <div className="flex-1" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`
            p-1.5 rounded transition-colors
            ${canUndo 
              ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
              : 'text-gray-600 cursor-not-allowed'
            }
          `}
          title="Undo (Cmd+Z)"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`
            p-1.5 rounded transition-colors
            ${canRedo 
              ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
              : 'text-gray-600 cursor-not-allowed'
            }
          `}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default PianoRollTools;
