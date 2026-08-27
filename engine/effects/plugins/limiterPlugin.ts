/**
 * LimiterPlugin - Brick-Wall Limiter
 *
 * Prevents the signal from exceeding a set ceiling.
 * Uses lookahead for transparent limiting without clipping.
 *
 * Signal Flow:
 * Input → Lookahead Delay → Compressor (Infinity:1) → Ceiling Gain → Output
 *                ↑
 *          (peak detection)
 */
import {
  LIMITER_MODES, limiterProfile, limiterKnee, clipCurve, effectiveRelease,
} from '../../../lib/limiterModes';


export interface LimiterParameters {
  /**
   * dB. The highest level allowed out — Logic calls this Output Level.
   *
   * The range was -0.3 to 0, which made the knob in the panel almost
   * unusable; the reference runs it from -10 to +1.
   */
  ceiling: number;
  /** Seconds. 2 ms to 2 s, as the panel's scale reads. */
  release: number;
  /** ms of lookahead, 0 to 10. */
  lookahead: number;
  /** dB of gain into the limiter — how hard it is driven. */
  gain: number;
  /** Legacy or Precision. See `lib/limiterModes`. */
  mode: string;
  /** Rounds the corner where limiting begins. */
  softKnee: boolean;
}

export interface LimiterOptions {
  ceiling?: number;
  release?: number;
  lookahead?: number;
}

const DEFAULT_PARAMS: LimiterParameters = {
  ceiling: -0.3,
  release: 0.1,
  lookahead: 1,
  gain: 0,
  mode: 'legacy',
  softKnee: true,
};

export class LimiterPlugin {
  private ctx: AudioContext;
  private params: LimiterParameters;

  // Nodes
  private inputNode: GainNode;
  private outputNode: GainNode;
  private lookaheadDelay: DelayNode;
  private compressor: DynamicsCompressorNode;
  private ceilingGain: GainNode;
  private gainNode: GainNode;
  private clipper: WaveShaperNode;
  private inputSplitter: ChannelSplitterNode;
  private outputSplitter: ChannelSplitterNode;
  private inputAnalysers: AnalyserNode[];
  private outputAnalysers: AnalyserNode[];
  private meterBuffer: Float32Array<ArrayBuffer>;
  private bypassNode: GainNode;
  private isBypassed = false;

  // Metering
  private gainReduction = 0;

  private readonly SMOOTHING_TIME = 0.01;

  constructor(ctx: AudioContext, options: LimiterOptions = {}) {
    this.ctx = ctx;
    this.params = {
      ceiling: options.ceiling ?? DEFAULT_PARAMS.ceiling,
      release: options.release ?? DEFAULT_PARAMS.release,
      lookahead: options.lookahead ?? DEFAULT_PARAMS.lookahead,
      gain: 0,
      mode: 'legacy',
      softKnee: true,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.bypassNode = ctx.createGain();
    this.bypassNode.gain.value = 0;

    // Lookahead delay
    this.lookaheadDelay = ctx.createDelay(0.01);
    this.lookaheadDelay.delayTime.value = this.params.lookahead / 1000;

    // Limiter (compressor with Infinity:1 ratio)
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = this.params.ceiling;
    this.compressor.ratio.value = 20; // Near-infinity ratio
    this.compressor.attack.value = 0.001;
    this.compressor.release.value = this.params.release;
    this.compressor.knee.value = 0;

    // Ceiling gain.
    //
    // Held at unity. It used to be set to `dbToGain(ceiling)`, which scaled
    // the output down by the ceiling on top of the compressor already
    // thresholding there — the same figure applied twice, so a -3 dB ceiling
    // came out at -6.
    this.ceilingGain = ctx.createGain();
    this.ceilingGain.gain.value = 1;

    // Drive into the limiter.
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.dbToGain(this.params.gain);

    // Precision mode's brickwall. A DynamicsCompressorNode at 20:1 is not one:
    // a transient shorter than its attack passes straight through.
    this.clipper = ctx.createWaveShaper();
    this.clipper.curve = clipCurve(this.params.ceiling);
    this.clipper.oversample = '4x';

    // Metering. The panel shows input, reduction and output, per channel.
    this.inputAnalysers = [ctx.createAnalyser(), ctx.createAnalyser()];
    this.outputAnalysers = [ctx.createAnalyser(), ctx.createAnalyser()];
    this.inputSplitter = ctx.createChannelSplitter(2);
    this.outputSplitter = ctx.createChannelSplitter(2);
    for (const a of [...this.inputAnalysers, ...this.outputAnalysers]) a.fftSize = 1024;
    this.meterBuffer = new Float32Array(new ArrayBuffer(1024 * 4));

    this.buildGraph();
    this.applyMode();
  }

  private buildGraph(): void {
    // in → gain → [meter] → lookahead → limiter → clipper → ceiling → [meter] → out
    this.inputNode.connect(this.gainNode);
    this.gainNode.connect(this.inputSplitter);
    this.inputSplitter.connect(this.inputAnalysers[0], 0);
    this.inputSplitter.connect(this.inputAnalysers[1], 1);

    this.gainNode.connect(this.lookaheadDelay);
    this.lookaheadDelay.connect(this.compressor);
    this.compressor.connect(this.clipper);
    this.clipper.connect(this.ceilingGain);
    this.ceilingGain.connect(this.outputNode);

    this.ceilingGain.connect(this.outputSplitter);
    this.outputSplitter.connect(this.outputAnalysers[0], 0);
    this.outputSplitter.connect(this.outputAnalysers[1], 1);

    // Bypass
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);
  }

