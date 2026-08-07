/**
 * Surround Sound Types - 5.1, 7.1, and Dolby Atmos Support
 *
 * Features:
 * - Multiple surround formats (5.1, 7.1, 7.1.4, 9.1, Atmos)
 * - Speaker positions and distances
 * - LFE (Low Frequency Effects) channel management
 * - Binaural rendering for headphones
 * - Object-based audio (Atmos)
 * - Bed channels for fixed speaker positions
 */

// =============================================================================
// Surround Format Types
// =============================================================================

export type SurroundFormat =
  | 'mono'
  | 'stereo'
  | '5.1'
  | '7.1'
  | '7.1.4'      // 7.1 with 4 height channels
  | '9.1'        // 9.1 with 2 height channels
  | '9.1.6'      // 9.1 with 6 height channels
  | 'atmos'      // Dolby Atmos (object-based)
  | 'auro-3d';   // Auro-3D

export interface SurroundFormatConfig {
  format: SurroundFormat;
  name: string;
  displayName: string;
  description: string;
  channelCount: number;
  lfeCount: number;
  heightChannels: boolean;
  objectBased: boolean;
  speakers: SpeakerConfig[];
}

export interface SpeakerConfig {
  id: string;
  name: string;
  channelIndex: number;
  position: SpeakerPosition;
  distance: number;        // meters from listener
  angle: number;           // degrees from center (0 = front)
  crossover?: number;      // Hz for LFE crossover
  isLFE: boolean;
  isHeight: boolean;
}

export interface SpeakerPosition {
  x: number;    // -1 to 1 (left to right)
  y: number;    // -1 to 1 (back to front)
  z: number;    // -1 to 1 (bottom to top)
}

// =============================================================================
// Channel Layouts
// =============================================================================

export const MONO: SurroundFormatConfig = {
  format: 'mono',
  name: 'Mono',
  displayName: 'Mono',
  description: 'Single channel',
  channelCount: 1,
  lfeCount: 0,
  heightChannels: false,
  objectBased: false,
  speakers: [
    {
      id: 'center',
      name: 'Center',
      channelIndex: 0,
      position: { x: 0, y: 1, z: 0 },
      distance: 1,
      angle: 0,
      isLFE: false,
      isHeight: false,
    },
  ],
};

export const STEREO: SurroundFormatConfig = {
  format: 'stereo',
  name: 'Stereo',
  displayName: 'Stereo',
  description: 'Two channel stereo',
  channelCount: 2,
  lfeCount: 0,
  heightChannels: false,
  objectBased: false,
  speakers: [
    {
      id: 'left',
      name: 'Left',
      channelIndex: 0,
      position: { x: -1, y: 1, z: 0 },
      distance: 1,
      angle: -30,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'right',
      name: 'Right',
      channelIndex: 1,
      position: { x: 1, y: 1, z: 0 },
      distance: 1,
      angle: 30,
      isLFE: false,
      isHeight: false,
    },
  ],
};

export const SURROUND_5_1: SurroundFormatConfig = {
  format: '5.1',
  name: '5.1 Surround',
  displayName: '5.1',
  description: 'Standard 5.1 surround sound',
  channelCount: 6,
  lfeCount: 1,
  heightChannels: false,
  objectBased: false,
  speakers: [
    {
      id: 'front-left',
      name: 'Front Left',
      channelIndex: 0,
      position: { x: -1, y: 1, z: 0 },
      distance: 1,
      angle: -30,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'front-right',
      name: 'Front Right',
      channelIndex: 1,
      position: { x: 1, y: 1, z: 0 },
      distance: 1,
      angle: 30,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'center',
      name: 'Center',
      channelIndex: 2,
      position: { x: 0, y: 1, z: 0 },
      distance: 1,
      angle: 0,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'lfe',
      name: 'LFE',
      channelIndex: 3,
      position: { x: 0, y: 1, z: -1 },
      distance: 1,
      angle: 0,
      crossover: 120,
      isLFE: true,
      isHeight: false,
    },
    {
      id: 'surround-left',
      name: 'Surround Left',
      channelIndex: 4,
      position: { x: -1, y: -1, z: 0 },
      distance: 1,
      angle: -110,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'surround-right',
      name: 'Surround Right',
      channelIndex: 5,
      position: { x: 1, y: -1, z: 0 },
      distance: 1,
      angle: 110,
      isLFE: false,
      isHeight: false,
    },
  ],
};

