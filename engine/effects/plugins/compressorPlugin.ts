/**
 * CompressorPlugin - Professional Dynamics Compressor
 * 
 * Features:
 * - Threshold: Level where compression begins (-60 to 0 dB)
 * - Ratio: Compression ratio (1:1 to 20:1)
 * - Attack: Response time (0 to 1 second)
 * - Release: Recovery time (0 to 1 second)
 * - Knee: Transition smoothness (0 to 40 dB)
 * - Makeup Gain: Output compensation (-20 to +20 dB)
 * 
 * Uses Web Audio API DynamicsCompressorNode with added makeup gain stage.
 * Signal Flow:
 * Input → Compressor → Makeup Gain → Output
 */

import { modelProfile, autoMakeupDb, COMPRESSOR_MODELS } from '../../../lib/compressorCurve';

// =============================================================================
// Types
// =============================================================================

export type CompressorMode = 'VCA' | 'FET' | 'Opto';

export interface CompressorParameters {
  threshold: number;    // dB (-100 to 0)
  ratio: number;        // 1 to 20
  attack: number;       // seconds (0 to 1)
  release: number;      // seconds (0 to 1)
  knee: number;         // dB (0 to 40)
  makeupGain: number;   // dB (-20 to +20)
  mode: CompressorMode; // Character mode
}

export interface CompressorState extends CompressorParameters {
  bypass: boolean;
  /** Which character model, from `lib/compressorCurve`. */
  model: string;
  /** dB of trim before the detector — it changes how hard the unit works. */
  inputGain: number;
  /** dB of trim on the way out, after everything else. */
  outputGain: number;
  /** 0-1 parallel blend. Below 1 the uncompressed signal comes back in. */
  mix: number;
  /** Brickwall after the compressor. */
  limiterOn: boolean;
  limiterThreshold: number;
  /** 0-1 drive into the waveshaper, on top of the model's own character. */
  distortion: number;
  /** How the waveshaper bends: rounded, or straight into a clip. */
  distortionHard: boolean;
  /** Makeup the unit works out for itself: off, to 0 dBFS, or to -12. */
  autoGain: 'off' | '0db' | '-12db';
}

export interface CompressorOptions {
  threshold?: number;
  ratio?: number;
  attack?: number;
  release?: number;
  knee?: number;
  makeupGain?: number;
  mode?: CompressorMode;
}

export interface CompressorReduction {
  reduction: number;      // Current gain reduction in dB
  inputLevel: number;     // Current input level in dB
  outputLevel: number;    // Current output level in dB
}

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_PARAMS: CompressorParameters = {
  threshold: -24,
  ratio: 4,
  attack: 0.01,      // 10ms
  release: 0.1,      // 100ms
  knee: 6,
  makeupGain: 6,
  mode: 'VCA',
};

// Mode-specific character profiles
const MODE_PROFILES: Record<CompressorMode, {
  attackRange: [number, number];
  releaseRange: [number, number];
  kneeDefault: number;
  saturationDrive: number;
  autoMakeup: boolean;
}> = {
  VCA: {
    attackRange: [0.001, 0.1],
    releaseRange: [0.01, 0.5],
    kneeDefault: 6,
    saturationDrive: 1.0,    // Clean
    autoMakeup: false,
  },
  FET: {
    attackRange: [0.0001, 0.01],
    releaseRange: [0.01, 0.3],
    kneeDefault: 3,
    saturationDrive: 1.5,    // Aggressive, warm
    autoMakeup: false,
  },
  Opto: {
    attackRange: [0.01, 0.3],
    releaseRange: [0.1, 1.0],
    kneeDefault: 12,
    saturationDrive: 1.1,    // Smooth
    autoMakeup: true,         // Program-dependent makeup
  },
};

// =============================================================================
// CompressorPlugin Class
// =============================================================================

