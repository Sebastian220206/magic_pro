/**
 * WidenerPlugin - Mid/side stereo width.
 *
 * Features:
 * - Width from mono (0) through untouched (1) to exaggerated (2)
 * - Mono check without changing the width setting
 *
 * Signal Flow:
 * L/R → [Mid = (L+R)/2, Side = (L−R)/2] → Side × width → L/R rebuild
 *
 * The side gain halves are what keep unity: at width 1 the rebuild is
 * bit-for-bit the input (mid + side = L, mid − side = R), so the control
 * reads as width only, never as level.
 */

export interface WidenerParameters {
  width: number;      // 0-2, 1 is untouched
  mono: boolean;      // check the mix in mono without losing the width setting
}

export interface WidenerOptions {
  width?: number;
  mono?: boolean;
}

export const DEFAULT_PARAMS: WidenerParameters = {
  width: 1,
  mono: false,
};

export class WidenerPlugin {
  private ctx: AudioContext;
  private params: WidenerParameters;

  private inputNode: GainNode;
  private outputNode: GainNode;
  private bypassNode: GainNode;
  private wetIn: GainNode;

  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  private midGain: GainNode;
  private sideGain: GainNode;
  private invertR: GainNode;
  private widthGain: GainNode;
  private invertSide: GainNode;

  private isBypassed = false;
  private readonly SMOOTHING_TIME = 0.01;

  constructor(ctx: AudioContext, options: WidenerOptions = {}) {
    this.ctx = ctx;
    this.params = {
      width: options.width ?? DEFAULT_PARAMS.width,
      mono: options.mono ?? DEFAULT_PARAMS.mono,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.bypassNode = ctx.createGain();
    this.bypassNode.gain.value = 0;
    this.wetIn = ctx.createGain();

    this.splitter = ctx.createChannelSplitter(2);
    this.merger = ctx.createChannelMerger(2);
    this.midGain = ctx.createGain();
    this.sideGain = ctx.createGain();
    this.invertR = ctx.createGain();
    this.invertR.gain.value = -1;
    this.widthGain = ctx.createGain();
    this.invertSide = ctx.createGain();
    this.invertSide.gain.value = -1;

    this.buildGraph();
    this.applyParams();
  }

  private buildGraph(): void {
    // Bypass path
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    // Wet path: input → splitter → mid/side → merger → out
    this.inputNode.connect(this.wetIn);
    this.wetIn.connect(this.splitter);

    // Mid = (L + R) / 2 — a GainNode sums its inputs.
    this.splitter.connect(this.midGain, 0);
    this.splitter.connect(this.midGain, 1);
    this.midGain.gain.value = 0.5;

    // Side = (L − R) / 2.
    this.splitter.connect(this.sideGain, 0);
    this.splitter.connect(this.invertR, 1);
    this.invertR.connect(this.sideGain);
    this.sideGain.gain.value = 0.5;

    // Rebuild: L = mid + side·width, R = mid − side·width.
    this.sideGain.connect(this.widthGain);
    this.midGain.connect(this.merger, 0, 0);
    this.widthGain.connect(this.merger, 0, 0);
    this.midGain.connect(this.merger, 0, 1);
    this.widthGain.connect(this.invertSide);
    this.invertSide.connect(this.merger, 0, 1);

    this.merger.connect(this.outputNode);
  }

  private applyParams(): void {
    if (this.isBypassed) return;
    const t = this.ctx.currentTime;
    const effective = this.params.mono ? 0 : this.params.width;
    this.widthGain.gain.setTargetAtTime(effective, t, this.SMOOTHING_TIME);
    this.bypassNode.gain.setTargetAtTime(0, t, this.SMOOTHING_TIME);
    this.wetIn.gain.setTargetAtTime(1, t, this.SMOOTHING_TIME);
  }

  public setWidth(value: number): void {
    this.params.width = Math.max(0, Math.min(2, value));
    this.applyParams();
  }

  public getWidth(): number { return this.params.width; }

  public setMono(mono: boolean): void {
    this.params.mono = mono;
    this.applyParams();
  }

  public getMono(): boolean { return this.params.mono; }

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    const t = this.ctx.currentTime;
    if (bypass) {
      this.bypassNode.gain.setTargetAtTime(1, t, this.SMOOTHING_TIME);
      this.wetIn.gain.setTargetAtTime(0, t, this.SMOOTHING_TIME);
    } else {
      this.bypassNode.gain.setTargetAtTime(0, t, this.SMOOTHING_TIME);
      this.applyParams();
    }
  }

  public applyPreset(preset: keyof typeof WIDENER_PRESETS): void {
    const p = WIDENER_PRESETS[preset];
    if (!p) return;
    this.setWidth(p.width);
    this.setMono(p.mono);
  }

  public getState(): WidenerParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<WidenerParameters & { bypass: boolean }>): void {
    if (state.width !== undefined) this.setWidth(state.width);
    if (state.mono !== undefined) this.setMono(state.mono);
    if (state.bypass !== undefined) this.setBypass(state.bypass);
  }

  public get input(): AudioNode { return this.inputNode; }
  public get output(): AudioNode { return this.outputNode; }
  public connect(dest: AudioNode): void { this.outputNode.connect(dest); }
  public disconnect(dest?: AudioNode): void {
    dest ? this.outputNode.disconnect(dest) : this.outputNode.disconnect();
  }

  public dispose(): void {
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.bypassNode.disconnect();
    this.wetIn.disconnect();
    this.splitter.disconnect();
    this.merger.disconnect();
    this.midGain.disconnect();
    this.sideGain.disconnect();
    this.invertR.disconnect();
    this.widthGain.disconnect();
    this.invertSide.disconnect();
  }
}

// =============================================================================
// Presets
// =============================================================================

export const WIDENER_PRESETS: Record<string, WidenerParameters> = {
  subtle: { width: 1.25, mono: false },
  wide: { width: 1.6, mono: false },
  mono: { width: 1, mono: true },
};

export function createWidenerPlugin(ctx: AudioContext, options?: WidenerOptions): WidenerPlugin {
  return new WidenerPlugin(ctx, options);
}

export default WidenerPlugin;