export const SURROUND_7_1: SurroundFormatConfig = {
  format: '7.1',
  name: '7.1 Surround',
  displayName: '7.1',
  description: 'Extended 7.1 surround with rear channels',
  channelCount: 8,
  lfeCount: 1,
  heightChannels: false,
  objectBased: false,
  speakers: [
    {
      id: 'front-left',
      name: 'Front Left',
      channelIndex: 0,
      position: { x: -1, y: 1, z: 0 },
      distance: 1,
      angle: -30,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'front-right',
      name: 'Front Right',
      channelIndex: 1,
      position: { x: 1, y: 1, z: 0 },
      distance: 1,
      angle: 30,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'center',
      name: 'Center',
      channelIndex: 2,
      position: { x: 0, y: 1, z: 0 },
      distance: 1,
      angle: 0,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'lfe',
      name: 'LFE',
      channelIndex: 3,
      position: { x: 0, y: 1, z: -1 },
      distance: 1,
      angle: 0,
      crossover: 120,
      isLFE: true,
      isHeight: false,
    },
    {
      id: 'surround-left',
      name: 'Surround Left',
      channelIndex: 4,
      position: { x: -1, y: 0, z: 0 },
      distance: 1,
      angle: -90,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'surround-right',
      name: 'Surround Right',
      channelIndex: 5,
      position: { x: 1, y: 0, z: 0 },
      distance: 1,
      angle: 90,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'rear-left',
      name: 'Rear Left',
      channelIndex: 6,
      position: { x: -1, y: -1, z: 0 },
      distance: 1,
      angle: -150,
      isLFE: false,
      isHeight: false,
    },
    {
      id: 'rear-right',
      name: 'Rear Right',
      channelIndex: 7,
      position: { x: 1, y: -1, z: 0 },
      distance: 1,
      angle: 150,
      isLFE: false,
      isHeight: false,
    },
  ],
};

export const SURROUND_7_1_4: SurroundFormatConfig = {
  format: '7.1.4',
  name: '7.1.4 Dolby Atmos',
  displayName: '7.1.4',
  description: 'Dolby Atmos with height channels',
  channelCount: 12,
  lfeCount: 1,
  heightChannels: true,
  objectBased: false,
  speakers: [
    ...SURROUND_7_1.speakers,
    {
      id: 'height-front-left',
      name: 'Height Front Left',
      channelIndex: 8,
      position: { x: -1, y: 1, z: 1 },
      distance: 1,
      angle: -30,
      isLFE: false,
      isHeight: true,
    },
    {
      id: 'height-front-right',
      name: 'Height Front Right',
      channelIndex: 9,
      position: { x: 1, y: 1, z: 1 },
      distance: 1,
      angle: 30,
      isLFE: false,
      isHeight: true,
    },
    {
      id: 'height-rear-left',
      name: 'Height Rear Left',
      channelIndex: 10,
      position: { x: -1, y: -1, z: 1 },
      distance: 1,
      angle: -150,
      isLFE: false,
      isHeight: true,
    },
    {
      id: 'height-rear-right',
      name: 'Height Rear Right',
      channelIndex: 11,
      position: { x: 1, y: -1, z: 1 },
      distance: 1,
      angle: 150,
      isLFE: false,
      isHeight: true,
    },
  ],
};

export const DOLBY_ATMOS: SurroundFormatConfig = {
  format: 'atmos',
  name: 'Dolby Atmos',
  displayName: 'Atmos',
  description: 'Dolby Atmos object-based audio',
  channelCount: 128,        // Up to 128 objects
  lfeCount: 1,
  heightChannels: true,
  objectBased: true,
  speakers: SURROUND_7_1_4.speakers,
};

// =============================================================================
// Surround Format Presets
// =============================================================================

