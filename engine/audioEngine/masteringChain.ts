export type MasteringPresetId = 'streaming' | 'vinyl' | 'broadcast' | 'club' | 'acoustic' | 'drums-bass' | 'custom';

export interface MasteringLimiterConfig {
  threshold: number;
  attack: number;
  release: number;
  lookahead: number;
}

export interface MasteringEQConfig {
  lowShelfFreq: number;
  lowShelfGain: number;
  lowMidFreq: number;
  lowMidQ: number;
  lowMidGain: number;
  highMidFreq: number;
  highMidQ: number;
  highMidGain: number;
  highShelfFreq: number;
  highShelfGain: number;
}

export interface MasteringMultibandConfig {
  crossoverLow: number;
  crossoverMid: number;
  crossoverHigh: number;
  lowThreshold: number;
  lowRatio: number;
  midThreshold: number;
  midRatio: number;
  highThreshold: number;
  highRatio: number;
}

export interface MasteringChainState {
  presetId: MasteringPresetId;
  presetName: string;
  limiter: MasteringLimiterConfig;
  eq: MasteringEQConfig;
  multiband: MasteringMultibandConfig;
  stereoWidth: number;
  loudnessTarget: number;
  dcOffsetFilter: boolean;
}

const STREAMING: MasteringChainState = {
  presetId: 'streaming',
  presetName: 'Mastering for Streaming',
  limiter: { threshold: -1, attack: 0.003, release: 0.1, lookahead: 2 },
  eq: { lowShelfFreq: 60, lowShelfGain: 0, lowMidFreq: 250, lowMidQ: 0.7, lowMidGain: 0, highMidFreq: 4000, highMidQ: 0.7, highMidGain: 0, highShelfFreq: 12000, highShelfGain: 0 },
  multiband: { crossoverLow: 200, crossoverMid: 2000, crossoverHigh: 8000, lowThreshold: -20, lowRatio: 3, midThreshold: -24, midRatio: 2.5, highThreshold: -18, highRatio: 3 },
  stereoWidth: 1,
  loudnessTarget: -14,
  dcOffsetFilter: true,
};

const VINYL: MasteringChainState = {
  presetId: 'vinyl',
  presetName: 'Mastering for Vinyl',
  limiter: { threshold: -3, attack: 0.005, release: 0.15, lookahead: 1.5 },
  eq: { lowShelfFreq: 80, lowShelfGain: -1.5, lowMidFreq: 300, lowMidQ: 0.5, lowMidGain: -0.5, highMidFreq: 5000, highMidQ: 0.5, highMidGain: -0.5, highShelfFreq: 10000, highShelfGain: -1 },
  multiband: { crossoverLow: 150, crossoverMid: 2500, crossoverHigh: 7500, lowThreshold: -18, lowRatio: 2.5, midThreshold: -22, midRatio: 2, highThreshold: -16, highRatio: 2.5 },
  stereoWidth: 0.85,
  loudnessTarget: -12,
  dcOffsetFilter: true,
};

const BROADCAST: MasteringChainState = {
  presetId: 'broadcast',
  presetName: 'Broadcast / TV',
  limiter: { threshold: -2, attack: 0.002, release: 0.08, lookahead: 3 },
  eq: { lowShelfFreq: 80, lowShelfGain: 1.5, lowMidFreq: 200, lowMidQ: 0.6, lowMidGain: -0.5, highMidFreq: 3500, highMidQ: 0.7, highMidGain: 1, highShelfFreq: 10000, highShelfGain: 2 },
  multiband: { crossoverLow: 150, crossoverMid: 3000, crossoverHigh: 7000, lowThreshold: -22, lowRatio: 3.5, midThreshold: -26, midRatio: 3, highThreshold: -20, highRatio: 3 },
  stereoWidth: 0.9,
  loudnessTarget: -16,
  dcOffsetFilter: true,
};

const CLUB: MasteringChainState = {
  presetId: 'club',
  presetName: 'Club / Dance',
  limiter: { threshold: -0.5, attack: 0.002, release: 0.12, lookahead: 2 },
  eq: { lowShelfFreq: 50, lowShelfGain: 2, lowMidFreq: 200, lowMidQ: 0.7, lowMidGain: -1, highMidFreq: 5000, highMidQ: 0.8, highMidGain: 1, highShelfFreq: 14000, highShelfGain: 1.5 },
  multiband: { crossoverLow: 100, crossoverMid: 1500, crossoverHigh: 6000, lowThreshold: -16, lowRatio: 4, midThreshold: -20, midRatio: 3, highThreshold: -14, highRatio: 2.5 },
  stereoWidth: 1.1,
  loudnessTarget: -9,
  dcOffsetFilter: true,
};

