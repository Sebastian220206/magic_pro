/**
 * Track Template Types - Data structures for track presets
 *
 * Features:
 * - Save complete track state (instrument, effects, sends, routing)
 * - Template categories and tags
 * - Versioning for template compatibility
 * - Metadata (author, description, creation date)
 * - Built-in vs user templates
 */

import { MidiClip } from '../midi/types';

// =============================================================================
// Effect Chain Types
// =============================================================================

export interface EffectSlotConfig {
  id: string;
  pluginId: string;           // e.g., 'compressor', 'reverb', 'delay', 'eq', 'limiter'
  enabled: boolean;
  bypassed: boolean;
  parameters: Record<string, number | string | boolean>;
  wetDry: number;             // 0-1
  presetName?: string;
}

export interface EffectChainConfig {
  slots: EffectSlotConfig[];
  preGain: number;            // dB
  postGain: number;           // dB
}

// =============================================================================
// Send Types
// =============================================================================

export type SendDestinationType = 'reverb' | 'delay' | 'chorus' | 'master' | 'bus' | 'vca';

export interface SendConfig {
  id: string;
  destinationType: SendDestinationType;
  destinationId?: string;     // Bus ID or VCA ID
  level: number;              // dB
  preFader: boolean;
  enabled: boolean;
  pan: number;                // -1 to 1
}

// =============================================================================
// Instrument Types
// =============================================================================

export interface InstrumentConfig {
  pluginId: string;           // e.g., 'synth', 'sampler', 'drum-machine'
  parameters: Record<string, number | string | boolean>;
  presetName?: string;
  outputCount?: number;
  outputNames?: Record<number, string>;
}

// =============================================================================
// Input/Output Types
// =============================================================================

export type InputSourceType = 'mono' | 'stereo' | 'mid' | 'side' | 'audio-file' | 'midi';

export interface InputConfig {
  type: InputSourceType;
  channelIndex?: number;      // Audio input channel
  audioInterface?: string;    // Audio interface name
}

export type OutputDestinationType = 'master' | 'bus' | 'vca' | 'audio-output';

export interface OutputConfig {
  type: OutputDestinationType;
  destinationId?: string;
  channelIndex?: number;      // Audio output channel
}

// =============================================================================
// Automation Types
// =============================================================================

export interface AutomationLaneConfig {
  parameterId: string;
  parameterName: string;
  points: Array<{
    beat: number;
    value: number;
  }>;
  visible: boolean;
  color?: string;
}

// =============================================================================
// Track Template
// =============================================================================

export type TrackType = 'audio' | 'midi' | 'instrument' | 'bus' | 'vca' | 'folder';

export interface TrackTemplate {
  id: string;
  name: string;
  description: string;
  version: number;            // Template format version
  createdAt: number;         // Timestamp
  updatedAt: number;         // Timestamp
  author: string;
  category: TrackTemplateCategory;
  tags: string[];
  isBuiltIn: boolean;
  isFavorite: boolean;
  thumbnail?: string;         // Base64 encoded thumbnail

  // Track configuration
  trackType: TrackType;
  namePrefix: string;         // Default name prefix for new tracks
  color: string;              // Track color

  // Audio settings
  volume: number;             // 0-1
  pan: number;                // -1 to 1
  muted: boolean;
  solo: boolean;
  gain: number;               // dB

  // Input/Output
  input: InputConfig;
  output: OutputConfig;

  // Instrument (for instrument tracks)
  instrument?: InstrumentConfig;

  // Effects chain
  effects: EffectChainConfig;

  // Sends
  sends: SendConfig[];

  // Default MIDI clips (for instrument tracks)
  defaultClips?: MidiClip[];

  // Automation lanes
  automationLanes: AutomationLaneConfig[];

  // Group membership
  groupId?: string;
  groupName?: string;

  // Track stack
  stackId?: string;
  isStackLeader?: boolean;

  // VCA (for VCA tracks)
  vcaFaderId?: string;
  vcaGroupMembers?: string[];

  // Bus (for bus tracks)
  busId?: string;
  busRouting?: OutputConfig[];
}