  // ===========================================================================
  // Parameters
  // ===========================================================================

  public setCeiling(db: number): void {
    this.params.ceiling = Math.max(-30, Math.min(1, db));
    this.compressor.threshold.setTargetAtTime(
      Math.min(0, this.params.ceiling),
      this.ctx.currentTime,
      this.SMOOTHING_TIME
    );
    // The threshold does the limiting; the clipper enforces it in Precision.
    // The output stage stays at unity so the ceiling is applied once.
    this.clipper.curve = clipCurve(this.params.ceiling);
  }

  public getCeiling(): number { return this.params.ceiling; }

  public setRelease(seconds: number): void {
    this.params.release = Math.max(0.002, Math.min(2, seconds));
    this.compressor.release.setTargetAtTime(
      effectiveRelease(this.params.release, this.params.mode),
      this.ctx.currentTime,
      this.SMOOTHING_TIME
    );
  }

  public getRelease(): number { return this.params.release; }

  public setLookahead(ms: number): void {
    this.params.lookahead = Math.max(0, Math.min(10, ms));
    this.lookaheadDelay.delayTime.setTargetAtTime(
      this.params.lookahead / 1000,
      this.ctx.currentTime,
      this.SMOOTHING_TIME
    );
  }

  public getLookahead(): number { return this.params.lookahead; }

  // ===========================================================================
  // Metering
  // ===========================================================================

  public getReduction(): number {
    return this.compressor.reduction as unknown as number;
  }

  public setGain(db: number): void {
    this.params.gain = Math.max(-20, Math.min(20, db));
    this.gainNode.gain.setTargetAtTime(
      this.dbToGain(this.params.gain), this.ctx.currentTime, this.SMOOTHING_TIME);
  }

  public setMode(mode: string): void {
    this.params.mode = mode;
    this.applyMode();
  }

  public setSoftKnee(soft: boolean): void {
    this.params.softKnee = soft;
    this.applyMode();
  }

  /** Push the mode's attack, release scaling, knee and clipper into place. */
  private applyMode(): void {
    const profile = limiterProfile(this.params.mode);
    const t = this.ctx.currentTime;
    this.compressor.attack.setTargetAtTime(profile.attack, t, this.SMOOTHING_TIME);
    this.compressor.release.setTargetAtTime(
      effectiveRelease(this.params.release, this.params.mode), t, this.SMOOTHING_TIME);
    this.compressor.knee.setTargetAtTime(limiterKnee(this.params.softKnee), t, this.SMOOTHING_TIME);
    // Legacy leaves the clipper transparent rather than unlinking it, so
    // switching modes does not relink a live graph.
    this.clipper.curve = profile.clip ? clipCurve(this.params.ceiling) : clipCurve(0);
  }

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
   * Input, reduction and output, per channel.
   *
   * The panel shows a stereo pair either side of a reduction meter, and
   * nothing measured any of it before.
   */
  public getMeterData(): {
    inputLeft: number; inputRight: number;
    outputLeft: number; outputRight: number;
    reduction: number;
  } {
    return {
      inputLeft: this.peakDb(this.inputAnalysers[0]),
      inputRight: this.peakDb(this.inputAnalysers[1]),
      outputLeft: this.peakDb(this.outputAnalysers[0]),
      outputRight: this.peakDb(this.outputAnalysers[1]),
      reduction: Math.abs(this.getReduction()),
    };
  }

