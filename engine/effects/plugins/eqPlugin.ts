/**
 * EQPlugin - Professional 3-Band Parametric Equalizer
 * 
 * Features:
 * - Low Shelf: Boost/cut low frequencies
 * - Mid Peak: Parametric bell filter for mids
 * - High Shelf: Boost/cut high frequencies
 * 
 * Signal Flow:
 * Input → Low Shelf → Mid Peak → High Shelf → Output
 * 
 * All parameters are automatable and use smooth transitions.
 */

// =============================================================================
// Types
// =============================================================================

export interface EQBand {
  frequency: number;  // Hz
  gain: number;       // dB (-18 to +18)
  Q: number;         // Quality factor (0.1 to 10)
}

export interface EQState {
  lowShelf: EQBand;
  midPeak: EQBand;
  highShelf: EQBand;
  bypass: boolean;
}

export interface EQOptions {
  lowShelfFreq?: number;   // Default: 250 Hz
  midPeakFreq?: number;      // Default: 1000 Hz
  highShelfFreq?: number;    // Default: 4000 Hz
  sampleRate?: number;
}

// =============================================================================
// Default Parameters
// =============================================================================

const DEFAULT_LOW_SHELF: EQBand = {
  frequency: 250,
  gain: 0,
  Q: 0.707,  // Butterworth Q
};

const DEFAULT_MID_PEAK: EQBand = {
  frequency: 1000,
  gain: 0,
  Q: 1.0,
};

const DEFAULT_HIGH_SHELF: EQBand = {
  frequency: 4000,
  gain: 0,
  Q: 0.707,  // Butterworth Q
};

// =============================================================================
// EQPlugin Class
// =============================================================================

export class EQPlugin {
  private audioContext: AudioContext;
  private inputNode!: GainNode;
  private outputNode!: GainNode;
  private bypassNode!: GainNode;
  
  // Filter nodes
  private lowShelfFilter!: BiquadFilterNode;
  private midPeakFilter!: BiquadFilterNode;
  private highShelfFilter!: BiquadFilterNode;
  
  // State
  private state: EQState;
  private isBypassed: boolean = false;
  
  // Parameter change smoothing (seconds)
  private readonly SMOOTHING_TIME = 0.01;
  
  constructor(audioContext: AudioContext, options: EQOptions = {}) {
    this.audioContext = audioContext;
    
    this.state = {
      lowShelf: { ...DEFAULT_LOW_SHELF, frequency: options.lowShelfFreq ?? 250 },
      midPeak: { ...DEFAULT_MID_PEAK, frequency: options.midPeakFreq ?? 1000 },
      highShelf: { ...DEFAULT_HIGH_SHELF, frequency: options.highShelfFreq ?? 4000 },
      bypass: false,
    };
    
    this.createAudioGraph();
  }
  
  // ===========================================================================
  // Audio Graph Construction
  // ===========================================================================
  
