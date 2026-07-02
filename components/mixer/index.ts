// =============================================================================
// Mixer Components - Main export file
// =============================================================================

export { Mixer, type MixerProps, type MixerChannelState, type BusState, type SendConfig } from './Mixer';
export { ChannelStrip, type ChannelStripProps, type SendInfo } from './ChannelStrip';
export { Meter, type MeterProps } from './Meter';
export { SendControls, type SendControlsProps, type SendInfo as SendControlInfo } from './SendControls';
export { MasteringPanel } from './MasteringPanel';

// Default exports
export { default } from './Mixer';
export { default as ChannelStripDefault } from './ChannelStrip';
export { default as MeterDefault } from './Meter';
export { default as SendControlsDefault } from './SendControls';
