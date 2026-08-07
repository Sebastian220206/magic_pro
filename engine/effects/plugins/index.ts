// Effects plugins
export { CompressorPlugin, COMPRESSOR_PRESETS, createCompressorPlugin } from './compressorPlugin';
export type { CompressorParameters, CompressorOptions, CompressorMode } from './compressorPlugin';

export { DelayPlugin, DELAY_PRESETS, createDelayPlugin } from './delayPlugin';
export type { DelayParameters, DelayOptions, DelaySync } from './delayPlugin';

export { EQPlugin, EQ_PRESETS, createEQPlugin } from './eqPlugin';
export type { EQState, EQBand, EQOptions } from './eqPlugin';

export { LimiterPlugin, LIMITER_PRESETS, createLimiterPlugin } from './limiterPlugin';
export type { LimiterParameters, LimiterOptions } from './limiterPlugin';

export { ReverbPlugin, REVERB_PRESETS, createReverbPlugin } from './reverbPlugin';
export type { ReverbParameters, ReverbOptions, ReverbMode } from './reverbPlugin';