export const SURROUND_FORMATS: Record<SurroundFormat, SurroundFormatConfig> = {
  mono: MONO,
  stereo: STEREO,
  '5.1': SURROUND_5_1,
  '7.1': SURROUND_7_1,
  '7.1.4': SURROUND_7_1_4,
  '9.1': SURROUND_7_1_4, // Similar to 7.1.4
  '9.1.6': SURROUND_7_1_4, // Extended height
  atmos: DOLBY_ATMOS,
  'auro-3d': SURROUND_7_1_4,
};

// =============================================================================
// Panning Types
// =============================================================================

export interface SurroundPannerConfig {
  format: SurroundFormat;
  position: SpeakerPosition;       // -1 to 1 for each axis
  spread: number;                  // 0-100% (width of sound source)
  lfeLevel: number;                // 0-1 (LFE send level)
  distance: number;                // 0-1 (distance from listener)
  elevation: number;               // -90 to 90 degrees
  azimuth: number;                 // -180 to 180 degrees
  width: number;                   // 0-100% stereo width
  depth: number;                   // 0-100% front-to-back position
  snapToSpeakers: boolean;         // Snap to nearest speaker
  binauralMode: BinauralMode;      // Headphone rendering mode
}

export type BinauralMode = 'off' | 'headphone' | 'virtual';

export interface SurroundGain {
  gains: number[];                 // Gain per speaker (0-1)
  lfe: number;                     // LFE send level
  totalPower: number;              // Sum of all gains (for level compensation)
}

// =============================================================================
// Object-Based Audio (Atmos)
// =============================================================================

export interface AudioObject {
  id: string;
  name: string;
  position: SpeakerPosition;
  size: number;                    // 0-100% (apparent size of object)
  gain: number;                    // dB
  spread: number;                  // 0-100%
  diffusion: number;               // 0-100%
  rotation: number;                // degrees
  elevation: number;               // degrees
  distance: number;                // 0-1
  snapToGrid: boolean;
  lockPosition: boolean;
}

export interface AtmosBed {
  id: string;
  name: string;
  channels: number[];              // Speaker channel indices
  gain: number;
  enabled: boolean;
}

export interface AtmosMetadata {
  format: 'dolby-atmos';
  version: string;
  objects: AudioObject[];
  beds: AtmosBed[];
  masterVolume: number;
  trim: number;
  dynamicRange: number;
  downmix: DownmixConfig;
}

export interface DownmixConfig {
  stereo: StereoDownmix;
  surround: SurroundDownmix;
}

export interface StereoDownmix {
  centerLevel: number;             // 0-1
  surroundLevel: number;           // 0-1
  lfeLevel: number;                // 0-1
}

export interface SurroundDownmix {
  heightToEarLevel: number;        // 0-1
  rearToFront: number;             // 0-1
}

// =============================================================================
// Monitor Config
// =============================================================================

export interface SurroundMonitorConfig {
  format: SurroundFormat;
  volume: number;                  // dB
  dim: boolean;
  mute: boolean;
  soloChannel: number | null;      // Channel index or null
  bassManagement: boolean;
  bassCrossover: number;           // Hz
  distanceCompensation: boolean;
  roomSize: number;                // meters
}

// =============================================================================
// Export Types
// =============================================================================

export interface SurroundExportConfig {
  format: SurroundFormat;
  sampleRate: number;
  bitDepth: number;
  normalize: boolean;
  metadata: AtmosMetadata | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

export function getSpeakerById(config: SurroundFormatConfig, id: string): SpeakerConfig | undefined {
  return config.speakers.find(s => s.id === id);
}

export function getSpeakersByType(config: SurroundFormatConfig, type: 'main' | 'lfe' | 'height'): SpeakerConfig[] {
  switch (type) {
    case 'main':
      return config.speakers.filter(s => !s.isLFE && !s.isHeight);
    case 'lfe':
      return config.speakers.filter(s => s.isLFE);
    case 'height':
      return config.speakers.filter(s => s.isHeight);
    default:
      return [];
  }
}

export function getChannelCount(format: SurroundFormat): number {
  return SURROUND_FORMATS[format].channelCount;
}

export function isObjectBased(format: SurroundFormat): boolean {
  return SURROUND_FORMATS[format].objectBased;
}

export function hasHeightChannels(format: SurroundFormat): boolean {
  return SURROUND_FORMATS[format].heightChannels;
}

export default SURROUND_FORMATS;
