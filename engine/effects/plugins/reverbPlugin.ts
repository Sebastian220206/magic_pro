/**
 * ReverbPlugin - Algorithmic + Convolution Reverb
 *
 * Two modes:
 * 1. Algorithmic: Synthetic reverb using delay lines and filters
 * 2. IR (Impulse Response): Convolution reverb with loaded IR files
 *
 * Signal Flow:
 * Input → Dry/Wet Split → [Algorithmic OR Convolver] → Output
 */

export type ReverbMode = 'algorithmic' | 'ir';

export interface ReverbParameters {
  mode: ReverbMode;
  mix: number;          // 0-1 dry/wet mix
  decay: number;        // seconds (0.1 - 10) — algorithmic only
  preDelay: number;     // ms (0 - 100) — algorithmic only
  damping: number;      // 0-1 high-frequency damping — algorithmic only
  irUrl?: string;       // URL to IR file — IR mode only
}

export interface ReverbOptions {
  mode?: ReverbMode;
  mix?: number;
  decay?: number;
  preDelay?: number;
  damping?: number;
  irUrl?: string;
}

const DEFAULT_PARAMS: ReverbParameters = {
  mode: 'algorithmic',
  mix: 0.3,
  decay: 2.0,
  preDelay: 20,
  damping: 0.5,
};

/**
 * Generate a synthetic impulse response for algorithmic reverb
 */
function generateImpulseResponse(
  ctx: AudioContext,
  duration: number,
  decay: number,
  damping: number
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Exponential decay with high-frequency damping
      const envelope = Math.exp(-t * (3 / decay));
      // Random noise with phase offset between channels
      const noise = Math.random() * 2 - 1;
      // Damping: reduce high frequencies over time
      const dampFactor = 1 - damping * (t / duration);
      data[i] = noise * envelope * dampFactor;
    }
  }

  return buffer;
}

export class ReverbPlugin {
  private ctx: AudioContext;
  private params: ReverbParameters;

  // Nodes
  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private convolver: ConvolverNode;
  private preDelayNode: DelayNode;
  private algorithmicFilter: BiquadFilterNode;
  private isBypassed = false;
  private bypassNode: GainNode;

  private readonly SMOOTHING_TIME = 0.01;

  constructor(ctx: AudioContext, options: ReverbOptions = {}) {
    this.ctx = ctx;
    this.params = {
      mode: options.mode ?? DEFAULT_PARAMS.mode,
      mix: options.mix ?? DEFAULT_PARAMS.mix,
      decay: options.decay ?? DEFAULT_PARAMS.decay,
      preDelay: options.preDelay ?? DEFAULT_PARAMS.preDelay,
      damping: options.damping ?? DEFAULT_PARAMS.damping,
      irUrl: options.irUrl,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.bypassNode = ctx.createGain();
    this.bypassNode.gain.value = 0;

    this.convolver = ctx.createConvolver();
    this.preDelayNode = ctx.createDelay(0.1);
    this.algorithmicFilter = ctx.createBiquadFilter();
    this.algorithmicFilter.type = 'lowpass';
    this.algorithmicFilter.frequency.value = 2000;

    this.buildGraph();
    this.applyMix();
  }

  private buildGraph(): void {
    // Dry path: input → dryGain → output
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // Wet path: input → preDelay → convolver → wetGain → output
    this.inputNode.connect(this.preDelayNode);
    this.preDelayNode.connect(this.algorithmicFilter);
    this.algorithmicFilter.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    // Bypass
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);

    // Load initial IR
    this.loadAlgorithmicIR();
  }

  private loadAlgorithmicIR(): void {
    const ir = generateImpulseResponse(
      this.ctx,
      this.params.decay,
      this.params.decay,
      this.params.damping
    );
    this.convolver.buffer = ir;
  }

  private applyMix(): void {
    const t = this.ctx.currentTime;
    this.dryGain.gain.setTargetAtTime(1 - this.params.mix, t, this.SMOOTHING_TIME);
    this.wetGain.gain.setTargetAtTime(this.params.mix, t, this.SMOOTHING_TIME);
  }