  // ===========================================================================
  // Bypass
  // ===========================================================================

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    const t = this.ctx.currentTime;
    if (bypass) {
      this.bypassNode.gain.setTargetAtTime(1, t, this.SMOOTHING_TIME);
      this.ceilingGain.gain.setTargetAtTime(0, t, this.SMOOTHING_TIME);
    } else {
      this.bypassNode.gain.setTargetAtTime(0, t, this.SMOOTHING_TIME);
      this.ceilingGain.gain.setTargetAtTime(1, t, this.SMOOTHING_TIME);
    }
  }

  public isBypassedState(): boolean { return this.isBypassed; }

  // ===========================================================================
  // Presets
  // ===========================================================================

  public applyPreset(preset: keyof typeof LIMITER_PRESETS): void {
    const p = LIMITER_PRESETS[preset];
    if (!p) return;
    this.setCeiling(p.ceiling);
    this.setRelease(p.release);
    this.setLookahead(p.lookahead);
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): LimiterParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<LimiterParameters & { bypass: boolean }>): void {
    if (state.gain !== undefined) this.setGain(Number(state.gain));
    if (state.ceiling !== undefined) this.setCeiling(state.ceiling);
    if (state.release !== undefined) this.setRelease(state.release);
    if (state.lookahead !== undefined) this.setLookahead(state.lookahead);
    if (state.softKnee !== undefined) this.setSoftKnee(!!state.softKnee);
    if (state.mode !== undefined) {
      // The panel writes an index, because automation carries only numbers;
      // a saved project holds the name.
      this.setMode(typeof state.mode === 'number'
        ? (LIMITER_MODES[Math.round(state.mode)]?.id ?? 'legacy')
        : String(state.mode));
    }
    if (state.bypass !== undefined) this.setBypass(state.bypass);
  }

  // ===========================================================================
  // Connections
  // ===========================================================================

  public get input(): AudioNode { return this.inputNode; }
  public get output(): AudioNode { return this.outputNode; }
  public connect(dest: AudioNode): void { this.outputNode.connect(dest); }
  public disconnect(dest?: AudioNode): void {
    dest ? this.outputNode.disconnect(dest) : this.outputNode.disconnect();
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  private dbToGain(db: number): number {
    if (db <= -60) return 0;
    return Math.pow(10, db / 20);
  }

  public dispose(): void {
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.lookaheadDelay.disconnect();
    this.compressor.disconnect();
    this.ceilingGain.disconnect();
    this.bypassNode.disconnect();
  }
}


// =============================================================================
// Presets
// =============================================================================

export const LIMITER_PRESETS: Record<string, LimiterParameters> = {
  transparent: { ceiling: -0.3, release: 0.1, lookahead: 2, gain: 0, mode: 'legacy', softKnee: true },
  aggressive: { ceiling: -0.1, release: 0.05, lookahead: 0.5, gain: 0, mode: 'legacy', softKnee: true },
  mastering: { ceiling: -0.3, release: 0.15, lookahead: 3, gain: 0, mode: 'legacy', softKnee: true },
  broadcast: { ceiling: -1.0, release: 0.1, lookahead: 1, gain: 0, mode: 'legacy', softKnee: true },
  protective: { ceiling: -3.0, release: 0.2, lookahead: 5, gain: 0, mode: 'legacy', softKnee: true },
};

export function createLimiterPlugin(ctx: AudioContext, options?: LimiterOptions): LimiterPlugin {
  return new LimiterPlugin(ctx, options);
}

export default LimiterPlugin;
