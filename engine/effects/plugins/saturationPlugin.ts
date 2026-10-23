/**
 * SaturationPlugin - Standalone waveshaper drive.
 *
 * Features:
 * - Three drive characters: tube (tanh), tape (atan), fuzz (hard clip)
 * - Tone control on the wet path (tape-style dulling as drive rises)
 * - Dry/wet mix, 4x oversampling
 *
 * Signal Flow:
 * Input → Dry/Wet Split → [WaveShaper + Tone + Makeup] → Output
 *
 * The FX rack's Saturation, Overdrive and Distortion entries are three
 * voicings of this one plugin, the same way the reverb entries voice one
 * reverb — see SATURATION_PRESETS and `lib/fxCatalog.ts`.
 */

export type SaturationType = 'tube' | 'tape' | 'fuzz';

export interface SaturationParameters {
  drive: number;      // 0-1
  tone: number;       // 0-1 wet-path brightness
  mix: number;        // 0-1 dry/wet
  type: SaturationType;
}

export interface SaturationOptions {
  drive?: number;
  tone?: number;
  mix?: number;
  type?: SaturationType;
}

export const DEFAULT_PARAMS: SaturationParameters = {
  drive: 0.5,
  tone: 0.8,
  mix: 1,
  type: 'tube',
};

const CURVE_SAMPLES = 1024;

function driveCurve(type: SaturationType, drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const x = (i * 2) / (CURVE_SAMPLES - 1) - 1;
    switch (type) {
      case 'tape':
        // Arctangent soft clip: gentler knee than tanh, dulls like tape.
        curve[i] = (2 / Math.PI) * Math.atan(x * (1 + drive * 6));
        break;
      case 'fuzz': {
        // Hard clip with a collapsing threshold, then normalised.
        const threshold = 1 - drive * 0.85;
        curve[i] = Math.max(-threshold, Math.min(threshold, x * (1 + drive * 3))) / threshold;
        break;
      }
      case 'tube':
      default:
        curve[i] = Math.tanh(x * (1 + drive * 4));
        break;
    }
  }
  return curve;
}

export class SaturationPlugin {
  private ctx: AudioContext;
  private params: SaturationParameters;

  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private bypassNode: GainNode;

  private shaper: WaveShaperNode;
  private toneFilter: BiquadFilterNode;
  private makeupGain: GainNode;

  private isBypassed = false;
  private readonly SMOOTHING_TIME = 0.01;

  constructor(ctx: AudioContext, options: SaturationOptions = {}) {
    this.ctx = ctx;
    this.params = {
      drive: options.drive ?? DEFAULT_PARAMS.drive,
      tone: options.tone ?? DEFAULT_PARAMS.tone,
      mix: options.mix ?? DEFAULT_PARAMS.mix,
      type: options.type ?? DEFAULT_PARAMS.type,
    };

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.bypassNode = ctx.createGain();
    this.bypassNode.gain.value = 0;

    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';
    this.toneFilter = ctx.createBiquadFilter();
    this.toneFilter.type = 'lowpass';
    this.makeupGain = ctx.createGain();

    this.buildGraph();
    this.applyParams();
  }

  private buildGraph(): void {
    // Dry path
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // Wet path: input → shaper → tone → makeup → out
    this.inputNode.connect(this.shaper);
    this.shaper.connect(this.toneFilter);
    this.toneFilter.connect(this.makeupGain);
    this.makeupGain.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    // Bypass path
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);
  }

  private applyParams(): void {
    if (this.isBypassed) return;
    const t = this.ctx.currentTime;
    const { drive, tone, mix } = this.params;

    this.shaper.curve = driveCurve(this.params.type, drive);
    // 2 kHz fully dark to 18 kHz open.
    this.toneFilter.frequency.setTargetAtTime(2000 + tone * 16000, t, this.SMOOTHING_TIME);
    // Drive adds level; pull it back so the control reads as colour, not loudness.
    this.makeupGain.gain.setTargetAtTime(1 - drive * 0.4, t, this.SMOOTHING_TIME);

    this.dryGain.gain.setTargetAtTime(1 - mix, t, this.SMOOTHING_TIME);
    this.wetGain.gain.setTargetAtTime(mix, t, this.SMOOTHING_TIME);
    this.bypassNode.gain.setTargetAtTime(0, t, this.SMOOTHING_TIME);
  }

  public setDrive(value: number): void {
    this.params.drive = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getDrive(): number { return this.params.drive; }

  public setTone(value: number): void {
    this.params.tone = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getTone(): number { return this.params.tone; }

  public setMix(value: number): void {
    this.params.mix = Math.max(0, Math.min(1, value));
    this.applyParams();
  }

  public getMix(): number { return this.params.mix; }

  public setType(type: SaturationType): void {
    this.params.type = type;
    this.applyParams();
  }

  public getType(): SaturationType { return this.params.type; }

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

  public applyPreset(preset: keyof typeof SATURATION_PRESETS): void {
    const p = SATURATION_PRESETS[preset];
    if (!p) return;
    this.setType(p.type);
    this.setDrive(p.drive);
    this.setTone(p.tone);
    this.setMix(p.mix);
  }

  public getState(): SaturationParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<SaturationParameters & { bypass: boolean }>): void {
    if (state.type !== undefined) this.setType(state.type);
    if (state.drive !== undefined) this.setDrive(state.drive);
    if (state.tone !== undefined) this.setTone(state.tone);
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
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.bypassNode.disconnect();
    this.shaper.disconnect();
    this.toneFilter.disconnect();
    this.makeupGain.disconnect();
  }
}

// =============================================================================
// Presets — the rack's three distortion voicings.
// =============================================================================

export const SATURATION_PRESETS: Record<string, SaturationParameters> = {
  saturation: { type: 'tube', drive: 0.35, tone: 0.8, mix: 1 },
  overdrive: { type: 'tube', drive: 0.6, tone: 0.65, mix: 1 },
  distortion: { type: 'fuzz', drive: 0.8, tone: 0.6, mix: 1 },
};

export function createSaturationPlugin(ctx: AudioContext, options?: SaturationOptions): SaturationPlugin {
  return new SaturationPlugin(ctx, options);
}

export default SaturationPlugin;
