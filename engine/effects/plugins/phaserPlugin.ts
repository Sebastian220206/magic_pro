/**
 * PhaserPlugin - A cascade of swept all-pass filters.
 *
 * Features:
 * - Four all-pass stages swept 200 Hz–4 kHz by an LFO, with feedback and mix
 *
 * Signal Flow:
 * Input → Dry/Wet Split → [Allpass ×4 + Feedback] → Output
 *
 * All-passes pass every frequency at unity and shift only phase, so the dry
 * path alone is a wire — the sweep exists entirely in the wet path's moving
 * notches against the dry signal. Feedback sharpens them. Below ~0.7 mix the
 * effect thins out faster than the control suggests, which is why the rack
 * voices it wet.
 */

const STAGES = 4;
const SWEEP_LOW = 200;
const SWEEP_HIGH = 4000;

export interface PhaserParameters {
  rate: number;       // Hz, 0.05–5
  depth: number;      // sweep amount, 0–1
  feedback: number;   // 0–0.9
  mix: number;        // 0–1 dry/wet
}

export interface PhaserOptions {
  rate?: number;
  depth?: number;
  feedback?: number;
  mix?: number;
}

export const DEFAULT_PARAMS: PhaserParameters = {
  rate: 0.5,
  depth: 1,
  feedback: 0.5,
  mix: 1,
};

export class PhaserPlugin {
  private ctx: AudioContext;
  private params: PhaserParameters;

  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private stages: BiquadFilterNode[];
  private feedbackGain: GainNode;
  private osc: OscillatorNode;
  private lfoDepth: GainNode;

  private isBypassed = false;
  private readonly SMOOTHING_TIME = 0.02;

  constructor(ctx: AudioContext, options: PhaserOptions = {}) {
    this.ctx = ctx;
    this.params = {
      rate: options.rate ?? DEFAULT_PARAMS.rate,
      depth: options.depth ?? DEFAULT_PARAMS.depth,
      feedback: options.feedback ?? DEFAULT_PARAMS.feedback,
      mix: options.mix ?? DEFAULT_PARAMS.mix,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.stages = Array.from({ length: STAGES }, () => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = 1000;
      filter.Q.value = 1;
      return filter;
    });
    this.feedbackGain = ctx.createGain();
    this.osc = ctx.createOscillator();
    this.osc.type = 'sine';
    this.lfoDepth = ctx.createGain();

    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    let head: AudioNode = this.inputNode;
    for (const stage of this.stages) {
      head.connect(stage);
      head = stage;
      // One LFO drives every stage together, which is what makes the notches
      // march in step rather than smearing.
      this.lfoDepth.connect(stage.frequency);
    }
    head.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    // Loop gain stays below 1 by construction (feedback ≤ 0.9, all-passes at
    // unity), so the loop cannot run away however it is automated.
    head.connect(this.feedbackGain);
    this.feedbackGain.connect(this.stages[0]);

    this.osc.connect(this.lfoDepth);
    this.osc.start();

    this.applyParams();
  }

  private applyParams(): void {
    if (this.isBypassed) return;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(this.params.rate, t, this.SMOOTHING_TIME);
    const centre = (SWEEP_LOW + SWEEP_HIGH) / 2;
    const span = ((SWEEP_HIGH - SWEEP_LOW) / 2) * this.params.depth;
    for (const stage of this.stages) {
      stage.frequency.setTargetAtTime(centre, t, this.SMOOTHING_TIME);
    }
    this.lfoDepth.gain.setTargetAtTime(span, t, this.SMOOTHING_TIME);
    this.feedbackGain.gain.setTargetAtTime(this.params.feedback, t, this.SMOOTHING_TIME);
    this.dryGain.gain.setTargetAtTime(1 - this.params.mix, t, this.SMOOTHING_TIME);
    this.wetGain.gain.setTargetAtTime(this.params.mix, t, this.SMOOTHING_TIME);
  }

  public setRate(hz: number): void {
    this.params.rate = Math.max(0.05, Math.min(5, hz));
    this.applyParams();
  }

  public getRate(): number { return this.params.rate; }

  public setDepth(value: number): void {
    this.params.depth = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getDepth(): number { return this.params.depth; }

  public setFeedback(value: number): void {
    this.params.feedback = Math.max(0, Math.min(0.9, value));
    this.applyParams();
  }

  public getFeedback(): number { return this.params.feedback; }

  public setMix(value: number): void {
    this.params.mix = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getMix(): number { return this.params.mix; }

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    if (!bypass) this.applyParams();
  }

  public getState(): PhaserParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<PhaserParameters & { bypass: boolean }>): void {
    if (state.rate !== undefined) this.setRate(state.rate);
    if (state.depth !== undefined) this.setDepth(state.depth);
    if (state.feedback !== undefined) this.setFeedback(state.feedback);
    if (state.mix !== undefined) this.setMix(state.mix);
    if (state.bypass !== undefined) this.setBypass(state.bypass);
  }

  public get input(): AudioNode { return this.inputNode; }
  public get output(): AudioNode { return this.outputNode; }
  public connect(dest: AudioNode): void { this.outputNode.connect(dest); }
  public disconnect(dest?: AudioNode): void {
    dest ? this.outputNode.disconnect(dest) : this.outputNode.disconnect();
  }

  public dispose(): void {
    try { this.osc.stop(); } catch { /* already stopped */ }
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    for (const stage of this.stages) stage.disconnect();
    this.feedbackGain.disconnect();
    this.osc.disconnect();
    this.lfoDepth.disconnect();
  }
}

export function createPhaserPlugin(ctx: AudioContext, options?: PhaserOptions): PhaserPlugin {
  return new PhaserPlugin(ctx, options);
}

export default PhaserPlugin;
