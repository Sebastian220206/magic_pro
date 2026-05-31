'use client';

/**
 * AutomationEditor - Full automation editing interface
 * 
 * Features:
 * - Multiple automation lanes
 * - Zoom and scroll
 * - Draw/Select/Erase tools
 * - Point editing with drag
 * - Curve type switching
 * - Recording mode buttons
 * - Transport sync
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { 
  MousePointer2, 
  Pencil, 
  Eraser, 
  ZoomIn, 
  ZoomOut,
  Maximize2,
  Grid3X3,
  Circle,
  Square,
  GripVertical
} from 'lucide-react';
import useAutomationStore, { selectLanesForTrack } from '../../store/automationStore';
import { AutomationLaneComponent } from './AutomationLane';
import { AutomationPoint, AutomationTool, CurveType } from '../../engine/automation/types';
import { nextCurveType, curveTypeLabels } from '../../engine/automation/curves';

interface AutomationEditorProps {
  trackId: string;
  trackColor?: string;
  tempo: number;
  isPlaying: boolean;
  currentBeat: number;
}

const LANE_HEIGHT = 80;
const HEADER_HEIGHT = 40;

export function AutomationEditor({
  trackId,
  trackColor = '#3B82F6',
  tempo,
  isPlaying,
  currentBeat,
}: AutomationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Get store state and actions
  const {
    lanes,
    visibleTrackIds,
    selectedLaneId,
    selectedPointIds,
    currentTool,
    snapToGrid,
    gridDivision,
    viewport,
    dragState,
    setViewport,
    setTool,
    setSnapToGrid,
    addPoint,
    deletePoint,
    selectPoint,
    deselectPoint,
    clearSelection,
    startDrag,
    updateDrag,
    endDrag,
    setPointCurve,
    cyclePointCurve,
    selectLane,
  } = useAutomationStore();
  
  // Get lanes for this track
  const trackLanes = lanes.filter(lane => lane.trackId === trackId);
  const visibleLanes = trackLanes.filter(lane => visibleTrackIds.includes(trackId) && lane.visible);
  
  // Update container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);
  
  // Sync with playback
  useEffect(() => {
    if (isPlaying) {
      // Auto-scroll to follow playhead
      const viewWidth = viewport.endBeat - viewport.startBeat;
      const centerBeat = viewport.startBeat + (viewWidth / 2);
      
      if (Math.abs(currentBeat - centerBeat) > viewWidth * 0.4) {
        setViewport({
          startBeat: currentBeat - (viewWidth / 2),
          endBeat: currentBeat + (viewWidth / 2),
        });
      }
    }
  }, [currentBeat, isPlaying, viewport, setViewport]);
  
  // Calculate pixels per beat
  const pixelsPerBeat = (containerWidth - 96) / (viewport.endBeat - viewport.startBeat);
  
  // Handle zoom
  const handleZoomIn = () => {
    const viewWidth = viewport.endBeat - viewport.startBeat;
    const center = viewport.startBeat + (viewWidth / 2);
    const newWidth = Math.max(4, viewWidth * 0.8);
    
    setViewport({
      startBeat: center - (newWidth / 2),
      endBeat: center + (newWidth / 2),
    });
  };
  
  const handleZoomOut = () => {
    const viewWidth = viewport.endBeat - viewport.startBeat;
    const center = viewport.startBeat + (viewWidth / 2);
    const newWidth = Math.min(256, viewWidth * 1.25);
    
    setViewport({
      startBeat: center - (newWidth / 2),
      endBeat: center + (newWidth / 2),
    });
  };
  
  const handleZoomToFit = () => {
    if (visibleLanes.length === 0) return;
    
    let minBeat = Infinity;
    let maxBeat = -Infinity;
    
    for (const lane of visibleLanes) {
      if (lane.points.length > 0) {
        const beats = lane.points.map(p => p.beat);
        minBeat = Math.min(minBeat, Math.min(...beats));
        maxBeat = Math.max(maxBeat, Math.max(...beats));
      }
    }
    
    if (minBeat !== Infinity) {
      setViewport({
        startBeat: Math.max(0, minBeat - 4),
        endBeat: maxBeat + 4,
      });
    }
  };
  
  // Handle tool change
  const handleToolChange = (tool: AutomationTool) => {
    setTool(tool);
    if (tool !== 'select') {
      clearSelection();
    }
  };
  
  // Handle point mouse down
  const handlePointMouseDown = useCallback((e: React.MouseEvent, laneId: string, pointId: string) => {
    e.stopPropagation();
    
    if (currentTool === 'erase') {
      deletePoint(laneId, pointId);
      return;
    }
    
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    
    if (currentTool === 'select') {
      if (selectedPointIds.includes(pointId)) {
        if (multi) {
          deselectPoint(laneId, pointId);
        }
      } else {
        selectPoint(laneId, pointId, multi);
      }
      
      // Start drag
      const lane = lanes.find(l => l.id === laneId);
      if (lane) {
        const point = lane.points.find(p => p.id === pointId);
        if (point) {
          startDrag(laneId, pointId, point.beat, point.value, {
            snapToGrid,
            constrainHorizontal: e.altKey,
            constrainVertical: false,
          });
        }
      }
    }
  }, [currentTool, deletePoint, selectedPointIds, selectPoint, deselectPoint, startDrag, lanes, snapToGrid]);
  
  // Handle point double click (cycle curve type)
  const handlePointDoubleClick = useCallback((laneId: string, pointId: string) => {
    cyclePointCurve(laneId, pointId);
  }, [cyclePointCurve]);
  
  // Handle lane click (add point in draw mode)
  const handleLaneClick = useCallback((e: React.MouseEvent, laneId: string) => {
    if (currentTool === 'draw') {
      const rect = (e.target as HTMLElement).closest('svg')?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const lane = lanes.find(l => l.id === laneId);
        if (lane) {
          const beat = viewport.startBeat + (x / pixelsPerBeat);
          const value = lane.min + ((LANE_HEIGHT - y) / LANE_HEIGHT) * (lane.max - lane.min);
          
          // Normalize value to 0-1 range
          const normalizedValue = (value - lane.min) / (lane.max - lane.min);
          
          let finalBeat = beat;
          if (snapToGrid) {
            finalBeat = Math.round(beat / gridDivision) * gridDivision;
          }
          
          addPoint(laneId, finalBeat, normalizedValue);
        }
      }
    }
  }, [currentTool, lanes, viewport.startBeat, pixelsPerBeat, snapToGrid, gridDivision, addPoint]);
  
  // Handle curve click (change curve type)
  const handleCurveClick = useCallback((laneId: string, pointAId: string) => {
    const lane = lanes.find(l => l.id === laneId);
    if (lane) {
      const pointIndex = lane.points.findIndex(p => p.id === pointAId);
      if (pointIndex >= 0) {
        const nextCurve = nextCurveType(lane.points[pointIndex].curve);
        setPointCurve(laneId, pointAId, nextCurve);
      }
    }
  }, [lanes, setPointCurve]);
  
  // Global mouse handlers for drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging) {
        const rect = containerRef.current?.querySelector('svg')?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          const beat = viewport.startBeat + (x / pixelsPerBeat);
          const lane = lanes.find(l => l.id === dragState.laneId);
          
          if (lane) {
            const value = 1 - (y / LANE_HEIGHT); // Normalized 0-1
            updateDrag(beat, value);
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      if (dragState.isDragging) {
        endDrag();
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, dragState.laneId, viewport.startBeat, pixelsPerBeat, lanes, updateDrag, endDrag]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPointIds.length > 0 && selectedLaneId) {
          useAutomationStore.getState().deleteSelectedPoints();
        }
      }
      
      if (e.key === '1') setTool('select');
      if (e.key === '2') setTool('draw');
      if (e.key === '3') setTool('erase');
      
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPointIds.length, selectedLaneId, setTool, clearSelection]);
  
  // Playhead position
  const playheadX = (currentBeat - viewport.startBeat) * pixelsPerBeat;
  
  return (
    <div 
      ref={containerRef}
      className="flex flex-col bg-gray-900 border border-gray-700 rounded-lg overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        {/* Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleToolChange('select')}
            className={`p-2 rounded ${currentTool === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="Select (1)"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToolChange('draw')}
            className={`p-2 rounded ${currentTool === 'draw' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="Draw (2)"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToolChange('erase')}
            className={`p-2 rounded ${currentTool === 'erase' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="Erase (3)"
          >
            <Eraser className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-gray-600 mx-2" />
          
          {/* Snap to grid */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs ${snapToGrid ? 'bg-blue-600/30 text-blue-400' : 'text-gray-400 hover:bg-gray-700'}`}
            title="Snap to Grid"
          >
            <Grid3X3 className="w-3 h-3" />
            <span>Snap</span>
          </button>
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomToFit}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Zoom to Fit"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Lanes */}
      <div className="flex-1 overflow-y-auto">
        {visibleLanes.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <p className="text-sm">No automation lanes. Add a parameter to automate.</p>
          </div>
        ) : (
          visibleLanes.map(lane => (
            <AutomationLaneComponent
              key={lane.id}
              lane={lane}
              isSelected={selectedLaneId === lane.id}
              selectedPointIds={selectedPointIds}
              draggingPointId={dragState.pointId}
              viewStartBeat={viewport.startBeat}
              viewEndBeat={viewport.endBeat}
              pixelsPerBeat={pixelsPerBeat}
              height={LANE_HEIGHT}
              trackColor={trackColor}
              onPointMouseDown={(e, pointId) => handlePointMouseDown(e, lane.id, pointId)}
              onPointContextMenu={(e, pointId) => {
                // Context menu for right-click on point
              }}
              onPointDoubleClick={(pointId) => handlePointDoubleClick(lane.id, pointId)}
              onCurveClick={(pointAId) => handleCurveClick(lane.id, pointAId)}
              onLaneClick={(e) => handleLaneClick(e, lane.id)}
              onAddPoint={(beat, value) => addPoint(lane.id, beat, value)}
            />
          ))
        )}
      </div>
      
      {/* Playhead overlay */}
      {isPlaying && playheadX >= 0 && playheadX <= containerWidth - 96 && (
        <div
          className="absolute top-10 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
          style={{ left: playheadX + 96 }}
        >
          <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
        </div>
      )}
      
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Tool: <span className="text-gray-200 capitalize">{currentTool}</span></span>
          {selectedPointIds.length > 0 && (
            <span>{selectedPointIds.length} selected</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Beat: {currentBeat.toFixed(2)}</span>
          <span>View: {viewport.startBeat.toFixed(1)} - {viewport.endBeat.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

export default AutomationEditor;
