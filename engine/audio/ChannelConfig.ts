export type ChannelFormat =
  | 'mono'
  | 'stereo'
  | 'quad'
  | '5.1'
  | '7.1'
  | 'ambisonic_1st'
  | 'ambisonic_2nd';

export interface ChannelConfig {
  format: ChannelFormat;
  channelCount: number;
  channelLabels: string[];
}

export const CHANNEL_CONFIGS: Record<ChannelFormat, Omit<ChannelConfig, 'format'>> = {
  mono:           { channelCount: 1,  channelLabels: ['Mono'] },
  stereo:         { channelCount: 2,  channelLabels: ['L', 'R'] },
  quad:           { channelCount: 4,  channelLabels: ['L', 'R', 'Ls', 'Rs'] },
  '5.1':          { channelCount: 6,  channelLabels: ['L', 'R', 'C', 'LFE', 'Ls', 'Rs'] },
  '7.1':          { channelCount: 8,  channelLabels: ['L', 'R', 'C', 'LFE', 'Ls', 'Rs', 'Lb', 'Rb'] },
  'ambisonic_1st': { channelCount: 4,  channelLabels: ['W', 'Y', 'Z', 'X'] },
  'ambisonic_2nd': { channelCount: 9,  channelLabels: ['W', 'Y', 'Z', 'X', 'V', 'T', 'R', 'S', 'U'] },
};

export function getChannelConfig(format: ChannelFormat): ChannelConfig {
  const base = CHANNEL_CONFIGS[format];
  return { format, ...base };
}

export function getChannelCount(format: ChannelFormat): number {
  return CHANNEL_CONFIGS[format].channelCount;
}

export function formatChannelLabel(format: ChannelFormat, channelIndex: number): string {
  const cfg = CHANNEL_CONFIGS[format];
  return cfg.channelLabels[channelIndex] ?? `Ch ${channelIndex + 1}`;
}

export interface AudioInputChannel {
  index: number;
  label: string;
  deviceChannel: number;
}

export interface TrackChannelRouting {
  format: ChannelFormat;
  inputMapping: AudioInputChannel[];
  outputMapping: AudioInputChannel[];
  panLaw: 'default' | 'equal-power' | 'linear' | 'surround';
}
