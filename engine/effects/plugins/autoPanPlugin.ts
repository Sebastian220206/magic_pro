/**
 * AutoPanPlugin - LFO on a stereo panner.
 *
 * Features:
 * - Sine or triangle LFO, 0.05–10 Hz, depth to full left-right swing
 *
 * Signal Flow:
 * Input → StereoPanner (centre, LFO ±depth) → Output
 *
 * A mono input stays centred no matter the rate — panning positions energy
 * that is already there rather than creating width, so this is movement, not
 * a widener. Pair it with one when the source is mono.
 */

export type AutoPanWaveform = 'sine' | 'triangle';

export interface AutoPanParameters {
  rate: number;       // Hz, 0.05–10
  depth: number;      // 0–1, 1 is full left-right
  waveform: AutoPanWaveform;
}

export interface AutoPanOptions {
  rate?: number;
  depth?: number;
  waveform?: AutoPanWaveform;
}

export const DEFAULT_PARAMS: AutoPanParameters = {
  rate: 1,
  depth: 1,
  waveform: 'sine',
};

export class AutoPanPlugin {
  private ctx: AudioContext;
  private params: AutoPanParameters;

  private inputNode: GainNode;
  private outputNode: GainNode;
  private panner: StereoPannerNode;
  private osc: OscillatorNode;
  private lfoDepth: GainNode;

  private isBypassed = false;
  private readonly SMOOTHING_TIME = 0.02;

  constructor(ctx: AudioContext, options: AutoPanOptions = {}) {
    this.ctx = ctx;
    this.params = {
      rate: options.rate ?? DEFAULT_PARAMS.rate,
      depth: options.depth ?? DEFAULT_PARAMS.depth,
      waveform: options.waveform ?? DEFAULT_PARAMS.waveform,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.panner = ctx.createStereoPanner();
    this.osc = ctx.createOscillator();
    this.lfoDepth = ctx.createGain();

    this.inputNode.connect(this.panner);
    this.panner.connect(this.outputNode);
    this.osc.connect(this.lfoDepth);
    this.lfoDepth.connect(this.panner.pan);
    this.osc.start();

    this.applyParams();
  }

  private applyParams(): void {
    if (this.isBypassed) return;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(this.params.rate, t, this.SMOOTHING_TIME);
    this.osc.type = this.params.waveform;
    this.lfoDepth.gain.setTargetAtTime(this.params.depth, t, this.SMOOTHING_TIME);
    this.panner.pan.setTargetAtTime(0, t, this.SMOOTHING_TIME);
  }

  public setRate(hz: number): void {
    this.params.rate = Math.max(0.05, Math.min(10, hz));
    this.applyParams();
  }

  public getRate(): number { return this.params.rate; }

  public setDepth(value: number): void {
    this.params.depth = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getDepth(): number { return this.params.depth; }

  public setWaveform(waveform: AutoPanWaveform): void {
    this.params.waveform = waveform;
    this.applyParams();
  }

  public getWaveform(): AutoPanWaveform { return this.params.waveform; }

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    if (!bypass) this.applyParams();
  }

  public getState(): AutoPanParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<AutoPanParameters & { bypass: boolean }>): void {
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
    this.panner.disconnect();
    this.osc.disconnect();
    this.lfoDepth.disconnect();
  }
}

export function createAutoPanPlugin(ctx: AudioContext, options?: AutoPanOptions): AutoPanPlugin {
  return new AutoPanPlugin(ctx, options);
}

export default AutoPanPlugin;
