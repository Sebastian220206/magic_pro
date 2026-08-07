/**
 * Audio Export Types - MP3/AAC Export Configuration
 *
 * Features:
 * - Multiple output formats (MP3, AAC, WAV, FLAC, OGG)
 * - Bitrate and quality settings
 * - Metadata support (ID3 tags for MP3, MP4 tags for AAC)
 * - Sample rate conversion
 * - Normalization options
 * - Dithering for bit depth reduction
 */

// =============================================================================
// Export Format Types
// =============================================================================

export type AudioExportFormat = 'mp3' | 'aac' | 'wav' | 'flac' | 'ogg' | 'webm';

export interface AudioFormatConfig {
  format: AudioExportFormat;
  mimeType: string;
  extension: string;
  displayName: string;
  description: string;
  supportsMetadata: boolean;
  supportsQuality: boolean;
}

export const AUDIO_FORMAT_CONFIGS: Record<AudioExportFormat, AudioFormatConfig> = {
  mp3: {
    format: 'mp3',
    mimeType: 'audio/mpeg',
    extension: 'mp3',
    displayName: 'MP3',
    description: 'Most compatible format, good for sharing',
    supportsMetadata: true,
    supportsQuality: true,
  },
  aac: {
    format: 'aac',
    mimeType: 'audio/aac',
    extension: 'aac',
    displayName: 'AAC',
    description: 'Better quality than MP3 at same bitrate',
    supportsMetadata: true,
    supportsQuality: true,
  },
  wav: {
    format: 'wav',
    mimeType: 'audio/wav',
    extension: 'wav',
    displayName: 'WAV',
    description: 'Uncompressed, highest quality',
    supportsMetadata: false,
    supportsQuality: false,
  },
  flac: {
    format: 'flac',
    mimeType: 'audio/flac',
    extension: 'flac',
    displayName: 'FLAC',
    description: 'Lossless compression, high quality',
    supportsMetadata: true,
    supportsQuality: false,
  },
  ogg: {
    format: 'ogg',
    mimeType: 'audio/ogg',
    extension: 'ogg',
    displayName: 'OGG Vorbis',
    description: 'Open format, good quality',
    supportsMetadata: true,
    supportsQuality: true,
  },
  webm: {
    format: 'webm',
    mimeType: 'audio/webm',
    extension: 'webm',
    displayName: 'WebM',
    description: 'Modern web format',
    supportsMetadata: false,
    supportsQuality: true,
  },
};

// =============================================================================
// Bitrate Presets
// =============================================================================

export type BitratePreset = 'low' | 'medium' | 'high' | 'very-high' | 'archival';

export interface BitrateConfig {
  preset: BitratePreset;
  bitrate: number;          // kbps
  label: string;
  description: string;
}

export const MP3_BITRATES: Record<BitratePreset, BitrateConfig> = {
  low: { preset: 'low', bitrate: 128, label: '128 kbps', description: 'Good for voice, podcasts' },
  medium: { preset: 'medium', bitrate: 192, label: '192 kbps', description: 'Good for music, balanced' },
  high: { preset: 'high', bitrate: 256, label: '256 kbps', description: 'High quality music' },
  'very-high': { preset: 'very-high', bitrate: 320, label: '320 kbps', description: 'Near transparent quality' },
  archival: { preset: 'archival', bitrate: 320, label: '320 kbps (V0)', description: 'Variable bitrate, best quality' },
};

export const AAC_BITRATES: Record<BitratePreset, BitrateConfig> = {
  low: { preset: 'low', bitrate: 96, label: '96 kbps', description: 'Good for voice' },
  medium: { preset: 'medium', bitrate: 128, label: '128 kbps', description: 'Good for music' },
  high: { preset: 'high', bitrate: 192, label: '192 kbps', description: 'High quality' },
  'very-high': { preset: 'very-high', bitrate: 256, label: '256 kbps', description: 'Near transparent' },
  archival: { preset: 'archival', bitrate: 320, label: '320 kbps', description: 'Archival quality' },
};

// =============================================================================
// Sample Rate Options
// =============================================================================

export type SampleRate = 8000 | 11025 | 16000 | 22050 | 32000 | 44100 | 48000 | 88200 | 96000;

export const SAMPLE_RATES: SampleRate[] = [
  8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000,
];

export const DEFAULT_SAMPLE_RATE: SampleRate = 44100;

// =============================================================================
// Bit Depth Options
// =============================================================================

