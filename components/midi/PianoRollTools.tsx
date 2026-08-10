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
  Palette,
  Play,
  PanelBottomOpen,
  PanelBottomClose,
  ArrowUpDown,
  Link,
  Scissors,
  Merge,
  BoxSelect,
  Maximize2,
  ArrowRightToLine,
  VolumeX,
  Paintbrush,
  GripHorizontal,
} from 'lucide-react';
import { PianoRollTool } from '../../engine/midi/types';
import { PianoRollLinkMode } from '../../engine/pianoRoll/projectSync';

interface PianoRollToolsProps {
  currentTool: PianoRollTool;
  gridDivision: number;
  snapToGrid: boolean;
  onToolChange: (tool: PianoRollTool) => void;
  onGridDivisionChange: (division: number) => void;
  onToggleSnap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomInVertical: () => void;
  onZoomOutVertical: () => void;
  onQuantize: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  activeChannel: number;
  channelFilter: number | null;
  onChannelChange: (channel: number) => void;
  onChannelFilterChange: (channel: number | null) => void;
  slideMode: boolean;
  portaMode: boolean;
  showEventEditor: boolean;
  onSlideModeChange: (active: boolean) => void;
  onPortaModeChange: (active: boolean) => void;
  onToggleEventEditor: () => void;
  stepInputEnabled: boolean;
  onToggleStepInput: () => void;
  drawDuration: number;
  onDrawDurationChange: (duration: number) => void;
  linkMode: PianoRollLinkMode;
  onLinkModeChange: (mode: PianoRollLinkMode) => void;
  onSplitNote: () => void;
  onJoinNotes: () => void;
  onZoomToSelection?: () => void;
  onGoToBeat?: () => void;
}