// =============================================================================
// Template Categories
// =============================================================================

export type TrackTemplateCategory =
  | 'vocals'
  | 'drums'
  | 'bass'
  | 'guitar'
  | 'keys'
  | 'synths'
  | 'strings'
  | 'brass'
  | 'fx'
  | 'mastering'
  | 'bus'
  | 'custom';

export const TRACK_TEMPLATE_CATEGORIES: Record<TrackTemplateCategory, { name: string; icon: string; color: string }> = {
  vocals: { name: 'Vocals', icon: '🎤', color: '#EC4899' },
  drums: { name: 'Drums', icon: '🥁', color: '#EF4444' },
  bass: { name: 'Bass', icon: '🎸', color: '#F59E0B' },
  guitar: { name: 'Guitar', icon: '🎸', color: '#10B981' },
  keys: { name: 'Keys', icon: '🎹', color: '#3B82F6' },
  synths: { name: 'Synths', icon: '🎛️', color: '#8B5CF6' },
  strings: { name: 'Strings', icon: '🎻', color: '#F97316' },
  brass: { name: 'Brass', icon: '🎺', color: '#FBBF24' },
  fx: { name: 'FX', icon: '✨', color: '#6B7280' },
  mastering: { name: 'Mastering', icon: '🎚️', color: '#14B8A6' },
  bus: { name: 'Bus', icon: '🔀', color: '#6366F1' },
  custom: { name: 'Custom', icon: '⚙️', color: '#9CA3AF' },
};

// =============================================================================
// Template Manager State
// =============================================================================

export interface TrackTemplateManagerState {
  templates: TrackTemplate[];
  selectedId: string | null;
  categoryFilter: TrackTemplateCategory | null;
  searchQuery: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'category';
  sortDirection: 'asc' | 'desc';
  recentlyUsed: string[];     // Template IDs
  favorites: Set<string>;     // Template IDs
}

// =============================================================================
// Template Options
// =============================================================================

export interface TrackTemplateManagerOptions {
  storageKey?: string;
  maxRecent?: number;
  autoSave?: boolean;
  builtinTemplates?: TrackTemplate[];
}

// =============================================================================
// Template Comparison
// =============================================================================

export interface TemplateComparison {
  template: TrackTemplate;
  differences: TemplateDifference[];
  score: number;              // 0-100, how similar
}

export interface TemplateDifference {
  field: string;
  templateValue: unknown;
  targetValue: unknown;
  path: string;
}

// =============================================================================
// Template Import/Export
// =============================================================================

export interface TrackTemplateExport {
  format: 'json' | 'preset';
  version: number;
  template: TrackTemplate;
  metadata: {
    exportedAt: number;
    exportedBy: string;
    dawVersion: string;
  };
}

// =============================================================================
// Validation
// =============================================================================

export interface TemplateValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export function validateTemplate(template: TrackTemplate): TemplateValidationError[] {
  const errors: TemplateValidationError[] = [];

  if (!template.id) {
    errors.push({ field: 'id', message: 'Template ID is required', severity: 'error' });
  }

  if (!template.name || template.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Template name is required', severity: 'error' });
  }

  if (template.version < 1) {
    errors.push({ field: 'version', message: 'Template version must be at least 1', severity: 'error' });
  }

  if (!TRACK_TEMPLATE_CATEGORIES[template.category]) {
    errors.push({ field: 'category', message: `Invalid category: ${template.category}`, severity: 'error' });
  }

  if (template.volume < 0 || template.volume > 1) {
    errors.push({ field: 'volume', message: 'Volume must be between 0 and 1', severity: 'warning' });
  }

  if (template.pan < -1 || template.pan > 1) {
    errors.push({ field: 'pan', message: 'Pan must be between -1 and 1', severity: 'warning' });
  }

  if (template.gain < -60 || template.gain > 24) {
    errors.push({ field: 'gain', message: 'Gain must be between -60 and 24 dB', severity: 'warning' });
  }

  return errors;
}

export default TrackTemplate;
