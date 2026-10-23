// Effects plugins
export { CompressorPlugin, COMPRESSOR_PRESETS, createCompressorPlugin } from './compressorPlugin';
export type { CompressorParameters, CompressorOptions, CompressorMode } from './compressorPlugin';

export { DelayPlugin, DELAY_PRESETS, createDelayPlugin } from './delayPlugin';
export type { DelayParameters, DelayOptions, DelaySync } from './delayPlugin';

export { EQPlugin, createEQPlugin, defaultBands, defaultEQState, EQ_BAND_COUNT } from './eqPlugin';
export type { EQState, EQBandState, EQBandType } from './eqPlugin';

export { LimiterPlugin, LIMITER_PRESETS, createLimiterPlugin } from './limiterPlugin';
export type { LimiterParameters, LimiterOptions } from './limiterPlugin';

export { ReverbPlugin, REVERB_PRESETS, createReverbPlugin } from './reverbPlugin';
export type { ReverbParameters, ReverbOptions, ReverbMode } from './reverbPlugin';

export { SaturationPlugin, SATURATION_PRESETS, createSaturationPlugin, DEFAULT_PARAMS as SATURATION_DEFAULT_PARAMS } from './saturationPlugin';
export type { SaturationParameters, SaturationOptions, SaturationType } from './saturationPlugin';

export { WidenerPlugin, WIDENER_PRESETS, createWidenerPlugin, DEFAULT_PARAMS as WIDENER_DEFAULT_PARAMS } from './widenerPlugin';
export type { WidenerParameters, WidenerOptions } from './widenerPlugin';

export { VintageEq, createVintageEqPlugin, DEFAULT_PARAMS as VINTAGE_EQ_DEFAULT_PARAMS } from './vintageEq';
export type { VintageEqParameters, VintageEqState, VintageEqType, VintageEqOptions } from './vintageEq';

export { UtilityPlugin, createUtilityPlugin, DEFAULT_PARAMS as UTILITY_DEFAULT_PARAMS } from './utilityPlugin';
export type { UtilityParameters, UtilityOptions } from './utilityPlugin';

export { TremoloPlugin, createTremoloPlugin, DEFAULT_PARAMS as TREMOLO_DEFAULT_PARAMS } from './tremoloPlugin';
export type { TremoloParameters, TremoloOptions, TremoloWaveform } from './tremoloPlugin';

export { AutoPanPlugin, createAutoPanPlugin, DEFAULT_PARAMS as AUTOPAN_DEFAULT_PARAMS } from './autoPanPlugin';
export type { AutoPanParameters, AutoPanOptions, AutoPanWaveform } from './autoPanPlugin';

export { RingModPlugin, createRingModPlugin, DEFAULT_PARAMS as RINGMOD_DEFAULT_PARAMS } from './ringModPlugin';
export type { RingModParameters, RingModOptions } from './ringModPlugin';

export { PhaserPlugin, createPhaserPlugin, DEFAULT_PARAMS as PHASER_DEFAULT_PARAMS } from './phaserPlugin';
export type { PhaserParameters, PhaserOptions } from './phaserPlugin';

export { GraphicEqPlugin, createGraphicEqPlugin, GRAPHIC_EQ_FREQS, GRAPHIC_EQ_BAND_COUNT, DEFAULT_PARAMS as GRAPHIC_EQ_DEFAULT_PARAMS } from './graphicEqPlugin';
export type { GraphicEqParameters, GraphicEqOptions } from './graphicEqPlugin';

export { StereoImagerPlugin, createStereoImagerPlugin, DEFAULT_PARAMS as STEREO_IMAGER_DEFAULT_PARAMS } from './stereoImagerPlugin';
export type { StereoImagerParameters, StereoImagerOptions } from './stereoImagerPlugin';
