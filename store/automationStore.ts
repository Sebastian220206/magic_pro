/**
 * Automation Store - Zustand store for automation state
 * 
 * Features:
 * - Automation lanes management
 * - Point selection and editing
 * - Recording modes
 * - Curve editing
 * - Undo/Redo support
 * - Integration with playback
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  AutomationLane,
  AutomationPoint,
  AutomationMode,
  AutomationTool,
  AutomationViewport,
  AutomationDragState,
  AutomationSelection,
  AutomationModeState,
  createAutomationPoint,
  createAutomationLane,
  CurveType,
} from '../engine/automation/types';
import {
  getValueAtBeat,
  interpolateAutomation,
  findSurroundingPoints,
  nextCurveType,
} from '../engine/automation/curves';

// =============================================================================
// Store State
// =============================================================================

export interface AutomationState {
  // Lanes
  lanes: AutomationLane[];
  visibleTrackIds: string[];  // Which tracks show automation lanes
  
  // Selection
  selectedLaneId: string | null;
  selectedPointIds: string[];
  selectionBox: { startBeat: number; endBeat: number; minValue: number; maxValue: number } | null;
  
  // Tool state
  currentTool: AutomationTool;
  currentParameter: string | null;
  
  // Viewport
  viewport: AutomationViewport;
  
  // Dragging
  dragState: AutomationDragState;
  
  // Recording
  isRecording: boolean;
  automationModes: Map<string, AutomationModeState>; // key: "trackId.parameter"
  
  // Editor options
  snapToGrid: boolean;
  gridDivision: number;  // beats per division
  showValues: boolean;
  showCurves: boolean;
  
  // Playback sync
  currentBeat: number;
  isPlaying: boolean;
}

// =============================================================================
// Actions
// =============================================================================

export interface AutomationActions {
  // Lane management
  addLane: (trackId: string, parameter: string, options?: Partial<AutomationLane>) => string;
  removeLane: (laneId: string) => void;
  updateLane: (laneId: string, updates: Partial<AutomationLane>) => void;
  setLaneVisibility: (laneId: string, visible: boolean) => void;
  setLaneCollapsed: (laneId: string, collapsed: boolean) => void;
  reorderLanes: (laneIds: string[]) => void;
  
  // Track visibility
  showTrackAutomation: (trackId: string) => void;
  hideTrackAutomation: (trackId: string) => void;
  toggleTrackAutomation: (trackId: string) => void;
  
  // Point editing
  addPoint: (laneId: string, beat: number, value: number, curve?: CurveType) => string;
  movePoint: (laneId: string, pointId: string, beat: number, value: number) => void;
  deletePoint: (laneId: string, pointId: string) => void;
  setPointCurve: (laneId: string, pointId: string, curve: CurveType, curveAmount?: number) => void;
  cyclePointCurve: (laneId: string, pointId: string) => void;
  
  // Multi-point operations
  deleteSelectedPoints: () => void;
  moveSelectedPoints: (deltaBeat: number, deltaValue: number) => void;
  
  // Selection
  selectPoint: (laneId: string, pointId: string, multi?: boolean) => void;
  deselectPoint: (laneId: string, pointId: string) => void;
  selectPointsInRange: (laneId: string, startBeat: number, endBeat: number, minValue: number, maxValue: number) => void;
  clearSelection: () => void;
  selectAllInLane: (laneId: string) => void;
  selectLane: (laneId: string | null) => void;
  
  // Tool switching
  setTool: (tool: AutomationTool) => void;
  setCurrentParameter: (parameter: string | null) => void;
  
  // Drag operations
  startDrag: (laneId: string, pointId: string | null, beat: number, value: number, options?: { snapToGrid?: boolean; constrainHorizontal?: boolean; constrainVertical?: boolean }) => void;
  updateDrag: (beat: number, value: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  
  // Curve editing
  setCurveShape: (laneId: string, pointAId: string, pointBId: string, curve: CurveType) => void;
  
  // Value at position
  getValueAtBeat: (laneId: string, beat: number) => number;
  
  // Clipboard
  copySelection: () => void;
  pasteSelection: (atBeat: number) => void;
  
  // Recording
  setRecording: (isRecording: boolean) => void;
  setAutomationMode: (trackId: string, parameter: string, mode: AutomationMode) => void;
  getAutomationMode: (trackId: string, parameter: string) => AutomationMode;
  
  // Viewport
  setViewport: (viewport: Partial<AutomationViewport>) => void;
  zoomToFit: (laneId: string) => void;
  zoomToSelection: () => void;
  scrollToBeat: (beat: number) => void;
  
  // Options
  setSnapToGrid: (snap: boolean) => void;
  setGridDivision: (division: number) => void;
  toggleShowValues: () => void;
  toggleShowCurves: () => void;
  
  // Playback sync
  setCurrentBeat: (beat: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  
  // Bulk operations
  clearLane: (laneId: string) => void;
  duplicateLane: (laneId: string, newTrackId?: string) => string;
  
  // Import/Export
  serializeLane: (laneId: string) => object;
  deserializeLane: (data: object) => string;
  
  // Reset
  reset: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: AutomationState = {
  lanes: [],
  visibleTrackIds: [],
  selectedLaneId: null,
  selectedPointIds: [],
  selectionBox: null,
  currentTool: 'select',
  currentParameter: null,
  viewport: {
    startBeat: 0,
    endBeat: 32,
    minValue: 0,
    maxValue: 1,
    pixelsPerBeat: 40,
    pixelsPerValue: 100,
  },
  dragState: {
    isDragging: false,
    pointId: null,
    laneId: null,
    startBeat: 0,
    startValue: 0,
    currentBeat: 0,
    currentValue: 0,
    snapToGrid: true,
    constrainHorizontal: false,
    constrainVertical: false,
  },
  isRecording: false,
  automationModes: new Map(),
  snapToGrid: true,
  gridDivision: 0.25, // 1/16th notes
  showValues: true,
  showCurves: true,
  currentBeat: 0,
  isPlaying: false,
};

// =============================================================================
// Helper Functions
// =============================================================================

function getLaneById(lanes: AutomationLane[], laneId: string): AutomationLane | undefined {
  return lanes.find(l => l.id === laneId);
}

function getPointById(lane: AutomationLane, pointId: string): AutomationPoint | undefined {
  return lane.points.find(p => p.id === pointId);
}

function snapValue(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================================================
// Store Creation
// =============================================================================

export const useAutomationStore = create<AutomationState & AutomationActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // =========================================================================
      // Lane Management
      // =========================================================================

      addLane: (trackId: string, parameter: string, options = {}) => {
        const id = generateId();
        set((state) => {
          const lane = createAutomationLane(trackId, parameter, {
            id,
            ...options,
          });
          state.lanes.push(lane);
          
          // Auto-show track automation
          if (!state.visibleTrackIds.includes(trackId)) {
            state.visibleTrackIds.push(trackId);
          }
        });
        return id;
      },

      removeLane: (laneId: string) => {
        set((state) => {
          const index = state.lanes.findIndex((l: AutomationLane) => l.id === laneId);
          if (index > -1) {
            const lane = state.lanes[index];
            state.lanes.splice(index, 1);
            
            // Clear selection if this lane was selected
            if (state.selectedLaneId === laneId) {
              state.selectedLaneId = null;
              state.selectedPointIds = [];
            }
            
            const lanePointIds: string[] = lane.points.map((p: AutomationPoint) => p.id);
            state.selectedPointIds = state.selectedPointIds.filter((id: string) => !lanePointIds.includes(id));
          }
        });
      },

      updateLane: (laneId: string, updates: Partial<AutomationLane>) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            Object.assign(lane, updates);
          }
        });
      },

      setLaneVisibility: (laneId: string, visible: boolean) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            lane.visible = visible;
          }
        });
      },

      setLaneCollapsed: (laneId: string, collapsed: boolean) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            lane.collapsed = collapsed;
          }
        });
      },

      reorderLanes: (laneIds: string[]) => {
        set((state) => {
          const ordered: AutomationLane[] = [];
          for (const id of laneIds) {
            const lane = state.lanes.find((l: AutomationLane) => l.id === id);
            if (lane) ordered.push(lane);
          }
          // Add any lanes not in the ordered list
          for (const lane of state.lanes) {
            if (!laneIds.includes(lane.id)) {
              ordered.push(lane);
            }
          }
          state.lanes = ordered;
        });
      },

      // =========================================================================
      // Track Visibility
      // =========================================================================

      showTrackAutomation: (trackId: string) => {
        set((state) => {
          if (!state.visibleTrackIds.includes(trackId)) {
            state.visibleTrackIds.push(trackId);
          }
        });
      },

      hideTrackAutomation: (trackId: string) => {
        set((state) => {
          const index = state.visibleTrackIds.indexOf(trackId);
          if (index > -1) {
            state.visibleTrackIds.splice(index, 1);
          }
          
          // Hide lanes for this track
          for (const lane of state.lanes) {
            if (lane.trackId === trackId) {
              lane.visible = false;
            }
          }
        });
      },

      toggleTrackAutomation: (trackId: string) => {
        const state = get();
        if (state.visibleTrackIds.includes(trackId)) {
          get().hideTrackAutomation(trackId);
        } else {
          get().showTrackAutomation(trackId);
        }
      },

      // =========================================================================
      // Point Editing
      // =========================================================================

      addPoint: (laneId: string, beat: number, value: number, curve?: CurveType) => {
        const id = generateId();
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            // Clamp value to 0-1 range
            const clampedValue = Math.max(0, Math.min(1, value));
            
            const point = createAutomationPoint(beat, clampedValue, curve || 'linear');
            point.id = id;
            lane.points.push(point);
            
            // Sort by beat
            lane.points.sort((a, b) => a.beat - b.beat);
            
            // Select the new point
            state.selectedLaneId = laneId;
            state.selectedPointIds = [id];
          }
        });
        return id;
      },

      movePoint: (laneId: string, pointId: string, beat: number, value: number) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            const point = getPointById(lane, pointId);
            if (point) {
              point.beat = beat;
              point.value = Math.max(0, Math.min(1, value));
              
              // Re-sort points
              lane.points.sort((a, b) => a.beat - b.beat);
            }
          }
        });
      },

      deletePoint: (laneId: string, pointId: string) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            const index = lane.points.findIndex(p => p.id === pointId);
            if (index > -1) {
              lane.points.splice(index, 1);
              
              // Remove from selection
              state.selectedPointIds = state.selectedPointIds.filter((id: string) => id !== pointId);
            }
          }
        });
      },

      setPointCurve: (laneId: string, pointId: string, curve: CurveType, curveAmount?: number) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            const point = getPointById(lane, pointId);
            if (point) {
              point.curve = curve;
              if (curveAmount !== undefined) {
                point.curveAmount = curveAmount;
              }
            }
          }
        });
      },

      cyclePointCurve: (laneId: string, pointId: string) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            const point = getPointById(lane, pointId);
            if (point) {
              point.curve = nextCurveType(point.curve);
            }
          }
        });
      },

      // =========================================================================
      // Multi-point Operations
      // =========================================================================

      deleteSelectedPoints: () => {
        set((state) => {
          if (!state.selectedLaneId || state.selectedPointIds.length === 0) return;
          
          const lane = getLaneById(state.lanes, state.selectedLaneId);
          if (lane) {
            lane.points = lane.points.filter((p: AutomationPoint) => 
              !state.selectedPointIds.includes(p.id)
            );
            state.selectedPointIds = [];
          }
        });
      },

      moveSelectedPoints: (deltaBeat: number, deltaValue: number) => {
        set((state) => {
          if (!state.selectedLaneId || state.selectedPointIds.length === 0) return;
          
          const lane = getLaneById(state.lanes, state.selectedLaneId);
          if (!lane) return;
          
          for (const point of lane.points) {
            if (state.selectedPointIds.includes(point.id)) {
              point.beat += deltaBeat;
              point.value = Math.max(0, Math.min(1, point.value + deltaValue));
            }
          }
          
          // Re-sort
          lane.points.sort((a, b) => a.beat - b.beat);
        });
      },

      // =========================================================================
      // Selection
      // =========================================================================

      selectPoint: (laneId: string, pointId: string, multi = false) => {
        set((state) => {
          if (multi) {
            // Add to selection
            if (!state.selectedPointIds.includes(pointId)) {
              state.selectedPointIds.push(pointId);
            }
            state.selectedLaneId = laneId;
          } else {
            // Replace selection
            state.selectedLaneId = laneId;
            state.selectedPointIds = [pointId];
          }
        });
      },

      deselectPoint: (laneId: string, pointId: string) => {
        set((state) => {
          state.selectedPointIds = state.selectedPointIds.filter((id: string) => id !== pointId);
          if (state.selectedPointIds.length === 0) {
            state.selectedLaneId = null;
          }
        });
      },

      selectPointsInRange: (laneId: string, startBeat: number, endBeat: number, minValue: number, maxValue: number) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (!lane) return;
          
          const selected = lane.points
            .filter(p => 
              p.beat >= startBeat && 
              p.beat <= endBeat && 
              p.value >= minValue && 
              p.value <= maxValue
            )
            .map(p => p.id);
          
          state.selectedLaneId = laneId;
          state.selectedPointIds = selected;
        });
      },

      clearSelection: () => {
        set((state) => {
          state.selectedLaneId = null;
          state.selectedPointIds = [];
          state.selectionBox = null;
        });
      },

      selectAllInLane: (laneId: string) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            state.selectedLaneId = laneId;
            state.selectedPointIds = lane.points.map(p => p.id);
          }
        });
      },

      selectLane: (laneId: string | null) => {
        set((state) => {
          state.selectedLaneId = laneId;
          if (laneId !== state.selectedLaneId) {
            state.selectedPointIds = [];
          }
        });
      },

      // =========================================================================
      // Tool Switching
      // =========================================================================

      setTool: (tool: AutomationTool) => {
        set((state) => {
          state.currentTool = tool;
        });
      },

      setCurrentParameter: (parameter: string | null) => {
        set((state) => {
          state.currentParameter = parameter;
        });
      },

      // =========================================================================
      // Drag Operations
      // =========================================================================

      startDrag: (laneId: string, pointId: string | null, beat: number, value: number, options = {}) => {
        set((state) => {
          state.dragState = {
            isDragging: true,
            pointId,
            laneId,
            startBeat: beat,
            startValue: value,
            currentBeat: beat,
            currentValue: value,
            snapToGrid: options.snapToGrid ?? state.snapToGrid,
            constrainHorizontal: options.constrainHorizontal ?? false,
            constrainVertical: options.constrainVertical ?? false,
          };
        });
      },

      updateDrag: (beat: number, value: number) => {
        set((state) => {
          if (!state.dragState.isDragging) return;
          
          let newBeat = beat;
          let newValue = value;
          
          // Apply constraints
          if (state.dragState.constrainHorizontal) {
            newBeat = state.dragState.startBeat;
          }
          if (state.dragState.constrainVertical) {
            newValue = state.dragState.startValue;
          }
          
          // Apply snap to grid
          if (state.dragState.snapToGrid) {
            newBeat = snapValue(newBeat, state.gridDivision);
          }
          
          state.dragState.currentBeat = newBeat;
          state.dragState.currentValue = Math.max(0, Math.min(1, newValue));
          
          // Move the actual point if dragging one
          if (state.dragState.pointId && state.dragState.laneId) {
            const lane = getLaneById(state.lanes, state.dragState.laneId);
            if (lane) {
              const point = getPointById(lane, state.dragState.pointId);
              if (point) {
                point.beat = state.dragState.currentBeat;
                point.value = state.dragState.currentValue;
                lane.points.sort((a, b) => a.beat - b.beat);
              }
            }
          }
        });
      },

      endDrag: () => {
        set((state) => {
          state.dragState.isDragging = false;
          state.dragState.pointId = null;
          state.dragState.laneId = null;
        });
      },

      cancelDrag: () => {
        set((state) => {
          // Revert point to original position if needed
          if (state.dragState.pointId && state.dragState.laneId) {
            const lane = getLaneById(state.lanes, state.dragState.laneId);
            if (lane) {
              const point = getPointById(lane, state.dragState.pointId);
              if (point) {
                point.beat = state.dragState.startBeat;
                point.value = state.dragState.startValue;
                lane.points.sort((a, b) => a.beat - b.beat);
              }
            }
          }
          
          state.dragState.isDragging = false;
          state.dragState.pointId = null;
          state.dragState.laneId = null;
        });
      },

      // =========================================================================
      // Curve Editing
      // =========================================================================

      setCurveShape: (laneId: string, pointAId: string, pointBId: string, curve: CurveType) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            const pointA = getPointById(lane, pointAId);
            if (pointA) {
              pointA.curve = curve;
            }
          }
        });
      },

      // =========================================================================
      // Value at Position
      // =========================================================================

      getValueAtBeat: (laneId: string, beat: number) => {
        const state = get();
        const lane = getLaneById(state.lanes, laneId);
        if (!lane) return 0.5;
        
        return getValueAtBeat(lane.points, beat, lane.defaultValue);
      },

      // =========================================================================
      // Clipboard
      // =========================================================================

      copySelection: () => {
        // TODO: Implement clipboard with serialization
      },

      pasteSelection: (atBeat: number) => {
        // TODO: Implement paste from clipboard
      },

      // =========================================================================
      // Recording
      // =========================================================================

      setRecording: (isRecording: boolean) => {
        set((state) => {
          state.isRecording = isRecording;
        });
      },

      setAutomationMode: (trackId: string, parameter: string, mode: AutomationMode) => {
        set((state) => {
          const key = `${trackId}.${parameter}`;
          const existing = state.automationModes.get(key);
          
          if (existing) {
            existing.mode = mode;
          } else {
            state.automationModes.set(key, {
              mode,
              trackId,
              parameter,
              isWriting: false,
            });
          }
        });
      },

      getAutomationMode: (trackId: string, parameter: string) => {
        const state = get();
        const key = `${trackId}.${parameter}`;
        return state.automationModes.get(key)?.mode || 'read';
      },

      // =========================================================================
      // Viewport
      // =========================================================================

      setViewport: (viewport: Partial<AutomationViewport>) => {
        set((state) => {
          Object.assign(state.viewport, viewport);
        });
      },

      zoomToFit: (laneId: string) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane && lane.points.length > 0) {
            const beats = lane.points.map(p => p.beat);
            state.viewport.startBeat = Math.min(...beats) - 2;
            state.viewport.endBeat = Math.max(...beats) + 2;
          }
        });
      },

      zoomToSelection: () => {
        set((state) => {
          if (state.selectedPointIds.length === 0 || !state.selectedLaneId) return;
          
          const lane = getLaneById(state.lanes, state.selectedLaneId);
          if (!lane) return;
          
          const selectedPoints = lane.points.filter(p => 
            state.selectedPointIds.includes(p.id)
          );
          
          if (selectedPoints.length > 0) {
            const beats = selectedPoints.map(p => p.beat);
            state.viewport.startBeat = Math.min(...beats) - 1;
            state.viewport.endBeat = Math.max(...beats) + 1;
          }
        });
      },

      scrollToBeat: (beat: number) => {
        set((state) => {
          const viewWidth = state.viewport.endBeat - state.viewport.startBeat;
          state.viewport.startBeat = beat - (viewWidth / 2);
          state.viewport.endBeat = beat + (viewWidth / 2);
        });
      },

      // =========================================================================
      // Options
      // =========================================================================

      setSnapToGrid: (snap: boolean) => {
        set((state) => {
          state.snapToGrid = snap;
        });
      },

      setGridDivision: (division: number) => {
        set((state) => {
          state.gridDivision = division;
        });
      },

      toggleShowValues: () => {
        set((state) => {
          state.showValues = !state.showValues;
        });
      },

      toggleShowCurves: () => {
        set((state) => {
          state.showCurves = !state.showCurves;
        });
      },

      // =========================================================================
      // Playback Sync
      // =========================================================================

      setCurrentBeat: (beat: number) => {
        set((state) => {
          state.currentBeat = beat;
        });
      },

      setIsPlaying: (isPlaying: boolean) => {
        set((state) => {
          state.isPlaying = isPlaying;
        });
      },

      // =========================================================================
      // Bulk Operations
      // =========================================================================

      clearLane: (laneId: string) => {
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            lane.points = [];
            state.selectedPointIds = state.selectedPointIds.filter(id => 
              !lane.points.some(p => p.id === id)
            );
          }
        });
      },

      duplicateLane: (laneId: string, newTrackId?: string) => {
        const id = generateId();
        set((state) => {
          const lane = getLaneById(state.lanes, laneId);
          if (lane) {
            const newLane: AutomationLane = {
              ...lane,
              id,
              trackId: newTrackId || lane.trackId,
              points: lane.points.map(p => ({
                ...p,
                id: generateId(),
              })),
            };
            state.lanes.push(newLane);
          }
        });
        return id;
      },

      // =========================================================================
      // Import/Export
      // =========================================================================

      serializeLane: (laneId: string) => {
        const state = get();
        const lane = getLaneById(state.lanes, laneId);
        return lane ? JSON.parse(JSON.stringify(lane)) : null;
      },

      deserializeLane: (data: object) => {
        const id = generateId();
        set((state) => {
          const lane = createAutomationLane('', '', {});
          Object.assign(lane, data, { id });
          state.lanes.push(lane);
        });
        return id;
      },

      // =========================================================================
      // Reset
      // =========================================================================

      reset: () => {
        set((state) => {
          Object.assign(state, initialState);
        });
      },
    }))
  )
);

// =============================================================================
// Selectors
// =============================================================================

export function selectLanesForTrack(state: AutomationState, trackId: string): AutomationLane[] {
  return state.lanes.filter(lane => lane.trackId === trackId);
}

export function selectVisibleLanes(state: AutomationState): AutomationLane[] {
  return state.lanes.filter(lane => 
    lane.visible && state.visibleTrackIds.includes(lane.trackId)
  );
}

export function selectLaneById(state: AutomationState, laneId: string): AutomationLane | undefined {
  return state.lanes.find(lane => lane.id === laneId);
}

export function selectSelectedPoints(state: AutomationState): { lane: AutomationLane; points: AutomationPoint[] } | null {
  if (!state.selectedLaneId || state.selectedPointIds.length === 0) {
    return null;
  }
  
  const lane = state.lanes.find(l => l.id === state.selectedLaneId);
  if (!lane) return null;
  
  const points = lane.points.filter(p => state.selectedPointIds.includes(p.id));
  return { lane, points };
}

export default useAutomationStore;