export type BitDepth = 8 | 16 | 24 | 32;

export const BIT_DEPTHS: BitDepth[] = [8, 16, 24, 32];

export const DEFAULT_BIT_DEPTH: BitDepth = 16;

// =============================================================================
// Metadata Types
// =============================================================================

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  comment?: string;
  track?: number;
  composer?: string;
  conductor?: string;
  copyright?: string;
  isrc?: string;            // International Standard Recording Code
  artwork?: AudioArtwork;
}

export interface AudioArtwork {
  data: Uint8Array;         // Image data (JPEG/PNG)
  mimeType: string;         // 'image/jpeg' or 'image/png'
  width?: number;
  height?: number;
  description?: string;
}

// =============================================================================
// Normalization Types
// =============================================================================

export type NormalizationMode = 'none' | 'peak' | 'loudness' | 'true-peak';

export interface NormalizationConfig {
  mode: NormalizationMode;
  targetLevel: number;      // dB (for peak: -0.3 to 0, for loudness: -24 to -14)
  truePeakLimit: number;    // dB (for true-peak limiting, typically -1 to -0.3)
  limiterEnabled: boolean;
  limiterRelease: number;   // ms
}

// =============================================================================
// Dithering Types
// =============================================================================

export type DitherType = 'none' | 'rectangular' | 'triangular' | 'pdf';

export interface DitherConfig {
  type: DitherType;
  bitDepth: BitDepth;
  noiseShaping: boolean;
}

// =============================================================================
// Export Options
// =============================================================================

export interface AudioExportOptions {
  format: AudioExportFormat;
  bitrate?: BitratePreset;   // For MP3/AAC
  sampleRate?: SampleRate;
  bitDepth?: BitDepth;       // For WAV/FLAC

  // Normalization
  normalization: NormalizationConfig;

  // Dithering
  dither: DitherConfig;

  // Metadata
  metadata: AudioMetadata;

  // Export range
  exportRange?: {
    startBeat: number;
    endBeat: number;
  };

  // Fade in/out
  fadeIn?: {
    duration: number;        // seconds
    curve: 'linear' | 'exponential' | 's-curve';
  };
  fadeOut?: {
    duration: number;
    curve: 'linear' | 'exponential' | 's-curve';
  };

  // Advanced
  bitDepthReduction: boolean;
  sampleRateConversion: boolean;
  highQualityResampling: boolean;
}

// =============================================================================
// Export Job Types
// =============================================================================

export type ExportJobStatus = 'pending' | 'encoding' | 'normalizing' | 'metadata' | 'complete' | 'error' | 'cancelled';

export interface ExportJob {
  id: string;
  status: ExportJobStatus;
  progress: number;         // 0-100
  options: AudioExportOptions;
  result?: ExportResult;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  format: AudioExportFormat;
  duration: number;         // seconds
  sampleRate: SampleRate;
  bitDepth?: BitDepth;
  fileSize: number;         // bytes
  metadata: AudioMetadata;
}

// =============================================================================
// Export Progress Callback
// =============================================================================

export type ExportProgressCallback = (progress: {
  status: ExportJobStatus;
  percent: number;
  message: string;
}) => void;

// =============================================================================
// Validation
// =============================================================================

export interface ExportValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateExportOptions(options: AudioExportOptions): ExportValidationError[] {
  const errors: ExportValidationError[] = [];

  // Format validation
  if (!AUDIO_FORMAT_CONFIGS[options.format]) {
    errors.push({ field: 'format', message: `Unsupported format: ${options.format}`, severity: 'error' });
  }

  // Bitrate validation for MP3/AAC
  if (options.format === 'mp3' || options.format === 'aac') {
    if (!options.bitrate) {
      errors.push({ field: 'bitrate', message: 'Bitrate is required for MP3/AAC', severity: 'error' });
    }
  }

  // Sample rate validation
  if (options.sampleRate && !SAMPLE_RATES.includes(options.sampleRate)) {
    errors.push({ field: 'sampleRate', message: `Invalid sample rate: ${options.sampleRate}`, severity: 'error' });
  }

  // Normalization validation
  if (options.normalization.mode !== 'none') {
    if (options.normalization.targetLevel < -60 || options.normalization.targetLevel > 0) {
      errors.push({ field: 'normalization.targetLevel', message: 'Target level must be between -60 and 0 dB', severity: 'warning' });
    }
  }

  return errors;
}

export default AudioExportOptions;