export class CompressorPlugin {
  private audioContext: AudioContext;
  private compressor!: DynamicsCompressorNode;
  private makeupGainNode!: GainNode;
  private saturationNode!: WaveShaperNode;
  private trimIn!: GainNode;
  private trimOut!: GainNode;
  private limiterNode!: DynamicsCompressorNode;
  private wetNode!: GainNode;
  private dryNode!: GainNode;
  private inputAnalyser!: AnalyserNode;
  private outputAnalyser!: AnalyserNode;
  private meterBuffer!: Float32Array<ArrayBuffer>;
  /** Everything the editor shows beyond the three original knobs. */
  private extras = {
    model: 'platinum',
    inputGain: 0,
    outputGain: 0,
    mix: 1,
    limiterOn: false,
    limiterThreshold: -3,
    distortion: 0,
    distortionHard: false,
    autoGain: 'off' as 'off' | '0db' | '-12db',
  };
  private inputNode!: GainNode;
  private outputNode!: GainNode;
  private bypassNode!: GainNode;
  
  // State
  private params: CompressorParameters;
  private isBypassed: boolean = false;
  
  // Smoothing
  private readonly SMOOTHING_TIME = 0.01;
  
  constructor(audioContext: AudioContext, options: CompressorOptions = {}) {
    this.audioContext = audioContext;
    
    this.params = {
      threshold: options.threshold ?? DEFAULT_PARAMS.threshold,
      ratio: options.ratio ?? DEFAULT_PARAMS.ratio,
      attack: options.attack ?? DEFAULT_PARAMS.attack,
      release: options.release ?? DEFAULT_PARAMS.release,
      knee: options.knee ?? DEFAULT_PARAMS.knee,
      makeupGain: options.makeupGain ?? DEFAULT_PARAMS.makeupGain,
      mode: options.mode ?? DEFAULT_PARAMS.mode,
    };
    
    this.createAudioGraph();
  }
  
  // ===========================================================================
  // Audio Graph Construction
  // ===========================================================================
  
  private createAudioGraph(): void {
    const ctx = this.audioContext;
    
    // Input/output
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.bypassNode = ctx.createGain();
    this.bypassNode.gain.value = 0;
    
    // Compressor
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = this.params.threshold;
    this.compressor.ratio.value = this.params.ratio;
    this.compressor.attack.value = this.params.attack;
    this.compressor.release.value = this.params.release;
    this.compressor.knee.value = this.params.knee;
    
    // Saturation (for FET mode warmth)
    this.saturationNode = ctx.createWaveShaper();
    this.saturationNode.curve = this.makeSaturationCurve(MODE_PROFILES[this.params.mode].saturationDrive);
    this.saturationNode.oversample = '4x';
    
    // Makeup gain
    this.makeupGainNode = ctx.createGain();
    this.makeupGainNode.gain.value = this.dbToGain(this.params.makeupGain);
    
    // Chain: input → compressor → saturation → makeup gain → output
    // The stages the editor exposes, in the order a hardware unit has them.
    this.trimIn = ctx.createGain();
    this.trimOut = ctx.createGain();
    this.wetNode = ctx.createGain();
    this.dryNode = ctx.createGain();
    this.dryNode.gain.value = 0;

    // A limiter is a compressor with a huge ratio and no attack to speak of.
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = this.extras.limiterThreshold;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.knee.value = 0;
    this.limiterNode.attack.value = 0.001;
    this.limiterNode.release.value = 0.05;

    // Metering, so the editor's meters read the signal rather than a guess.
    this.inputAnalyser = ctx.createAnalyser();
    this.outputAnalyser = ctx.createAnalyser();
    this.inputAnalyser.fftSize = 1024;
    this.outputAnalyser.fftSize = 1024;
    this.meterBuffer = new Float32Array(new ArrayBuffer(1024 * 4));

    // Chain: in → trim → [meter] → comp → saturation → makeup → limiter
    //           → out trim → [meter] → wet ┐
    //        └───────────────────────  dry ┴→ out
    this.inputNode.connect(this.trimIn);
    this.trimIn.connect(this.inputAnalyser);
    this.trimIn.connect(this.compressor);
    this.compressor.connect(this.saturationNode);
    this.saturationNode.connect(this.makeupGainNode);
    this.makeupGainNode.connect(this.limiterNode);
    this.limiterNode.connect(this.trimOut);
    this.trimOut.connect(this.outputAnalyser);
    this.trimOut.connect(this.wetNode);
    this.wetNode.connect(this.outputNode);

    // The dry path taps ahead of the input trim, so Mix blends the signal as
    // it arrived — parallel compression, not a trimmed copy.
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);

