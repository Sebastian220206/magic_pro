/**
 * RingModPlugin - An oscillator multiplying the signal.
 *
 * Features:
 * - Sine carrier, 1 Hz–2 kHz, carrier amount plus dry/wet mix
 *
 * Signal Flow:
 * Input → Dry/Wet Split → [× Carrier] → Output
 *
 * Below ~20 Hz the carrier reads as tremolo; above it as metallic sidebands.
 * That is one control doing two jobs rather than two effects, which is why
 * the rack offers it once, under Creative.
 */

export interface RingModParameters {
  freq: number;       // Hz, 1–2000
  depth: number;      // carrier amount, 0–1
  mix: number;        // 0–1 dry/wet
}

export interface RingModOptions {
  freq?: number;
  depth?: number;
  mix?: number;
}

export const DEFAULT_PARAMS: RingModParameters = {
  freq: 100,
  depth: 1,
  mix: 1,
};

export class RingModPlugin {
  private ctx: AudioContext;
  private params: RingModParameters;

  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private modGain: GainNode;
  private carrier: OscillatorNode;
  private carrierDepth: GainNode;

  private isBypassed = false;
  private readonly SMOOTHING_TIME = 0.01;

  constructor(ctx: AudioContext, options: RingModOptions = {}) {
    this.ctx = ctx;
    this.params = {
      freq: options.freq ?? DEFAULT_PARAMS.freq,
      depth: options.depth ?? DEFAULT_PARAMS.depth,
      mix: options.mix ?? DEFAULT_PARAMS.mix,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    // The multiplier: base gain 0, carrier swings it ±depth.
    this.modGain = ctx.createGain();
    this.modGain.gain.value = 0;
    this.carrier = ctx.createOscillator();
    this.carrier.type = 'sine';
    this.carrierDepth = ctx.createGain();

    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    this.inputNode.connect(this.modGain);
    this.modGain.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    this.carrier.connect(this.carrierDepth);
    this.carrierDepth.connect(this.modGain.gain);
    this.carrier.start();

    this.applyParams();
  }

  private applyParams(): void {
    if (this.isBypassed) return;
    const t = this.ctx.currentTime;
    this.carrier.frequency.setTargetAtTime(this.params.freq, t, this.SMOOTHING_TIME);
    this.carrierDepth.gain.setTargetAtTime(this.params.depth, t, this.SMOOTHING_TIME);
    this.dryGain.gain.setTargetAtTime(1 - this.params.mix, t, this.SMOOTHING_TIME);
    this.wetGain.gain.setTargetAtTime(this.params.mix, t, this.SMOOTHING_TIME);
  }

  public setFreq(hz: number): void {
    this.params.freq = Math.max(1, Math.min(2000, hz));
    this.applyParams();
  }

  public getFreq(): number { return this.params.freq; }

  public setDepth(value: number): void {
    this.params.depth = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getDepth(): number { return this.params.depth; }

  public setMix(value: number): void {
    this.params.mix = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getMix(): number { return this.params.mix; }

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    if (!bypass) this.applyParams();
  }

  public getState(): RingModParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<RingModParameters & { bypass: boolean }>): void {
    if (state.freq !== undefined) this.setFreq(state.freq);
    if (state.depth !== undefined) this.setDepth(state.depth);
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
    try { this.carrier.stop(); } catch { /* already stopped */ }
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.modGain.disconnect();
    this.carrier.disconnect();
    this.carrierDepth.disconnect();
  }
}

export function createRingModPlugin(ctx: AudioContext, options?: RingModOptions): RingModPlugin {
  return new RingModPlugin(ctx, options);
}

export default RingModPlugin;
