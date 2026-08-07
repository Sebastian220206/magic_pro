/**
 * DelayPlugin - Delay Effect with Feedback and Ping-Pong
 *
 * Features:
 * - Stereo delay with independent L/R times
 * - Feedback with high-frequency damping (tape-style)
 * - Ping-pong mode (alternating L/R)
 * - Sync to tempo (quarter, eighth, dotted, triplet)
 * - Modulation (chorus on delay tail)
 *
 * Signal Flow:
 * Input → Dry/Wet Split → [Delay + Feedback Loop] → Output
 */

export type DelaySync = 'none' | 'quarter' | 'eighth' | 'dotted' | 'triplet';

export interface DelayParameters {
  timeL: number;        // seconds (0 - 2)
  timeR: number;        // seconds (0 - 2)
  feedback: number;     // 0-1
  mix: number;          // 0-1 dry/wet
  damping: number;      // 0-1 high-frequency damping in feedback
  pingPong: boolean;    // alternating L/R
  sync: DelaySync;      // tempo sync mode
  modulation: number;   // 0-1 chorus depth on delay
  modRate: number;      // Hz modulation rate
}

export interface DelayOptions {
  timeL?: number;
  timeR?: number;
  feedback?: number;
  mix?: number;
  damping?: number;
  pingPong?: boolean;
  sync?: DelaySync;
  modulation?: number;
  modRate?: number;
}

const DEFAULT_PARAMS: DelayParameters = {
  timeL: 0.375,
  timeR: 0.375,
  feedback: 0.4,
  mix: 0.3,
  damping: 0.3,
  pingPong: false,
  sync: 'none',
  modulation: 0,
  modRate: 0.5,
};

export class DelayPlugin {
  private ctx: AudioContext;
  private params: DelayParameters;

  // Nodes
  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private bypassNode: GainNode;

  // Delay lines
  private delayL: DelayNode;
  private delayR: DelayNode;
  private feedbackL: GainNode;
  private feedbackR: GainNode;
  private dampingL: BiquadFilterNode;
  private dampingR: BiquadFilterNode;

  // Ping-pong crossfeed
  private crossfeedL2R: GainNode;
  private crossfeedR2L: GainNode;

  // Modulation
  private modOsc: OscillatorNode;
  private modGainL: GainNode;
  private modGainR: GainNode;

  private isBypassed = false;
  private readonly SMOOTHING_TIME = 0.01;

  constructor(ctx: AudioContext, options: DelayOptions = {}) {
    this.ctx = ctx;
    this.params = {
      timeL: options.timeL ?? DEFAULT_PARAMS.timeL,
      timeR: options.timeR ?? DEFAULT_PARAMS.timeR,
      feedback: options.feedback ?? DEFAULT_PARAMS.feedback,
      mix: options.mix ?? DEFAULT_PARAMS.mix,
      damping: options.damping ?? DEFAULT_PARAMS.damping,
      pingPong: options.pingPong ?? DEFAULT_PARAMS.pingPong,
      sync: options.sync ?? DEFAULT_PARAMS.sync,
      modulation: options.modulation ?? DEFAULT_PARAMS.modulation,
      modRate: options.modRate ?? DEFAULT_PARAMS.modRate,
    };

    // Create nodes
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.bypassNode = ctx.createGain();
    this.bypassNode.gain.value = 0;

    this.delayL = ctx.createDelay(2);
    this.delayR = ctx.createDelay(2);
    this.feedbackL = ctx.createGain();
    this.feedbackR = ctx.createGain();
    this.dampingL = ctx.createBiquadFilter();
    this.dampingR = ctx.createBiquadFilter();
    this.crossfeedL2R = ctx.createGain();
    this.crossfeedR2L = ctx.createGain();

    // Modulation LFO
    this.modOsc = ctx.createOscillator();
    this.modGainL = ctx.createGain();
    this.modGainR = ctx.createGain();

    this.buildGraph();
    this.applyParams();
  }

