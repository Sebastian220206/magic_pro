export { AlternativeManager, createAlternativeManager } from './alternatives';
export type {
  Alternative,
  AlternativeState,
  AlternativeComparison,
  AlternativeOptions,
} from './alternatives';

export { KeyCommandManager, createKeyCommandManager, KEY_COMMAND_PRESETS, bindingToString } from './keyCommands';
export type {
  KeyBinding,
  KeyCommand,
  KeyCommandCategory,
  KeyCommandState,
  KeyCommandPreset,
  KeyCommandOptions,
} from './keyCommands';

export { ScreensetManager, createScreensetManager } from './screensets';
export type {
  PanelType,
  PanelState,
  Screenset,
  ScreensetState,
  ScreensetOptions,
} from './screensets';

export { TrackTemplateManager, createTrackTemplateManager } from './trackTemplateManager';
export type {
  TrackTemplate,
  TrackTemplateCategory,
  TrackTemplateManagerState,
  TrackTemplateManagerOptions,
  TrackTemplateExport,
  TemplateValidationError,
  EffectSlotConfig,
  EffectChainConfig,
  SendConfig,
  SendDestinationType,
  InstrumentConfig,
  InputConfig,
  InputSourceType,
  OutputConfig,
  OutputDestinationType,
  AutomationLaneConfig,
  TrackType,
} from './trackTemplateTypes';

export { BUILTIN_TRACK_TEMPLATES } from './trackTemplatePresets';
