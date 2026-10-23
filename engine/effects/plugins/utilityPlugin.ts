/**
 * UtilityPlugin - Gain, pan, mono and polarity in one box.
 *
 * Features:
 * - Trim gain in dB, balance pan, mono collapse check, polarity invert
 *
 * Signal Flow:
 * Input → Trim → [Stereo | Mono collapse] → Panner → Polarity → Output
 *
 * Mono reconnects the splitter rather than crossfading it: a blend would
 * comb against itself halfway, while a collapse is either stereo or mono and
 * never something in between.
 */

export interface UtilityParameters {
  gain: number;       // dB, -24…24
  pan: number;        // -1…1
  mono: boolean;
  polarity: boolean;  // true inverts the signal
}

export interface UtilityOptions {
  gain?: number;
  pan?: number;
  mono?: boolean;
  polarity?: boolean;
}

export const DEFAULT_PARAMS: UtilityParameters = {
  gain: 0,
  pan: 0,
  mono: false,
  polarity: false,
};

const dbToGain = (db: number) => Math.pow(10, db / 20);

export class UtilityPlugin {
  private ctx: AudioContext;
  private params: UtilityParameters;

  private inputNode: GainNode;
  private outputNode: GainNode;
  private trimGain: GainNode;
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  private monoSum: GainNode;
  private panner: StereoPannerNode;
  private polarityGain: GainNode;

  private isBypassed = false;
  private readonly SMOOTHING_TIME = 0.01;

  constructor(ctx: AudioContext, options: UtilityOptions = {}) {
    this.ctx = ctx;
    this.params = {
      gain: options.gain ?? DEFAULT_PARAMS.gain,
      pan: options.pan ?? DEFAULT_PARAMS.pan,
      mono: options.mono ?? DEFAULT_PARAMS.mono,
      polarity: options.polarity ?? DEFAULT_PARAMS.polarity,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.trimGain = ctx.createGain();
    this.splitter = ctx.createChannelSplitter(2);
    this.merger = ctx.createChannelMerger(2);
    this.monoSum = ctx.createGain();
    this.monoSum.gain.value = 0.5;
    this.panner = ctx.createStereoPanner();
    this.polarityGain = ctx.createGain();

    this.inputNode.connect(this.trimGain);
    this.trimGain.connect(this.splitter);
    this.rebuildMono();
    this.merger.connect(this.panner);
    this.panner.connect(this.polarityGain);
    this.polarityGain.connect(this.outputNode);

    this.applyParams();
  }

  /** Reconnect the collapse stage. See the note at the top of this file. */
  private rebuildMono(): void {
    try { this.splitter.disconnect(); } catch { /* first build */ }
    try { this.monoSum.disconnect(); } catch { /* first build */ }
    if (this.params.mono) {
      this.splitter.connect(this.monoSum, 0);
      this.splitter.connect(this.monoSum, 1);
      this.monoSum.connect(this.merger, 0, 0);
      this.monoSum.connect(this.merger, 0, 1);
    } else {
      this.splitter.connect(this.merger, 0, 0);
      this.splitter.connect(this.merger, 1, 1);
    }
  }

  private applyParams(): void {
    if (this.isBypassed) return;
    const t = this.ctx.currentTime;
    this.trimGain.gain.setTargetAtTime(dbToGain(this.params.gain), t, this.SMOOTHING_TIME);
    this.panner.pan.setTargetAtTime(this.params.pan, t, this.SMOOTHING_TIME);
    this.polarityGain.gain.setTargetAtTime(this.params.polarity ? -1 : 1, t, this.SMOOTHING_TIME);
  }

  public setGain(db: number): void {
    this.params.gain = Math.max(-24, Math.min(24, db));
    this.applyParams();
  }

  public getGain(): number { return this.params.gain; }

  public setPan(value: number): void {
    this.params.pan = Math.max(-1, Math.min(1, value));
    this.applyParams();
  }

  public getPan(): number { return this.params.pan; }

  public setMono(mono: boolean): void {
    this.params.mono = mono;
    this.rebuildMono();
    this.applyParams();
  }

  public getMono(): boolean { return this.params.mono; }

  public setPolarity(invert: boolean): void {
    this.params.polarity = invert;
    this.applyParams();
  }

  public getPolarity(): boolean { return this.params.polarity; }

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    if (!bypass) {
      this.rebuildMono();
      this.applyParams();
    }
  }

  public getState(): UtilityParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<UtilityParameters & { bypass: boolean }>): void {
    if (state.gain !== undefined) this.setGain(state.gain);
    if (state.pan !== undefined) this.setPan(state.pan);
    if (state.mono !== undefined) this.setMono(state.mono);
    if (state.polarity !== undefined) this.setPolarity(state.polarity);
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
    this.trimGain.disconnect();
    this.splitter.disconnect();
    this.merger.disconnect();
    this.monoSum.disconnect();
    this.panner.disconnect();
    this.polarityGain.disconnect();
  }
}

export function createUtilityPlugin(ctx: AudioContext, options?: UtilityOptions): UtilityPlugin {
  return new UtilityPlugin(ctx, options);
}

export default UtilityPlugin;