  private buildGraph(): void {
    const ctx = this.ctx;

    // Dry path
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // Wet path: input → delay L/R
    this.inputNode.connect(this.delayL);
    this.inputNode.connect(this.delayR);

    // Feedback loop with damping
    this.dampingL.type = 'lowpass';
    this.dampingR.type = 'lowpass';
    this.dampingL.frequency.value = 4000;
    this.dampingR.frequency.value = 4000;

    // L channel feedback
    this.delayL.connect(this.dampingL);
    this.dampingL.connect(this.feedbackL);
    this.feedbackL.connect(this.delayL);

    // R channel feedback
    this.delayR.connect(this.dampingR);
    this.dampingR.connect(this.feedbackR);
    this.feedbackR.connect(this.delayR);

    // Crossfeed for ping-pong
    this.delayL.connect(this.crossfeedL2R);
    this.crossfeedL2R.connect(this.delayR);
    this.delayR.connect(this.crossfeedR2L);
    this.crossfeedR2L.connect(this.delayL);

    // Modulation
    this.modOsc.type = 'sine';
    this.modOsc.frequency.value = this.params.modRate;
    this.modOsc.connect(this.modGainL);
    this.modOsc.connect(this.modGainR);
    this.modGainL.connect(this.delayL.delayTime);
    this.modGainR.connect(this.delayR.delayTime);
    this.modOsc.start();

    // Output: sum L+R to wet gain
    this.delayL.connect(this.wetGain);
    this.delayR.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    // Bypass
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);
  }

  private applyParams(): void {
    const t = this.ctx.currentTime;

    this.delayL.delayTime.setTargetAtTime(this.params.timeL, t, this.SMOOTHING_TIME);
    this.delayR.delayTime.setTargetAtTime(this.params.timeR, t, this.SMOOTHING_TIME);

    this.feedbackL.gain.setTargetAtTime(this.params.feedback, t, this.SMOOTHING_TIME);
    this.feedbackR.gain.setTargetAtTime(this.params.feedback, t, this.SMOOTHING_TIME);

    this.dryGain.gain.setTargetAtTime(1 - this.params.mix, t, this.SMOOTHING_TIME);
    this.wetGain.gain.setTargetAtTime(this.params.mix, t, this.SMOOTHING_TIME);

    // Damping: reduce cutoff as damping increases
    const cutoff = 20000 * (1 - this.params.damping * 0.9);
    this.dampingL.frequency.setTargetAtTime(cutoff, t, this.SMOOTHING_TIME);
    this.dampingR.frequency.setTargetAtTime(cutoff, t, this.SMOOTHING_TIME);

    // Crossfeed
    const cross = this.params.pingPong ? 0.5 : 0;
    this.crossfeedL2R.gain.setTargetAtTime(cross, t, this.SMOOTHING_TIME);
    this.crossfeedR2L.gain.setTargetAtTime(cross, t, this.SMOOTHING_TIME);

    // Modulation
    const modDepth = this.params.modulation * 0.005;
    this.modGainL.gain.setTargetAtTime(modDepth, t, this.SMOOTHING_TIME);
    this.modGainR.gain.setTargetAtTime(-modDepth, t, this.SMOOTHING_TIME);
    this.modOsc.frequency.setTargetAtTime(this.params.modRate, t, this.SMOOTHING_TIME);
  }

  // ===========================================================================
  // Parameters
  // ===========================================================================

  public setTimeL(seconds: number): void {
    this.params.timeL = Math.max(0, Math.min(2, seconds));
    this.delayL.delayTime.setTargetAtTime(this.params.timeL, this.ctx.currentTime, this.SMOOTHING_TIME);
  }

  public getTimeL(): number { return this.params.timeL; }

  public setTimeR(seconds: number): void {
    this.params.timeR = Math.max(0, Math.min(2, seconds));
    this.delayR.delayTime.setTargetAtTime(this.params.timeR, this.ctx.currentTime, this.SMOOTHING_TIME);
  }

  public getTimeR(): number { return this.params.timeR; }

  public setFeedback(value: number): void {
    this.params.feedback = Math.max(0, Math.min(0.95, value));
    this.applyParams();
  }

  public getFeedback(): number { return this.params.feedback; }

  public setMix(value: number): void {
    this.params.mix = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getMix(): number { return this.params.mix; }

  public setDamping(value: number): void {
    this.params.damping = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getDamping(): number { return this.params.damping; }

  public setPingPong(enabled: boolean): void {
    this.params.pingPong = enabled;
    this.applyParams();
  }

  public getPingPong(): boolean { return this.params.pingPong; }

  public setSync(sync: DelaySync, bpm: number = 120): void {
    this.params.sync = sync;
    if (sync !== 'none') {
      const beatDuration = 60 / bpm;
      let time = beatDuration;
      switch (sync) {
        case 'quarter': time = beatDuration; break;
        case 'eighth': time = beatDuration / 2; break;
        case 'dotted': time = beatDuration * 1.5; break;
        case 'triplet': time = beatDuration / 3; break;
      }
      this.setTimeL(time);
      this.setTimeR(time);
    }
  }

  public setModulation(depth: number): void {
    this.params.modulation = Math.max(0, Math.min(1, depth));
    this.applyParams();
  }

  public setModRate(hz: number): void {
    this.params.modRate = Math.max(0.1, Math.min(10, hz));
    this.applyParams();
  }

  // ===========================================================================
  // Bypass
  // ===========================================================================

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    const t = this.ctx.currentTime;
    if (bypass) {
      this.bypassNode.gain.setTargetAtTime(1, t, this.SMOOTHING_TIME);
      this.dryGain.gain.setTargetAtTime(0, t, this.SMOOTHING_TIME);
      this.wetGain.gain.setTargetAtTime(0, t, this.SMOOTHING_TIME);
    } else {
      this.bypassNode.gain.setTargetAtTime(0, t, this.SMOOTHING_TIME);
      this.applyParams();
    }
  }

  // ===========================================================================
  // Presets
  // ===========================================================================

  public applyPreset(preset: keyof typeof DELAY_PRESETS): void {
    const p = DELAY_PRESETS[preset];
    if (!p) return;
    this.setTimeL(p.timeL);
    this.setTimeR(p.timeR);
    this.setFeedback(p.feedback);
    this.setMix(p.mix);
    this.setDamping(p.damping);
    this.setPingPong(p.pingPong);
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): DelayParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<DelayParameters & { bypass: boolean }>): void {
    if (state.timeL !== undefined) this.setTimeL(state.timeL);
    if (state.timeR !== undefined) this.setTimeR(state.timeR);
    if (state.feedback !== undefined) this.setFeedback(state.feedback);
    if (state.mix !== undefined) this.setMix(state.mix);
    if (state.damping !== undefined) this.setDamping(state.damping);
    if (state.pingPong !== undefined) this.setPingPong(state.pingPong);
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

  public dispose(): void {
    this.modOsc.stop();
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.delayL.disconnect();
    this.delayR.disconnect();
    this.feedbackL.disconnect();
    this.feedbackR.disconnect();
    this.dampingL.disconnect();
    this.dampingR.disconnect();
    this.crossfeedL2R.disconnect();
    this.crossfeedR2L.disconnect();
    this.modOsc.disconnect();
    this.modGainL.disconnect();
    this.modGainR.disconnect();
    this.bypassNode.disconnect();
  }
}