  private createAudioGraph(): void {
    const ctx = this.audioContext;
    
    // Input/output nodes
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.bypassNode = ctx.createGain();
    this.bypassNode.gain.value = 0;  // Bypass is off by default
    
    // Create filters
    this.lowShelfFilter = ctx.createBiquadFilter();
    this.lowShelfFilter.type = 'lowshelf';
    this.lowShelfFilter.frequency.value = this.state.lowShelf.frequency;
    this.lowShelfFilter.gain.value = this.state.lowShelf.gain;
    
    this.midPeakFilter = ctx.createBiquadFilter();
    this.midPeakFilter.type = 'peaking';
    this.midPeakFilter.frequency.value = this.state.midPeak.frequency;
    this.midPeakFilter.gain.value = this.state.midPeak.gain;
    this.midPeakFilter.Q.value = this.state.midPeak.Q;
    
    this.highShelfFilter = ctx.createBiquadFilter();
    this.highShelfFilter.type = 'highshelf';
    this.highShelfFilter.frequency.value = this.state.highShelf.frequency;
    this.highShelfFilter.gain.value = this.state.highShelf.gain;
    
    // Chain: input → lowShelf → midPeak → highShelf → output
    this.inputNode.connect(this.lowShelfFilter);
    this.lowShelfFilter.connect(this.midPeakFilter);
    this.midPeakFilter.connect(this.highShelfFilter);
    this.highShelfFilter.connect(this.outputNode);
    
    // Bypass path: input → bypassNode → output
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);
  }
  
  // ===========================================================================
  // Low Shelf Control
  // ===========================================================================
  
  /**
   * Set low shelf frequency
   */
  public setLowShelfFrequency(hz: number): void {
    this.state.lowShelf.frequency = Math.max(20, Math.min(1000, hz));
    this.lowShelfFilter.frequency.setTargetAtTime(
      this.state.lowShelf.frequency,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  /**
   * Set low shelf gain in dB
   */
  public setLowShelfGain(db: number): void {
    this.state.lowShelf.gain = Math.max(-18, Math.min(18, db));
    this.lowShelfFilter.gain.setTargetAtTime(
      this.state.lowShelf.gain,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  public getLowShelf(): EQBand {
    return { ...this.state.lowShelf };
  }
  
  // ===========================================================================
  // Mid Peak Control
  // ===========================================================================
  
  /**
   * Set mid peak frequency
   */
  public setMidPeakFrequency(hz: number): void {
    this.state.midPeak.frequency = Math.max(200, Math.min(8000, hz));
    this.midPeakFilter.frequency.setTargetAtTime(
      this.state.midPeak.frequency,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  /**
   * Set mid peak gain in dB
   */
  public setMidPeakGain(db: number): void {
    this.state.midPeak.gain = Math.max(-18, Math.min(18, db));
    this.midPeakFilter.gain.setTargetAtTime(
      this.state.midPeak.gain,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  /**
   * Set mid peak Q (bandwidth)
   */
  public setMidPeakQ(q: number): void {
    this.state.midPeak.Q = Math.max(0.1, Math.min(10, q));
    this.midPeakFilter.Q.setTargetAtTime(
      this.state.midPeak.Q,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  public getMidPeak(): EQBand {
    return { ...this.state.midPeak };
  }
  
  // ===========================================================================
  // High Shelf Control
  // ===========================================================================
  
  /**
   * Set high shelf frequency
   */
  public setHighShelfFrequency(hz: number): void {
    this.state.highShelf.frequency = Math.max(2000, Math.min(16000, hz));
    this.highShelfFilter.frequency.setTargetAtTime(
      this.state.highShelf.frequency,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  /**
   * Set high shelf gain in dB
   */
  public setHighShelfGain(db: number): void {
    this.state.highShelf.gain = Math.max(-18, Math.min(18, db));
    this.highShelfFilter.gain.setTargetAtTime(
      this.state.highShelf.gain,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  public getHighShelf(): EQBand {
    return { ...this.state.highShelf };
  }
  
  // ===========================================================================
  // Bypass
  // ===========================================================================
  
  /**
   * Toggle EQ bypass
   */
  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    this.state.bypass = bypass;
    
    const currentTime = this.audioContext.currentTime;
    
    if (bypass) {
      // Enable bypass path, disable EQ path
      this.bypassNode.gain.setTargetAtTime(1, currentTime, this.SMOOTHING_TIME);
      this.lowShelfFilter.disconnect();
      this.lowShelfFilter.connect(this.midPeakFilter);
      this.midPeakFilter.connect(this.highShelfFilter);
      this.highShelfFilter.connect(this.outputNode);
    } else {
      // Disable bypass path, enable EQ path
      this.bypassNode.gain.setTargetAtTime(0, currentTime, this.SMOOTHING_TIME);
      this.lowShelfFilter.connect(this.midPeakFilter);
      this.midPeakFilter.connect(this.highShelfFilter);
      this.highShelfFilter.connect(this.outputNode);
    }
  }
  
  public isBypassedState(): boolean {
    return this.isBypassed;
  }
  
  // ===========================================================================
  // Preset Management
  // ===========================================================================
  
  /**
   * Apply a preset EQ setting
   */
  public applyPreset(preset: keyof typeof EQ_PRESETS): void {
    const settings = EQ_PRESETS[preset];
    if (!settings) return;
    
    this.setLowShelfFrequency(settings.lowShelf.frequency);
    this.setLowShelfGain(settings.lowShelf.gain);
    
    this.setMidPeakFrequency(settings.midPeak.frequency);
    this.setMidPeakGain(settings.midPeak.gain);
    this.setMidPeakQ(settings.midPeak.Q);
    
    this.setHighShelfFrequency(settings.highShelf.frequency);
    this.setHighShelfGain(settings.highShelf.gain);
  }
  
  /**
   * Reset to flat (no EQ)
   */
  public reset(): void {
    this.setLowShelfGain(0);
    this.setMidPeakGain(0);
    this.setHighShelfGain(0);
    this.setMidPeakQ(1);
  }
  
  // ===========================================================================
  // State Management
  // ===========================================================================
  
  public getState(): EQState {
    return {
      lowShelf: { ...this.state.lowShelf },
      midPeak: { ...this.state.midPeak },
      highShelf: { ...this.state.highShelf },
      bypass: this.isBypassed,
    };
  }
  
  public setState(state: Partial<EQState>): void {
    if (state.lowShelf) {
      this.setLowShelfFrequency(state.lowShelf.frequency);
      this.setLowShelfGain(state.lowShelf.gain);
    }
    if (state.midPeak) {
      this.setMidPeakFrequency(state.midPeak.frequency);
      this.setMidPeakGain(state.midPeak.gain);
      this.setMidPeakQ(state.midPeak.Q);
    }
    if (state.highShelf) {
      this.setHighShelfFrequency(state.highShelf.frequency);
      this.setHighShelfGain(state.highShelf.gain);
    }
    if (state.bypass !== undefined) {
      this.setBypass(state.bypass);
    }
  }
  
  // ===========================================================================
  // Audio Connections
  // ===========================================================================
  
  public get input(): AudioNode {
    return this.inputNode;
  }
  
  public get output(): AudioNode {
    return this.outputNode;
  }
  
  public connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }
  
  public disconnect(destination?: AudioNode): void {
    if (destination) {
      this.outputNode.disconnect(destination);
    } else {
      this.outputNode.disconnect();
    }
  }
  
  // ===========================================================================
  // Cleanup
  // ===========================================================================
  
  public dispose(): void {
    this.inputNode.disconnect();
    this.lowShelfFilter.disconnect();
    this.midPeakFilter.disconnect();
    this.highShelfFilter.disconnect();
    this.outputNode.disconnect();
    this.bypassNode.disconnect();
  }
}

// =============================================================================
// Presets
// =============================================================================

export const EQ_PRESETS = {
  flat: {
    lowShelf: { frequency: 250, gain: 0, Q: 0.707 },
    midPeak: { frequency: 1000, gain: 0, Q: 1.0 },
    highShelf: { frequency: 4000, gain: 0, Q: 0.707 },
  },
  'bass-boost': {
    lowShelf: { frequency: 250, gain: 6, Q: 0.707 },
    midPeak: { frequency: 1000, gain: 0, Q: 1.0 },
    highShelf: { frequency: 4000, gain: 0, Q: 0.707 },
  },
  'vocal-clarity': {
    lowShelf: { frequency: 250, gain: -2, Q: 0.707 },
    midPeak: { frequency: 2500, gain: 4, Q: 1.5 },
    highShelf: { frequency: 6000, gain: 3, Q: 0.707 },
  },
  'brightness': {
    lowShelf: { frequency: 250, gain: 0, Q: 0.707 },
    midPeak: { frequency: 3000, gain: 2, Q: 1.2 },
    highShelf: { frequency: 6000, gain: 4, Q: 0.707 },
  },
  warmth: {
    lowShelf: { frequency: 200, gain: 3, Q: 0.707 },
    midPeak: { frequency: 800, gain: -1, Q: 0.8 },
    highShelf: { frequency: 4000, gain: 0, Q: 0.707 },
  },
  'telephone': {
    lowShelf: { frequency: 800, gain: -30, Q: 0.707 },
    midPeak: { frequency: 1500, gain: 0, Q: 1.0 },
    highShelf: { frequency: 3000, gain: -30, Q: 0.707 },
  },
} as const;

// =============================================================================
// Factory Functions
// =============================================================================

export function createEQPlugin(
  audioContext: AudioContext,
  options?: EQOptions
): EQPlugin {
  return new EQPlugin(audioContext, options);
}

export default EQPlugin;
