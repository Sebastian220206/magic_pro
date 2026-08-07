export {
  exportProject,
  exportAAF,
  exportOMF,
  exportXML,
  exportMIDI,
  exportMusicXML,
  downloadExport,
} from './advancedExport';
export type {
  ExportFormat,
  ExportTrackData,
  ExportClipData,
  ExportNoteData,
  ExportMarkerData,
  ExportTempoData,
  ExportProjectData,
  AdvancedExportOptions,
} from './advancedExport';

export { StemExporter, createStemExporter } from './stemExporter';
export type {
  StemFormat,
  StemDefinition,
  StemExportConfig,
  StemExportJob,
  StemExportState,
  StemExporterOptions,
} from './stemExporter';

export {
  AudioExporter,
  createAudioExporter,
} from './audioExporter';
export type {
  AudioExportFormat,
  AudioExportOptions,
  AudioMetadata,
  AudioArtwork,
  NormalizationConfig,
  NormalizationMode,
  DitherConfig,
  DitherType,
  ExportJob,
  ExportResult,
  ExportJobStatus,
  ExportProgressCallback,
  BitratePreset,
  BitrateConfig,
  SampleRate,
  BitDepth,
  AudioFormatConfig,
} from './audioExportTypes';

export {
  AUDIO_FORMAT_CONFIGS,
  MP3_BITRATES,
  AAC_BITRATES,
  SAMPLE_RATES,
  BIT_DEPTHS,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_BIT_DEPTH,
  validateExportOptions,
} from './audioExportTypes';
