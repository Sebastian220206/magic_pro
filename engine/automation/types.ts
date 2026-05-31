/**
 * Automation Types - Core data models for DAW automation
 * 
 * Supports professional automation features:
 * - Multi-parameter automation lanes
 * - Multiple curve types (linear, exponential, logarithmic, bezier)
 * - Recording modes (read, write, touch, latch)
 * - Parameter binding system
 */

// =============================================================================
// Curve Types
// =============================================================================

export type CurveType = 'linear' | 'exponential' | 'logarithmic' | 'bezier' | 'hold';

// =============================================================================
// Automation Point
// =============================================================================

export interface AutomationPoint {
  id: string;
  beat: number;           // Position in beats (can be fractional)
  value: number;          // Normalized value (0-1 or mapped to parameter range)
  curve: CurveType;       // Interpolation curve to next point
  curveAmount?: number;   // For bezier: control point offset (-1 to 1)
}

// =============================================================================
// Automation Lane
// =============================================================================

export interface AutomationLane {
  id: string;
  trackId: string;        // Associated track
  parameter: string;      // Parameter path (e.g., "track.volume", "plugin.eq.lowGain")
  displayName: string;    // Human-readable name (e.g., "Volume", "Filter Cutoff")
  min: number;           // Minimum value
  max: number;           // Maximum value
  defaultValue: number;  // Default/rest value
  points: AutomationPoint[];
  visible: boolean;      // Show/hide in timeline
  collapsed: boolean;    // Collapsed state in UI
  color: string;         // Lane color for visual distinction
}

// =============================================================================
// Parameter Types
// =============================================================================

export type ParameterTarget = 'track' | 'plugin' | 'instrument' | 'send' | 'master';

export interface ParameterPath {
  target: ParameterTarget;
  trackId?: string;
  pluginId?: string;
  parameterId: string;    // e.g., "volume", "pan", "lowGain"
}

export interface ParameterDescriptor {
  id: string;
  displayName: string;
  min: number;
  max: number;
  defaultValue: number;
  step?: number;         // Step size for discrete values
  unit?: string;         // Display unit (dB, %, Hz, etc.)
  logarithmic?: boolean; // Use logarithmic scale
  enumValues?: string[]; // For enum parameters
}

// =============================================================================
// Automation Modes
// =============================================================================

export type AutomationMode = 'read' | 'write' | 'touch' | 'latch';

export interface AutomationModeState {
  mode: AutomationMode;
  trackId: string;
  parameter: string;
  isWriting: boolean;    // Currently recording
  lastValue?: number;    // For latch mode
  writeStartBeat?: number; // When write started
}

// =============================================================================
// Recording
// =============================================================================

export interface AutomationRecordingSession {
  id: string;
  trackId: string;
  parameter: string;
  mode: AutomationMode;
  startBeat: number;
  endBeat?: number;
  points: AutomationPoint[];
  isActive: boolean;
}

// =============================================================================
// Selection & Editing
// =============================================================================

export interface AutomationSelection {
  laneId: string;
  pointIds: string[];
}

export interface AutomationClipboard {
  points: AutomationPoint[];
  relativeBeat: number;  // Offset for paste
}

// =============================================================================
// Editor State
// =============================================================================

export type AutomationTool = 'select' | 'draw' | 'erase' | 'curve';

export interface AutomationViewport {
  startBeat: number;
  endBeat: number;
  minValue: number;
  maxValue: number;
  pixelsPerBeat: number;
  pixelsPerValue: number;
}

export interface AutomationDragState {
  isDragging: boolean;
  pointId: string | null;
  laneId: string | null;
  startBeat: number;
  startValue: number;
  currentBeat: number;
  currentValue: number;
  snapToGrid: boolean;
  constrainHorizontal: boolean;
  constrainVertical: boolean;
}

// =============================================================================
// Events
// =============================================================================

export interface AutomationValueEvent {
  beat: number;
  value: number;
  parameter: string;
  trackId: string;
}

export interface AutomationChangeEvent {
  type: 'add' | 'move' | 'delete' | 'curve';
  laneId: string;
  pointIds: string[];
  oldValues?: AutomationPoint[];
  newValues?: AutomationPoint[];
}

// =============================================================================
// Serialization
// =============================================================================