const ACOUSTIC: MasteringChainState = {
  presetId: 'acoustic',
  presetName: 'Acoustic / Classical',
  limiter: { threshold: -3, attack: 0.01, release: 0.2, lookahead: 1 },
  eq: { lowShelfFreq: 80, lowShelfGain: 0.5, lowMidFreq: 300, lowMidQ: 0.5, lowMidGain: -0.5, highMidFreq: 3000, highMidQ: 0.5, highMidGain: 0.5, highShelfFreq: 12000, highShelfGain: 1 },
  multiband: { crossoverLow: 200, crossoverMid: 2000, crossoverHigh: 8000, lowThreshold: -24, lowRatio: 2, midThreshold: -28, midRatio: 1.8, highThreshold: -22, highRatio: 2 },
  stereoWidth: 1.05,
  loudnessTarget: -16,
  dcOffsetFilter: false,
};

const DRUMS_BASS: MasteringChainState = {
  presetId: 'drums-bass',
  presetName: 'Drums & Bass',
  limiter: { threshold: -0.5, attack: 0.001, release: 0.05, lookahead: 2 },
  eq: { lowShelfFreq: 40, lowShelfGain: 3, lowMidFreq: 150, lowMidQ: 1, lowMidGain: -2, highMidFreq: 6000, highMidQ: 1, highMidGain: 2, highShelfFreq: 15000, highShelfGain: 2 },
  multiband: { crossoverLow: 80, crossoverMid: 1000, crossoverHigh: 5000, lowThreshold: -14, lowRatio: 4, midThreshold: -18, midRatio: 3, highThreshold: -12, highRatio: 2.5 },
  stereoWidth: 1.2,
  loudnessTarget: -8,
  dcOffsetFilter: true,
};

const PRESETS: Record<string, MasteringChainState> = {
  streaming: STREAMING,
  vinyl: VINYL,
  broadcast: BROADCAST,
  club: CLUB,
  acoustic: ACOUSTIC,
  'drums-bass': DRUMS_BASS,
};

const DEFAULT_MASTERING_STATE: MasteringChainState = {
  presetId: 'streaming',
  presetName: 'Mastering for Streaming',
  limiter: { threshold: -1, attack: 0.003, release: 0.1, lookahead: 2 },
  eq: { lowShelfFreq: 60, lowShelfGain: 0, lowMidFreq: 250, lowMidQ: 0.7, lowMidGain: 0, highMidFreq: 4000, highMidQ: 0.7, highMidGain: 0, highShelfFreq: 12000, highShelfGain: 0 },
  multiband: { crossoverLow: 200, crossoverMid: 2000, crossoverHigh: 8000, lowThreshold: -20, lowRatio: 3, midThreshold: -24, midRatio: 2.5, highThreshold: -18, highRatio: 3 },
  stereoWidth: 1,
  loudnessTarget: -14,
  dcOffsetFilter: true,
};

export class MasteringChain {
  private state: MasteringChainState;

  constructor(initial?: Partial<MasteringChainState>) {
    this.state = { ...DEFAULT_MASTERING_STATE, ...initial };
  }

  loadPreset(presetId: MasteringPresetId): boolean {
    const preset = PRESETS[presetId];
    if (!preset) return false;
    this.state = { ...preset };
    return true;
  }

  getPresets(): { id: string; name: string }[] {
    return Object.values(PRESETS).map(p => ({ id: p.presetId, name: p.presetName }));
  }

  getState(): MasteringChainState {
    return { ...this.state };
  }

  setState(state: Partial<MasteringChainState>) {
    this.state = { ...this.state, ...state };
  }

  setLimiter(config: Partial<MasteringLimiterConfig>) {
    this.state.limiter = { ...this.state.limiter, ...config };
  }

  setEQ(config: Partial<MasteringEQConfig>) {
    this.state.eq = { ...this.state.eq, ...config };
  }

  setMultiband(config: Partial<MasteringMultibandConfig>) {
    this.state.multiband = { ...this.state.multiband, ...config };
  }

  setStereoWidth(width: number) {
    this.state.stereoWidth = Math.max(0, Math.min(2, width));
  }

  setLoudnessTarget(target: number) {
    this.state.loudnessTarget = Math.max(-30, Math.min(0, target));
  }

  serialize() {
    return { ...this.state };
  }

  static deserialize(data: MasteringChainState): MasteringChain {
    return new MasteringChain(data);
  }
}

export { PRESETS, DEFAULT_MASTERING_STATE };
export default MasteringChain;
