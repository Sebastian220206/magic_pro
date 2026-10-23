/**
 * TremoloPlugin - LFO on a gain stage.
 *
 * Features:
 * - Sine or triangle LFO, 0.1–20 Hz, full-depth capable
 *
 * Signal Flow:
 * Input → Gain (base 1−depth/2, LFO ±depth/2) → Output
 *
 * Centring the LFO rather than gating from full level is what keeps depth 1
 * musical: the peaks stay where they were and the troughs pump, instead of
 * the whole signal ducking by half before the wobble even starts.
 */

export type TremoloWaveform = 'sine' | 'triangle';

export interface TremoloParameters {
  rate: number;       // Hz, 0.1–20
  depth: number;      // 0–1
  waveform: TremoloWaveform;
}

export interface TremoloOptions {
  rate?: number;
  depth?: number;
  waveform?: TremoloWaveform;
}

export const DEFAULT_PARAMS: TremoloParameters = {
  rate: 4,
  depth: 0.8,
  waveform: 'sine',
};

export class TremoloPlugin {
  private ctx: AudioContext;
  private params: TremoloParameters;

  private inputNode: GainNode;
  private outputNode: GainNode;
  private tremGain: GainNode;
  private osc: OscillatorNode;
  private lfoDepth: GainNode;

  private isBypassed = false;
  private readonly SMOOTHING_TIME = 0.02;

  constructor(ctx: AudioContext, options: TremoloOptions = {}) {
    this.ctx = ctx;
    this.params = {
      rate: options.rate ?? DEFAULT_PARAMS.rate,
      depth: options.depth ?? DEFAULT_PARAMS.depth,
      waveform: options.waveform ?? DEFAULT_PARAMS.waveform,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.tremGain = ctx.createGain();
    this.osc = ctx.createOscillator();
    this.lfoDepth = ctx.createGain();

    this.inputNode.connect(this.tremGain);
    this.tremGain.connect(this.outputNode);
    this.osc.connect(this.lfoDepth);
    this.lfoDepth.connect(this.tremGain.gain);
    this.osc.start();

    this.applyParams();
  }

  private applyParams(): void {
    if (this.isBypassed) return;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(this.params.rate, t, this.SMOOTHING_TIME);
    this.osc.type = this.params.waveform;
    this.lfoDepth.gain.setTargetAtTime(this.params.depth / 2, t, this.SMOOTHING_TIME);
    this.tremGain.gain.setTargetAtTime(1 - this.params.depth / 2, t, this.SMOOTHING_TIME);
  }

  public setRate(hz: number): void {
    this.params.rate = Math.max(0.1, Math.min(20, hz));
    this.applyParams();
  }

  public getRate(): number { return this.params.rate; }

  public setDepth(value: number): void {
    this.params.depth = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getDepth(): number { return this.params.depth; }

  public setWaveform(waveform: TremoloWaveform): void {
    this.params.waveform = waveform;
    this.applyParams();
  }

  public getWaveform(): TremoloWaveform { return this.params.waveform; }

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    if (!bypass) this.applyParams();
  }

  public getState(): TremoloParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<TremoloParameters & { bypass: boolean }>): void {
    if (state.rate !== undefined) this.setRate(state.rate);
    if (state.depth !== undefined) this.setDepth(state.depth);
    if (state.waveform === 'sine' || state.waveform === 'triangle') this.setWaveform(state.waveform);
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
    this.tremGain.disconnect();
    this.osc.disconnect();
    this.lfoDepth.disconnect();
  }
}

export function createTremoloPlugin(ctx: AudioContext, options?: TremoloOptions): TremoloPlugin {
  return new TremoloPlugin(ctx, options);
}

export default TremoloPlugin;