    // The bypass edge below is untouched.
    
    // Bypass: input → bypassNode → output
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);
  }
  
  /**
   * The waveshaper's transfer curve.
   *
   * `hard` is the editor's Soft/Hard switch: soft rounds the peaks over, hard
   * runs straight until it hits the ceiling and stops, which is the difference
   * between saturation and clipping.
   */
  private makeSaturationCurve(drive: number, hard = false): Float32Array<ArrayBuffer> {
    // 8192 points is plenty for a smooth curve and builds in under a
    // millisecond; 44100 rebuilt on every knob turn was the expensive part.
    const samples = 8192;
    const curve: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(samples * 4));
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / (samples - 1) - 1;
      if (hard) {
        // Straight through, then flat. The ceiling closes as drive rises.
        const ceiling = 1 / (1 + drive * 0.5);
        curve[i] = Math.max(-1, Math.min(1, x / ceiling));
      } else {
        curve[i] = ((3 + drive) * x * 20 * deg) / (Math.PI + drive * Math.abs(x));
      }
    }

    return curve;
  }
  
  // ===========================================================================
  // Parameter Control
  // ===========================================================================
  
  /**
   * Set threshold in dB (-100 to 0)
   */
  public setThreshold(db: number): void {
    this.params.threshold = Math.max(-100, Math.min(0, db));
    this.compressor.threshold.setTargetAtTime(
      this.params.threshold,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  public getThreshold(): number {
    return this.params.threshold;
  }
  
  /**
   * Set compression ratio (1 to 20)
   */
  public setRatio(ratio: number): void {
    this.params.ratio = Math.max(1, Math.min(20, ratio));
    this.compressor.ratio.setTargetAtTime(
      this.params.ratio,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  public getRatio(): number {
    return this.params.ratio;
  }
  
  /**
   * Set attack time in seconds (0 to 1)
   */
  public setAttack(seconds: number): void {
    this.params.attack = Math.max(0, Math.min(1, seconds));
    this.compressor.attack.setTargetAtTime(
      this.params.attack,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  public getAttack(): number {
    return this.params.attack;
  }
  
  /**
   * Set release time in seconds (0 to 1)
   */
  public setRelease(seconds: number): void {
    this.params.release = Math.max(0, Math.min(1, seconds));
    this.compressor.release.setTargetAtTime(
      this.params.release,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  public getRelease(): number {
    return this.params.release;
  }
  
  /**
   * Set knee width in dB (0 to 40)
   */
  public setKnee(db: number): void {
    this.params.knee = Math.max(0, Math.min(40, db));
    this.compressor.knee.setTargetAtTime(
      this.params.knee,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  public getKnee(): number {
    return this.params.knee;
  }
  
  /**
   * Set makeup gain in dB (-20 to +20)
   */
  public setMakeupGain(db: number): void {
    this.params.makeupGain = Math.max(-20, Math.min(20, db));
    const gain = this.dbToGain(this.params.makeupGain);
    
    this.makeupGainNode.gain.setTargetAtTime(
      gain,
      this.audioContext.currentTime,
      this.SMOOTHING_TIME
    );
  }
  
  public getMakeupGain(): number {
    return this.params.makeupGain;
  }
  
  /**
   * Set compressor mode (VCA/FET/Opto)
   */
  public setMode(mode: CompressorMode): void {
    this.params.mode = mode;
    const profile = MODE_PROFILES[mode];
    
    // Update saturation curve
    this.saturationNode.curve = this.makeSaturationCurve(profile.saturationDrive);
    
    // Apply mode-specific defaults if knee was at default
    if (this.params.knee === MODE_PROFILES[this.params.mode].kneeDefault) {
      this.setKnee(profile.kneeDefault);
    }
  }
  
  public getMode(): CompressorMode {
    return this.params.mode;
  }
  
  // ===========================================================================
  // Metering
  // ===========================================================================
  
  /**
   * Get current gain reduction in dB
   * Returns negative value when compressing (e.g., -6 means 6dB reduction)
   */
  public getReduction(): number {
    return (this.compressor.reduction as any).value ?? this.compressor.reduction;
  }
  
  /**
   * Get full metering data
   */
  /** Peak of one analyser read, as dBFS. */
  private peakDb(analyser: AnalyserNode): number {
    analyser.getFloatTimeDomainData(this.meterBuffer);
    let peak = 0;
    for (let i = 0; i < this.meterBuffer.length; i++) {
      const value = Math.abs(this.meterBuffer[i]);
      if (value > peak) peak = value;
    }
    return peak > 0 ? Math.max(-60, 20 * Math.log10(peak)) : -60;
  }

  /**
   * Input level, output level and gain reduction, all measured.
   *
   * The input and output figures used to be `0` with a comment saying they
   * would need analysers. The editor's two meters had nothing to show.
   */
  public getMeterData(): CompressorReduction {
    return {
      reduction: this.getReduction(),
      inputLevel: this.peakDb(this.inputAnalyser),
      outputLevel: this.peakDb(this.outputAnalyser),
    };
  }
  
  // ===========================================================================
  // Bypass
  // ===========================================================================
  
  /**
   * Toggle compressor bypass
   */
  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    const currentTime = this.audioContext.currentTime;
    
    if (bypass) {
      // Enable bypass path, compressor output muted. The dry path is muted
      // too: with Mix below 1 it would otherwise add a second copy of the
      // signal on top of the bypass.
      this.bypassNode.gain.setTargetAtTime(1, currentTime, this.SMOOTHING_TIME);
      this.makeupGainNode.gain.setTargetAtTime(0, currentTime, this.SMOOTHING_TIME);
      this.dryNode.gain.setTargetAtTime(0, currentTime, this.SMOOTHING_TIME);
    } else {
      // Disable bypass, enable compressor
      this.bypassNode.gain.setTargetAtTime(0, currentTime, this.SMOOTHING_TIME);
      this.makeupGainNode.gain.setTargetAtTime(
        this.dbToGain(this.params.makeupGain),
        currentTime,
        this.SMOOTHING_TIME
      );
      this.applyExtras();
    }
  }
  
  public isBypassedState(): boolean {
    return this.isBypassed;
  }
  
  // ===========================================================================
  // Presets
  // ===========================================================================
  
  /**
   * Apply a preset
   */
  public applyPreset(preset: keyof typeof COMPRESSOR_PRESETS): void {
    const settings = COMPRESSOR_PRESETS[preset];
    if (!settings) return;
    
    this.setThreshold(settings.threshold);
    this.setRatio(settings.ratio);
    this.setAttack(settings.attack);
    this.setRelease(settings.release);
    this.setKnee(settings.knee);
    this.setMakeupGain(settings.makeupGain);
  }
  
  /**
   * Reset to default settings
   */
  public reset(): void {
    this.applyPreset('default');
  }
  
  // ===========================================================================
  // State Management
  // ===========================================================================
  
  public getState(): CompressorState {
    return {
      ...this.params,
      ...this.extras,
      bypass: this.isBypassed,
    };
  }
  
  public setState(state: Partial<CompressorState>): void {
    if (state.threshold !== undefined) this.setThreshold(state.threshold);
    if (state.ratio !== undefined) this.setRatio(state.ratio);
    if (state.attack !== undefined) this.setAttack(state.attack);
    if (state.release !== undefined) this.setRelease(state.release);
    if (state.knee !== undefined) this.setKnee(state.knee);
    if (state.makeupGain !== undefined) this.setMakeupGain(state.makeupGain);
    if (state.mode !== undefined) this.setMode(state.mode);

    // Everything the redesigned editor adds. Booleans arrive as 0/1 from
    // automation, which only carries numbers, so they are coerced rather than
    // compared against `true`.
    const e = this.extras;
    if (state.model !== undefined) {
      // The editor writes an index, because automation carries only numbers;
      // a saved project holds the id. Stringifying the index gave "6", which
      // matches no model, so every one of them fell back to Platinum and the
      // seven characters were identical.
      e.model = typeof state.model === 'number'
        ? (COMPRESSOR_MODELS[Math.round(state.model)]?.id ?? 'platinum')
        : String(state.model);
    }
    if (state.inputGain !== undefined) e.inputGain = Number(state.inputGain);
    if (state.outputGain !== undefined) e.outputGain = Number(state.outputGain);
    if (state.mix !== undefined) e.mix = Number(state.mix);
    if (state.limiterOn !== undefined) e.limiterOn = !!state.limiterOn;
    if (state.limiterThreshold !== undefined) e.limiterThreshold = Number(state.limiterThreshold);
    if (state.distortion !== undefined) e.distortion = Number(state.distortion);
    if (state.distortionHard !== undefined) e.distortionHard = !!state.distortionHard;
    if (state.autoGain !== undefined) {
      // The editor writes an index; a saved project may hold the name.
      const modes = ['off', '0db', '-12db'] as const;
      e.autoGain = typeof state.autoGain === 'number'
        ? (modes[Math.round(state.autoGain)] ?? 'off')
        : (state.autoGain as typeof e.autoGain);
    }
    this.applyExtras();

    if (state.bypass !== undefined) this.setBypass(state.bypass);
  }

  /**
   * Push the added stages to their nodes.
   *
   * Kept in one place so any of the eight can be written without the caller
   * having to know which node it lands on.
   */
  private applyExtras(): void {
    const now = this.audioContext.currentTime;
    const e = this.extras;
    const clamp = (v: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

    this.trimIn.gain.setTargetAtTime(
      this.dbToGain(clamp(e.inputGain, -30, 30)), now, this.SMOOTHING_TIME);

    // Auto Gain replaces the makeup knob when it is on; the model's own
    // character sets the rest.
    const profile = modelProfile(e.model);
    const auto = autoMakeupDb(e.autoGain, this.params.threshold, this.params.ratio, this.params.knee);
    const makeup = e.autoGain === 'off' ? this.params.makeupGain : auto;
    if (!this.isBypassed) {
      this.makeupGainNode.gain.setTargetAtTime(
        this.dbToGain(clamp(makeup, -30, 30)), now, this.SMOOTHING_TIME);
    }

    this.trimOut.gain.setTargetAtTime(
      this.dbToGain(clamp(e.outputGain, -30, 30)), now, this.SMOOTHING_TIME);

    // A limiter that is off is a threshold no signal can reach, rather than a
    // node unlinked from the chain — relinking a live graph clicks.
    this.limiterNode.threshold.setTargetAtTime(
      e.limiterOn ? clamp(e.limiterThreshold, -30, 0) : 0, now, this.SMOOTHING_TIME);
    this.limiterNode.ratio.setTargetAtTime(e.limiterOn ? 20 : 1, now, this.SMOOTHING_TIME);

    const wet = clamp(e.mix, 0, 1);
    this.wetNode.gain.setTargetAtTime(wet, now, this.SMOOTHING_TIME);
    this.dryNode.gain.setTargetAtTime(1 - wet, now, this.SMOOTHING_TIME);

    // Drive is the model's character plus whatever the knob adds.
    const drive = clamp(profile.drive + e.distortion * 3, 0, 4);
    this.saturationNode.curve = this.makeSaturationCurve(1 + drive, e.distortionHard);

    /*
     * The model bends the times the user dialled in.
     *
     * This is what makes an Opto feel slow and a FET instant at the same knob
     * setting — without it the seven models would differ only in saturation,
     * which is a colour, not a character.
     */
    this.compressor.attack.setTargetAtTime(
      clamp(this.params.attack * profile.attackScale, 0, 1), now, this.SMOOTHING_TIME);
    this.compressor.release.setTargetAtTime(
      clamp(this.params.release * profile.releaseScale, 0.001, 1), now, this.SMOOTHING_TIME);
    this.compressor.knee.setTargetAtTime(
      clamp(this.params.knee + profile.kneeBias, 0, 40), now, this.SMOOTHING_TIME);
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
  // Utility
  // ===========================================================================
  
  private dbToGain(db: number): number {
    if (db <= -60) return 0;
    return Math.pow(10, db / 20);
  }
  
  private gainToDb(gain: number): number {
    if (gain <= 0) return -Infinity;
    return 20 * Math.log10(gain);
  }
  
  // ===========================================================================
  // Cleanup
  // ===========================================================================
  
  public dispose(): void {
    this.inputNode.disconnect();
    this.compressor.disconnect();
    this.saturationNode.disconnect();
    this.makeupGainNode.disconnect();
    this.outputNode.disconnect();
    this.bypassNode.disconnect();
  }
}

// =============================================================================
// Presets
// =============================================================================

export const COMPRESSOR_PRESETS: Record<string, CompressorParameters> = {
  default: {
    threshold: -24,
    ratio: 4,
    attack: 0.01,
    release: 0.1,
    knee: 6,
    makeupGain: 6,
    mode: 'VCA',
  },
  'gentle-compression': {
    threshold: -18,
    ratio: 2,
    attack: 0.01,
    release: 0.2,
    knee: 12,
    makeupGain: 3,
    mode: 'VCA',
  },
  'heavy-compression': {
    threshold: -30,
    ratio: 10,
    attack: 0.005,
    release: 0.05,
    knee: 0,
    makeupGain: 10,
    mode: 'VCA',
  },
  'vocal-leveller': {
    threshold: -20,
    ratio: 3,
    attack: 0.02,
    release: 0.15,
    knee: 8,
    makeupGain: 4,
    mode: 'VCA',
  },
  'drum-transient': {
    threshold: -12,
    ratio: 6,
    attack: 0.001,
    release: 0.05,
    knee: 3,
    makeupGain: 6,
    mode: 'FET',
  },
  'bus-glue': {
    threshold: -16,
    ratio: 2.5,
    attack: 0.03,
    release: 0.3,
    knee: 10,
    makeupGain: 4,
    mode: 'VCA',
  },
  'limiting': {
    threshold: -8,
    ratio: 20,
    attack: 0.001,
    release: 0.1,
    knee: 0,
    makeupGain: 8,
    mode: 'VCA',
  },
  // FET mode presets (aggressive, fast, warm)
  'fet-vocal': {
    threshold: -18,
    ratio: 4,
    attack: 0.001,
    release: 0.05,
    knee: 3,
    makeupGain: 6,
    mode: 'FET',
  },
  'fet-drums': {
    threshold: -15,
    ratio: 8,
    attack: 0.0005,
    release: 0.03,
    knee: 2,
    makeupGain: 8,
    mode: 'FET',
  },
  // Opto mode presets (smooth, program-dependent)
  'opto-vocal': {
    threshold: -20,
    ratio: 3,
    attack: 0.05,
    release: 0.5,
    knee: 12,
    makeupGain: 5,
    mode: 'Opto',
  },
  'opto-bass': {
    threshold: -22,
    ratio: 4,
    attack: 0.03,
    release: 0.3,
    knee: 10,
    makeupGain: 4,
    mode: 'Opto',
  },
  'opto-mix': {
    threshold: -16,
    ratio: 2,
    attack: 0.02,
    release: 0.4,
    knee: 15,
    makeupGain: 3,
    mode: 'Opto',
  },
};

// =============================================================================
// Factory Functions
// =============================================================================

export function createCompressorPlugin(
  audioContext: AudioContext,
  options?: CompressorOptions
): CompressorPlugin {
  return new CompressorPlugin(audioContext, options);
}

export default CompressorPlugin;