export interface SerializedAutomationLane {
  id: string;
  trackId: string;
  parameter: string;
  displayName: string;
  min: number;
  max: number;
  defaultValue: number;
  points: SerializedAutomationPoint[];
  visible: boolean;
  collapsed: boolean;
  color: string;
}

export interface SerializedAutomationPoint {
  id: string;
  beat: number;
  value: number;
  curve: CurveType;
  curveAmount?: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

export function parseParameterPath(parameter: string): ParameterPath | null {
  const parts = parameter.split('.');
  
  if (parts.length < 2) return null;
  
  const target = parts[0] as ParameterTarget;
  
  switch (target) {
    case 'track':
      return {
        target: 'track',
        trackId: parts[1],
        parameterId: parts[2] || 'volume'
      };
    case 'plugin':
      return {
        target: 'plugin',
        trackId: parts[1],
        pluginId: parts[2],
        parameterId: parts[3] || 'value'
      };
    case 'instrument':
      return {
        target: 'instrument',
        trackId: parts[1],
        parameterId: parts[2] || 'value'
      };
    case 'send':
      return {
        target: 'send',
        trackId: parts[1],
        pluginId: parts[2], // send slot
        parameterId: 'level'
      };
    case 'master':
      return {
        target: 'master',
        parameterId: parts[1] || 'volume'
      };
    default:
      return null;
  }
}

export function buildParameterPath(path: ParameterPath): string {
  switch (path.target) {
    case 'track':
      return `track.${path.trackId}.${path.parameterId}`;
    case 'plugin':
      return `plugin.${path.trackId}.${path.pluginId}.${path.parameterId}`;
    case 'instrument':
      return `instrument.${path.trackId}.${path.parameterId}`;
    case 'send':
      return `send.${path.trackId}.${path.pluginId}.level`;
    case 'master':
      return `master.${path.parameterId}`;
    default:
      return '';
  }
}

export function getParameterDisplayName(parameter: string): string {
  const path = parseParameterPath(parameter);
  if (!path) return parameter;
  
  const nameMap: Record<string, string> = {
    'volume': 'Volume',
    'pan': 'Pan',
    'mute': 'Mute',
    'solo': 'Solo',
    'gain': 'Gain',
    'frequency': 'Frequency',
    'q': 'Q',
    'attack': 'Attack',
    'decay': 'Decay',
    'sustain': 'Sustain',
    'release': 'Release',
    'cutoff': 'Cutoff',
    'resonance': 'Resonance',
    'rate': 'Rate',
    'depth': 'Depth',
    'feedback': 'Feedback',
    'mix': 'Mix',
    'level': 'Level',
    'threshold': 'Threshold',
    'ratio': 'Ratio',
    'makeup': 'Makeup',
    'wet': 'Wet',
    'dry': 'Dry',
  };
  
  return nameMap[path.parameterId] || path.parameterId;
}

export function normalizeValue(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

export function denormalizeValue(normalized: number, min: number, max: number): number {
  return min + (normalized * (max - min));
}

export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createAutomationPoint(
  beat: number,
  value: number,
  curve: CurveType = 'linear',
  curveAmount?: number
): AutomationPoint {
  return {
    id: `autopoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    beat,
    value,
    curve,
    curveAmount,
  };
}

export function createAutomationLane(
  trackId: string,
  parameter: string,
  options: Partial<AutomationLane> = {}
): AutomationLane {
  const path = parseParameterPath(parameter);
  const displayName = options.displayName || getParameterDisplayName(parameter);
  
  // Determine default min/max based on parameter type
  let min = 0;
  let max = 1;
  let defaultValue = 0.5;
  
  if (path?.parameterId === 'volume') {
    min = -60;  // dB
    max = 12;
    defaultValue = 0;
  } else if (path?.parameterId === 'pan') {
    min = -1;   // Left
    max = 1;    // Right
    defaultValue = 0;
  } else if (path?.parameterId === 'mute' || path?.parameterId === 'solo') {
    min = 0;
    max = 1;
    defaultValue = 0;
  }
  
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ];
  
  return {
    id: `autolane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    trackId,
    parameter,
    displayName,
    min: options.min ?? min,
    max: options.max ?? max,
    defaultValue: options.defaultValue ?? defaultValue,
    points: [],
    visible: true,
    collapsed: false,
    color: options.color || colors[Math.floor(Math.random() * colors.length)],
    ...options,
  };
}
