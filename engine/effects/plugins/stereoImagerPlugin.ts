/**
 * StereoImagerPlugin - Per-band stereo width.
 *
 * Features:
 * - Three bands (low < 250 Hz, mid, high > 4 kHz) with independent width
 *
 * Signal Flow:
 * Input → Crossover → [Widener ×3] → Sum → Output
 *
 * Each band is split with cascaded Butterworth pairs (Linkwitz-Riley style),
 * which sum back to flat — at unity widths the box is very close to a wire,
 * so narrowing the bass does not thin it and widening the air does not
 * brighten it. The bands reuse `WidenerPlugin` rather than re-implementing
 * mid/side, so the two cannot disagree about what width means.
 */

import { WidenerPlugin } from './widenerPlugin';

export interface StereoImagerParameters {
  lowWidth: number;   // 0–2
  midWidth: number;   // 0–2
  highWidth: number;  // 0–2
}

export interface StereoImagerOptions {
  lowWidth?: number;
  midWidth?: number;
  highWidth?: number;
}

export const DEFAULT_PARAMS: StereoImagerParameters = {
  lowWidth: 1,
  midWidth: 1,
  highWidth: 1,
};

const LOW_XOVER = 250;
const HIGH_XOVER = 4000;

export class StereoImagerPlugin {
  private ctx: AudioContext;
  private params: StereoImagerParameters;

  private inputNode: GainNode;
  private outputNode: GainNode;

  private lowLp1: BiquadFilterNode;
  private lowLp2: BiquadFilterNode;
  private highHp1: BiquadFilterNode;
  private highHp2: BiquadFilterNode;
  private midHp1: BiquadFilterNode;
  private midHp2: BiquadFilterNode;
  private midLp1: BiquadFilterNode;
  private midLp2: BiquadFilterNode;

  private lowWidener: WidenerPlugin;
  private midWidener: WidenerPlugin;
  private highWidener: WidenerPlugin;

  private isBypassed = false;

  constructor(ctx: AudioContext, options: StereoImagerOptions = {}) {
    this.ctx = ctx;
    this.params = {
      lowWidth: options.lowWidth ?? DEFAULT_PARAMS.lowWidth,
      midWidth: options.midWidth ?? DEFAULT_PARAMS.midWidth,
      highWidth: options.highWidth ?? DEFAULT_PARAMS.highWidth,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    const lowpass = (freq: number) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      filter.Q.value = 0.707;
      return filter;
    };
    const highpass = (freq: number) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = freq;
      filter.Q.value = 0.707;
      return filter;
    };

    this.lowLp1 = lowpass(LOW_XOVER);
    this.lowLp2 = lowpass(LOW_XOVER);
    this.highHp1 = highpass(HIGH_XOVER);
    this.highHp2 = highpass(HIGH_XOVER);
    this.midHp1 = highpass(LOW_XOVER);
    this.midHp2 = highpass(LOW_XOVER);
    this.midLp1 = lowpass(HIGH_XOVER);
    this.midLp2 = lowpass(HIGH_XOVER);

    this.lowWidener = new WidenerPlugin(ctx);
    this.midWidener = new WidenerPlugin(ctx);
    this.highWidener = new WidenerPlugin(ctx);

    this.inputNode.connect(this.lowLp1);
    this.lowLp1.connect(this.lowLp2);
    this.lowLp2.connect(this.lowWidener.input);
    this.lowWidener.output.connect(this.outputNode);

    this.inputNode.connect(this.midHp1);
    this.midHp1.connect(this.midHp2);
    this.midHp2.connect(this.midLp1);
    this.midLp1.connect(this.midLp2);
    this.midLp2.connect(this.midWidener.input);
    this.midWidener.output.connect(this.outputNode);

    this.inputNode.connect(this.highHp1);
    this.highHp1.connect(this.highHp2);
    this.highHp2.connect(this.highWidener.input);
    this.highWidener.output.connect(this.outputNode);

    this.applyParams();
  }

  private applyParams(): void {
    if (this.isBypassed) return;
    this.lowWidener.setWidth(this.params.lowWidth);
    this.midWidener.setWidth(this.params.midWidth);
    this.highWidener.setWidth(this.params.highWidth);
  }

  public setLowWidth(value: number): void {
    this.params.lowWidth = Math.max(0, Math.min(2, value));
    this.applyParams();
  }

  public getLowWidth(): number { return this.params.lowWidth; }

  public setMidWidth(value: number): void {
    this.params.midWidth = Math.max(0, Math.min(2, value));
    this.applyParams();
  }

  public getMidWidth(): number { return this.params.midWidth; }

  public setHighWidth(value: number): void {
    this.params.highWidth = Math.max(0, Math.min(2, value));
    this.applyParams();
  }

  public getHighWidth(): number { return this.params.highWidth; }

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    this.lowWidener.setBypass(bypass);
    this.midWidener.setBypass(bypass);
    this.highWidener.setBypass(bypass);
    if (!bypass) this.applyParams();
  }

  public getState(): StereoImagerParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<StereoImagerParameters & { bypass: boolean }>): void {
    if (state.lowWidth !== undefined) this.setLowWidth(state.lowWidth);
    if (state.midWidth !== undefined) this.setMidWidth(state.midWidth);
    if (state.highWidth !== undefined) this.setHighWidth(state.highWidth);
    if (state.bypass !== undefined) this.setBypass(state.bypass);
  }

  public get input(): AudioNode { return this.inputNode; }
  public get output(): AudioNode { return this.outputNode; }
  public connect(dest: AudioNode): void { this.outputNode.connect(dest); }
  public disconnect(dest?: AudioNode): void {
    dest ? this.outputNode.disconnect(dest) : this.outputNode.disconnect();
  }

  public dispose(): void {
    this.lowWidener.dispose();
    this.midWidener.dispose();
    this.highWidener.dispose();
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.lowLp1.disconnect();
    this.lowLp2.disconnect();
    this.highHp1.disconnect();
    this.highHp2.disconnect();
    this.midHp1.disconnect();
    this.midHp2.disconnect();
    this.midLp1.disconnect();
    this.midLp2.disconnect();
  }
}

export function createStereoImagerPlugin(ctx: AudioContext, options?: StereoImagerOptions): StereoImagerPlugin {
  return new StereoImagerPlugin(ctx, options);
}

export default StereoImagerPlugin;
