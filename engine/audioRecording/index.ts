/**
 * Audio Recording Module - Main Export
 * Central export point for the audio recording system
 */

// Core recording components
export {
  AudioRecorder,
  createAudioRecorder,
  getAudioRecorder,
  type RecordingConfig,
  type RecordingResult,
  type RecordingState,
} from './recorder';

// Input management
export {
  InputManager,
  createInputManager,
  getInputManager,
  type InputDeviceInfo,
  type InputConstraints,
  type PermissionState,
} from './inputManager';

// Buffer management
export {
  RecordingBufferManager,
  createBufferManager,
} from './bufferManager';

// Clip management
export {
  createRecordingClip,
  createClipFromBuffer,
  addClipToTimeline,
  updateClip,
  removeClip,
  splitClip,
  trimClip,
  setClipGain,
  setClipFades,
  duplicateClip,
  exportClipToUrl,
  getClipThumbnail,
  type RecordingClip,
  type CreateClipOptions,
} from './recordingClip';

// Waveform analysis
export {
  generateWaveformData,
  generateBipolarWaveformData,
  generateRMSWaveformData,
  downsampleWaveform,
  normalizeWaveform,
  smoothWaveform,
  linearToDecibel,
  decibelToLinear,
  detectSilenceRegions,
  calculatePeakAmplitude,
  calculateRMSLevel,
  WaveformAnalyzer,
} from './waveformAnalyzer';

// WAV encoding
export {
  encodeWav,
  encodeMonoWav,
  encodeStereoWav,
  downloadWav,
  parseWav,
} from './wavEncoder';

// Convenience exports
export { encodeWav as default } from './wavEncoder';
