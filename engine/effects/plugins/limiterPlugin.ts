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

export interface LimiterParameters {
  ceiling: number;      // dB (-0.3 to 0) — maximum output level
  release: number;      // seconds (0.01 - 1) — release time
  lookahead: number;    // ms (0 - 5) — lookahead time
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

    // Ceiling gain
    this.ceilingGain = ctx.createGain();
    this.ceilingGain.gain.value = this.dbToGain(this.params.ceiling);

    this.buildGraph();
  }

  private buildGraph(): void {
    // Main path: input → lookahead → compressor → ceiling gain → output
    this.inputNode.connect(this.lookaheadDelay);
    this.lookaheadDelay.connect(this.compressor);
    this.compressor.connect(this.ceilingGain);
    this.ceilingGain.connect(this.outputNode);

    // Bypass
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);
  }

  // ===========================================================================
  // Parameters
  // ===========================================================================

  public setCeiling(db: number): void {
    this.params.ceiling = Math.max(-0.3, Math.min(0, db));
    this.compressor.threshold.setTargetAtTime(
      this.params.ceiling,
      this.ctx.currentTime,
      this.SMOOTHING_TIME
    );
    this.ceilingGain.gain.setTargetAtTime(
      this.dbToGain(this.params.ceiling),
      this.ctx.currentTime,
      this.SMOOTHING_TIME
    );
  }

  public getCeiling(): number { return this.params.ceiling; }

  public setRelease(seconds: number): void {
    this.params.release = Math.max(0.01, Math.min(1, seconds));
    this.compressor.release.setTargetAtTime(
      this.params.release,
      this.ctx.currentTime,
      this.SMOOTHING_TIME
    );
  }

  public getRelease(): number { return this.params.release; }

  public setLookahead(ms: number): void {
    this.params.lookahead = Math.max(0, Math.min(5, ms));
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
      this.ceilingGain.gain.setTargetAtTime(
        this.dbToGain(this.params.ceiling),
        t,
        this.SMOOTHING_TIME
      );
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
    if (state.ceiling !== undefined) this.setCeiling(state.ceiling);
    if (state.release !== undefined) this.setRelease(state.release);
    if (state.lookahead !== undefined) this.setLookahead(state.lookahead);
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
  transparent: { ceiling: -0.3, release: 0.1, lookahead: 2 },
  aggressive: { ceiling: -0.1, release: 0.05, lookahead: 0.5 },
  mastering: { ceiling: -0.3, release: 0.15, lookahead: 3 },
  broadcast: { ceiling: -1.0, release: 0.1, lookahead: 1 },
  protective: { ceiling: -3.0, release: 0.2, lookahead: 5 },
};

export function createLimiterPlugin(ctx: AudioContext, options?: LimiterOptions): LimiterPlugin {
  return new LimiterPlugin(ctx, options);
}

export default LimiterPlugin;
