export { TrackStackManager, createTrackStackManager } from './trackStack';
export type { TrackStackConfig, TrackStackOptions, TrackStackState, StackType } from './trackStack';

export { VCAFaderManager, createVCAFaderManager } from './vcaFader';
export type { VCAFaderConfig, VCAFaderOptions, VCAFaderState } from './vcaFader';

export { AutomationModeManager, createAutomationModeManager } from './automationModes';
export type { AutomationModeType, AutomationModeConfig, AutomationModeState } from './automationModes';

export {
  PanLawEngine,
  createPanLawEngine,
  processPanLaw,
  processPanLawMono,
} from './panLawEngine';
export type { PanConfig, PanMode } from './panLawEngine';

export {
  PAN_LAW_PRESETS,
  calculatePanGain,
  calculatePanGainDb,
  getPanLawInfo,
  getAvailablePanLaws,
  calculateBalanceGain,
  calculatePanWithWidth,
  calculateMidSideGain,
  midSideToPan,
  comparePanLaws,
  generatePanLawCurve,
} from './panLaws';
export type { PanLaw, PanGain, PanLawType } from './panLaws';

export {
  SurroundPanner,
  createSurroundPanner,
} from './surroundPanner';

export {
  SurroundBus,
  createSurroundBus,
} from './surroundBus';
export type { SurroundBusChannel, SurroundBusConfig, SurroundBusState } from './surroundBus';

export {
  SURROUND_FORMATS,
  getSpeakerById,
  getSpeakersByType,
  getChannelCount,
  isObjectBased,
  hasHeightChannels,
} from './surroundTypes';
export type {
  SurroundFormat,
  SurroundFormatConfig,
  SurroundPannerConfig,
  SurroundGain,
  SurroundMonitorConfig,
  SpeakerConfig,
  SpeakerPosition,
  BinauralMode,
  AudioObject,
  AtmosBed,
  AtmosMetadata,
  DownmixConfig,
  StereoDownmix,
  SurroundDownmix,
} from './surroundTypes';