const TOOLS: Array<{ id: PianoRollTool; icon: React.ReactNode; label: string; shortcut: string }> = [
  { id: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select', shortcut: 'S' },
  { id: 'draw', icon: <Pencil className="w-4 h-4" />, label: 'Draw', shortcut: 'B' },
  { id: 'erase', icon: <Eraser className="w-4 h-4" />, label: 'Erase', shortcut: 'E' },
  { id: 'velocity', icon: <Activity className="w-4 h-4" />, label: 'Velocity', shortcut: 'V' },
  { id: 'mute', icon: <VolumeX className="w-4 h-4" />, label: 'Mute', shortcut: 'M' },
  { id: 'brush', icon: <Paintbrush className="w-4 h-4" />, label: 'Brush', shortcut: 'A' },
  { id: 'scissors', icon: <Scissors className="w-4 h-4" />, label: 'Scissors', shortcut: 'C' },
  { id: 'glue', icon: <GripHorizontal className="w-4 h-4" />, label: 'Glue', shortcut: 'G' },
  { id: 'lasso', icon: <MousePointer2 className="w-4 h-4" />, label: 'Lasso', shortcut: 'L' },
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
  onZoomInVertical,
  onZoomOutVertical,
  onQuantize,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  activeChannel,
  channelFilter,
  onChannelChange,
  onChannelFilterChange,
  slideMode,
  portaMode,
  showEventEditor,
  onSlideModeChange,
  onPortaModeChange,
  onToggleEventEditor,
  drawDuration,
  onDrawDurationChange,
  linkMode,
  onLinkModeChange,
  onSplitNote,
  onJoinNotes,
  stepInputEnabled,
  onToggleStepInput,
  onZoomToSelection,
  onGoToBeat,
}: PianoRollToolsProps) {
  const handleToolClick = useCallback((tool: PianoRollTool) => {
    onToolChange(tool);
  }, [onToolChange]);

  return (
    <div className="flex items-center gap-2 p-2 bg-studio-panel border-b border-studio-line">
      {/* Tools */}
      <div className="flex items-center gap-1 bg-studio-sunken rounded-lg p-1">
        {TOOLS.map(({ id, icon, label, shortcut }) => (
          <button
            key={id}
            onClick={() => handleToolClick(id)}
            className={`
              flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors
              ${currentTool === id 
                ? 'bg-accent-cyan text-white' 
                : 'text-studio-text-mid hover:text-white hover:bg-studio-panel'
              }
            `}
            title={`${label} (${shortcut})`}
          >
            {icon}
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-studio-raised mx-1" />

      {/* Grid Controls */}
      <div className="flex items-center gap-2">
        <Grid3x3 className="w-4 h-4 text-studio-text-dim" />
        
        <select
          value={gridDivision}
          onChange={(e) => onGridDivisionChange(Number(e.target.value))}
          className="bg-studio-sunken text-studio-text text-sm rounded px-2 py-1 border border-studio-line focus:outline-none focus:border-accent-cyan"
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
              ? 'text-accent-cyan bg-accent-cyan/10' 
              : 'text-studio-text-dim hover:text-studio-text'
            }
          `}
          title="Snap to Grid (Cmd+G)"
        >
          <Magnet className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-studio-raised mx-1" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-studio-text-dim mr-0.5">H</span>
        <button
          onClick={onZoomOut}
          className="p-1.5 rounded text-studio-text-mid hover:text-white hover:bg-studio-raised"
          title="Zoom Out Horizontal (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomIn}
          className="p-1.5 rounded text-studio-text-mid hover:text-white hover:bg-studio-raised"
          title="Zoom In Horizontal (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[10px] text-studio-text-dim ml-1 mr-0.5">V</span>
        <button
          onClick={onZoomOutVertical}
          className="p-1.5 rounded text-studio-text-mid hover:text-white hover:bg-studio-raised"
          title="Zoom Out Vertical"
        >
          <ArrowUpDown className="w-3 h-3 opacity-50" />
        </button>
        <button
          onClick={onZoomInVertical}
          className="p-1.5 rounded text-studio-text-mid hover:text-white hover:bg-studio-raised"
          title="Zoom In Vertical"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-studio-raised mx-1" />

      {/* Zoom to Selection / Go To Beat */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomToSelection}
          className="p-1.5 rounded text-studio-text-mid hover:text-white hover:bg-studio-raised transition-colors"
          title="Zoom to Selection"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={onGoToBeat}
          className="p-1.5 rounded text-studio-text-mid hover:text-white hover:bg-studio-raised transition-colors"
          title="Go to Beat/Measure..."
        >
          <ArrowRightToLine className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-studio-raised mx-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onQuantize}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-studio-raised text-studio-text text-sm hover:bg-studio-control transition-colors"
          title="Quantize (Q)"
        >
          <Music className="w-4 h-4" />
          <span>Quantize</span>
        </button>
      </div>

      <div className="w-px h-6 bg-studio-raised mx-1" />

      {/* Link Mode */}
      <div className="flex items-center gap-1" title="Piano Roll Link Mode">
        <Link className="w-4 h-4 text-studio-text-dim" />
        <select
          value={linkMode}
          onChange={(e) => onLinkModeChange(e.target.value as PianoRollLinkMode)}
          className="bg-studio-sunken text-studio-text text-sm rounded px-1 py-1 border border-studio-line focus:outline-none focus:border-accent-cyan"
        >
          <option value="single">Single</option>
          <option value="selected">Selected</option>
          <option value="folder">Folder</option>
          <option value="project">Project</option>
        </select>
      </div>

      <div className="w-px h-6 bg-studio-raised mx-1" />

      {/* Draw Duration Presets */}
      <div className="flex items-center gap-1" title="Note Length for Draw Tool">
        <span className="text-[10px] text-studio-text-dim">Len</span>
        {([0.25, 0.5, 1, 2] as number[]).map(dur => (
          <button
            key={dur}
            onClick={() => onDrawDurationChange(dur)}
            className={`
              px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors
              ${drawDuration === dur
                ? 'bg-accent-cyan text-white'
                : 'bg-studio-raised text-studio-text-mid hover:bg-studio-control'
              }
            `}
            title={`Draw ${dur < 1 ? `1/${1/dur}` : dur + ' beat'} note`}
          >
            {dur < 1 ? `1/${1/dur}` : dur + 'b'}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-studio-raised mx-1" />

      {/* Split / Join */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onSplitNote()}
          className="p-1.5 rounded text-studio-text-mid hover:text-white hover:bg-studio-raised transition-colors"
          title="Split Note at Playhead (X)"
        >
          <Scissors className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onJoinNotes()}
          className="p-1.5 rounded text-studio-text-mid hover:text-white hover:bg-studio-raised transition-colors"
          title="Join Selected Notes (J)"
        >
          <Merge className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleStepInput}
          className={`
            p-1.5 rounded transition-colors flex items-center gap-1 text-sm
            ${stepInputEnabled
              ? 'text-accent-cyan bg-accent-cyan/10'
              : 'text-studio-text-dim hover:text-studio-text'
            }
          `}
          title="Step Input (Tab)"
        >
          <Grid3x3 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-6 bg-studio-raised mx-1" />

      {/* FL Studio specific note tools */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1" title="Note Color Group (MIDI Channel)">
          <Palette className="w-4 h-4 text-studio-text-dim" />
          <select
            value={activeChannel}
            onChange={(e) => onChannelChange(Number(e.target.value))}
            className="bg-studio-sunken text-studio-text text-sm rounded px-1 py-1 border border-studio-line focus:outline-none focus:border-accent-cyan"
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <option key={i} value={i}>Color {i + 1}</option>
            ))}
          </select>
        </div>

        {/* Channel Filter */}
        <div className="flex items-center gap-1" title="Channel Filter">
          <select
            value={channelFilter !== null ? channelFilter : ''}
            onChange={(e) => onChannelFilterChange(e.target.value === '' ? null : Number(e.target.value))}
            className="bg-studio-sunken text-studio-text text-sm rounded px-1 py-1 border border-studio-line focus:outline-none focus:border-accent-cyan"
          >
            <option value="">All Channels</option>
            {Array.from({ length: 16 }).map((_, i) => (
              <option key={i} value={i}>Ch {i + 1}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => onSlideModeChange(!slideMode)}
          className={`
            p-1.5 rounded transition-colors flex items-center gap-1 text-sm
            ${slideMode 
              ? 'text-accent-cyan bg-accent-cyan/10' 
              : 'text-studio-text-dim hover:text-studio-text'
            }
          `}
          title="Slide Note Mode"
        >
          <Play className="w-4 h-4 -rotate-45" />
        </button>

        <button
          onClick={() => onPortaModeChange(!portaMode)}
          className={`
            p-1.5 rounded transition-colors flex items-center gap-1 text-sm font-bold
            ${portaMode 
              ? 'text-accent-cyan bg-accent-cyan/10' 
              : 'text-studio-text-dim hover:text-studio-text'
            }
          `}
          title="Portamento Mode"
        >
          /
        </button>
        <button
          onClick={onToggleEventEditor}
          className={`
            p-1.5 rounded transition-colors flex items-center gap-1 text-sm
            ${showEventEditor
              ? 'text-accent-cyan bg-accent-cyan/10'
              : 'text-studio-text-dim hover:text-studio-text'
            }
          `}
          title="Toggle Event Editor"
        >
          {showEventEditor
            ? <PanelBottomOpen className="w-4 h-4" />
            : <PanelBottomClose className="w-4 h-4" />
          }
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
              ? 'text-studio-text-mid hover:text-white hover:bg-studio-raised' 
              : 'text-studio-text-dim cursor-not-allowed'
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
              ? 'text-studio-text-mid hover:text-white hover:bg-studio-raised' 
              : 'text-studio-text-dim cursor-not-allowed'
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
