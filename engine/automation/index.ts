/**
 * Automation System - Professional DAW automation engine
 * 
 * Features:
 * - Multi-parameter automation lanes
 * - Real-time playback with Web Audio scheduling
 * - Curve interpolation (linear, exponential, logarithmic, bezier)
 * - Recording modes (read, write, touch, latch)
 * - React UI components for editing
 * - Parameter binding to audio nodes
 */

// Types
export type {
  AutomationPoint,
  AutomationLane,
  CurveType,
  ParameterTarget,
  ParameterPath,
  ParameterDescriptor,
  AutomationMode,
  AutomationModeState,
  AutomationRecordingSession,
  AutomationSelection,
  AutomationClipboard,
  AutomationTool,
  AutomationViewport,
  AutomationDragState,
  AutomationValueEvent,
  AutomationChangeEvent,
  SerializedAutomationLane,
  SerializedAutomationPoint,
} from './types';

export {
  parseParameterPath,
  buildParameterPath,
  getParameterDisplayName,
  normalizeValue,
  denormalizeValue,
  clampValue,
  createAutomationPoint,
  createAutomationLane,
} from './types';

// Curve Interpolation
export {
  interpolateAutomation,
  interpolateLinear,
  interpolateExponential,
  interpolateLogarithmic,
  interpolateBezier,
  interpolateCubicBezier,
  interpolateSCurve,
  interpolateSmootherstep,
  easeFunctions,
  mapToParameterRange,
  mapFromParameterRange,
  dbToGain,
  gainToDb,
  normalizedToVolumeDb,
  volumeDbToNormalized,
  normalizedToPan,
  panToNormalized,
  findSurroundingPoints,
  getValueAtBeat,
  generateCurvePoints,
  curveTypeLabels,
  curveTypeDescriptions,
  nextCurveType,
} from './curves';

// Parameter Binding
export type {
  ParameterBinding,
  ParameterValue,
  RegisteredParameter,
} from './parameterBinding';
export {
  ParameterRegistry,
  ParameterBindingManager,
  createTrackParameters,
  createSendParameters,
  createMasterParameters,
  createParameterRegistry,
  createParameterBindingManager,
} from './parameterBinding';

// Scheduler
export type {
  AutomationSchedulerConfig,
  AutomationScheduleState,
} from './automationScheduler';
export {
  AutomationScheduler,
  createAutomationScheduler,
} from './automationScheduler';

// Integration
export type {
  AutomationIntegrationConfig,
} from './automationIntegration';
export {
  AutomationIntegration,
  createAutomationIntegration,
} from './automationIntegration';

// Store (React)
export type {
  AutomationState,
  AutomationActions,
} from '../../store/automationStore';
export {
  useAutomationStore,
  selectLanesForTrack,
  selectVisibleLanes,
  selectLaneById,
  selectSelectedPoints,
} from '../../store/automationStore';

// Components (React)
export { AutomationPointComponent } from '../../components/automation/AutomationPoint';
export { AutomationCurve, AutomationCurves } from '../../components/automation/AutomationCurve';
export { AutomationLaneComponent } from '../../components/automation/AutomationLane';
export { AutomationEditor } from '../../components/automation/AutomationEditor';