  // ===========================================================================
  // Parameters
  // ===========================================================================

  public setMix(value: number): void {
    this.params.mix = Math.max(0, Math.min(1, value));
    this.applyMix();
  }

  public getMix(): number { return this.params.mix; }

  public setDecay(seconds: number): void {
    this.params.decay = Math.max(0.1, Math.min(10, seconds));
    if (this.params.mode === 'algorithmic') {
      this.loadAlgorithmicIR();
    }
  }

  public getDecay(): number { return this.params.decay; }

  public setPreDelay(ms: number): void {
    this.params.preDelay = Math.max(0, Math.min(100, ms));
    this.preDelayNode.delayTime.setTargetAtTime(
      this.params.preDelay / 1000,
      this.ctx.currentTime,
      this.SMOOTHING_TIME
    );
  }

  public getPreDelay(): number { return this.params.preDelay; }

  public setDamping(value: number): void {
    this.params.damping = Math.max(0, Math.min(1, value));
    if (this.params.mode === 'algorithmic') {
      this.loadAlgorithmicIR();
    }
  }

  public getDamping(): number { return this.params.damping; }

  public async setMode(mode: ReverbMode, irUrl?: string): Promise<void> {
    this.params.mode = mode;
    if (mode === 'ir' && irUrl) {
      this.params.irUrl = irUrl;
      await this.loadIRFile(irUrl);
    } else if (mode === 'algorithmic') {
      this.loadAlgorithmicIR();
    }
  }

  public getMode(): ReverbMode { return this.params.mode; }

  public async loadIRFile(url: string): Promise<void> {
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const irBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.convolver.buffer = irBuffer;
      console.log(`[Reverb] IR loaded: ${url}`);
    } catch (err) {
      console.warn(`[Reverb] Failed to load IR: ${url}`, err);
      this.loadAlgorithmicIR();
    }
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
      this.applyMix();
    }
  }

  public isBypassedState(): boolean { return this.isBypassed; }

  // ===========================================================================
  // Presets
  // ===========================================================================

  public applyPreset(preset: keyof typeof REVERB_PRESETS): void {
    const p = REVERB_PRESETS[preset];
    if (!p) return;
    this.setMix(p.mix);
    this.setDecay(p.decay);
    this.setPreDelay(p.preDelay);
    this.setDamping(p.damping);
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): ReverbParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<ReverbParameters & { bypass: boolean }>): void {
    if (state.mix !== undefined) this.setMix(state.mix);
    if (state.decay !== undefined) this.setDecay(state.decay);
    if (state.preDelay !== undefined) this.setPreDelay(state.preDelay);
    if (state.damping !== undefined) this.setDamping(state.damping);
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
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.convolver.disconnect();
    this.preDelayNode.disconnect();
    this.algorithmicFilter.disconnect();
    this.bypassNode.disconnect();
  }
}

// =============================================================================
// Presets
// =============================================================================

export const REVERB_PRESETS: Record<string, Omit<ReverbParameters, 'mode' | 'irUrl'>> = {
  room: { mix: 0.25, decay: 0.8, preDelay: 10, damping: 0.4 },
  hall: { mix: 0.35, decay: 3.0, preDelay: 25, damping: 0.5 },
  plate: { mix: 0.3, decay: 1.5, preDelay: 5, damping: 0.3 },
  chamber: { mix: 0.3, decay: 2.0, preDelay: 15, damping: 0.45 },
  cathedral: { mix: 0.4, decay: 5.0, preDelay: 40, damping: 0.6 },
  ambient: { mix: 0.2, decay: 1.0, preDelay: 5, damping: 0.3 },
  spring: { mix: 0.25, decay: 0.5, preDelay: 0, damping: 0.2 },
};

export function createReverbPlugin(ctx: AudioContext, options?: ReverbOptions): ReverbPlugin {
  return new ReverbPlugin(ctx, options);
}

export default ReverbPlugin;