// =============================================================================
// Presets
// =============================================================================

export const DELAY_PRESETS: Record<string, DelayParameters> = {
  quarter: { timeL: 0.5, timeR: 0.5, feedback: 0.4, mix: 0.3, damping: 0.3, pingPong: false, sync: 'quarter', modulation: 0, modRate: 0.5 },
  eighth: { timeL: 0.25, timeR: 0.25, feedback: 0.35, mix: 0.25, damping: 0.3, pingPong: false, sync: 'eighth', modulation: 0, modRate: 0.5 },
  pingPong: { timeL: 0.375, timeR: 0.375, feedback: 0.4, mix: 0.3, damping: 0.3, pingPong: true, sync: 'eighth', modulation: 0, modRate: 0.5 },
  tape: { timeL: 0.4, timeR: 0.42, feedback: 0.5, mix: 0.35, damping: 0.6, pingPong: false, sync: 'none', modulation: 0.2, modRate: 0.3 },
  chorus: { timeL: 0.02, timeR: 0.025, feedback: 0.3, mix: 0.4, damping: 0.2, pingPong: false, sync: 'none', modulation: 0.8, modRate: 1.5 },
  slapback: { timeL: 0.08, timeR: 0.08, feedback: 0.2, mix: 0.3, damping: 0.1, pingPong: false, sync: 'none', modulation: 0, modRate: 0.5 },
  spacious: { timeL: 0.5, timeR: 0.65, feedback: 0.35, mix: 0.3, damping: 0.4, pingPong: true, sync: 'none', modulation: 0.1, modRate: 0.4 },
};

export function createDelayPlugin(ctx: AudioContext, options?: DelayOptions): DelayPlugin {
  return new DelayPlugin(ctx, options);
}

export default DelayPlugin;
