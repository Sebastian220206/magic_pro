/**
 * GraphicEqPlugin - Ten fixed bands at octave-ish centres.
 *
 * Features:
 * - Bands at 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k and 16k Hz, ±12 dB each
 *
 * Signal Flow:
 * Input → Bell ×10 → Output
 *
 * The Channel EQ is parametric and better at surgery; this is for broad
 * strokes and for anyone who mixes with their eyes. It arrives flat, like the
 * Channel EQ does — a preset curve on insert would colour the track before a
 * fader is touched.
 */

export const GRAPHIC_EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const GRAPHIC_EQ_BAND_COUNT = GRAPHIC_EQ_FREQS.length;

export interface GraphicEqParameters {
  band1: number; band2: number; band3: number; band4: number; band5: number;
  band6: number; band7: number; band8: number; band9: number; band10: number;
}

export type GraphicEqOptions = Partial<GraphicEqParameters>;

export const DEFAULT_PARAMS: GraphicEqParameters = {
  band1: 0, band2: 0, band3: 0, band4: 0, band5: 0,
  band6: 0, band7: 0, band8: 0, band9: 0, band10: 0,
};

const BAND_KEYS = [
  'band1', 'band2', 'band3', 'band4', 'band5',
  'band6', 'band7', 'band8', 'band9', 'band10',
] as const;

export class GraphicEqPlugin {
  private ctx: AudioContext;
  private params: GraphicEqParameters;

  private inputNode: GainNode;
  private outputNode: GainNode;
  private bands: BiquadFilterNode[];

  private isBypassed = false;
  private readonly SMOOTHING_TIME = 0.01;

  constructor(ctx: AudioContext, options: GraphicEqOptions = {}) {
    this.ctx = ctx;
    this.params = { ...DEFAULT_PARAMS };
    for (const key of BAND_KEYS) {
      const value = options[key];
      if (typeof value === 'number') this.params[key] = value;
    }

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.bands = GRAPHIC_EQ_FREQS.map(freq => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.1;
      return filter;
    });

    let head: AudioNode = this.inputNode;
    for (const band of this.bands) {
      head.connect(band);
      head = band;
    }
    head.connect(this.outputNode);

    this.applyParams();
  }

  private applyParams(): void {
    if (this.isBypassed) return;
    const t = this.ctx.currentTime;
    this.bands.forEach((band, i) => {
      band.gain.setTargetAtTime(this.params[BAND_KEYS[i]], t, this.SMOOTHING_TIME);
    });
  }

  public setBand(index: number, db: number): void {
    if (index < 0 || index >= GRAPHIC_EQ_BAND_COUNT) return;
    this.params[BAND_KEYS[index]] = Math.max(-12, Math.min(12, db));
    this.applyParams();
  }

  public getBand(index: number): number {
    if (index < 0 || index >= GRAPHIC_EQ_BAND_COUNT) return 0;
    return this.params[BAND_KEYS[index]];
  }

  public setBypass(bypass: boolean): void {
    this.isBypassed = bypass;
    if (!bypass) this.applyParams();
  }

  public getState(): GraphicEqParameters & { bypass: boolean } {
    return { ...this.params, bypass: this.isBypassed };
  }

  public setState(state: Partial<GraphicEqParameters & { bypass: boolean }>): void {
    for (const key of BAND_KEYS) {
      const value = state[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        this.params[key] = Math.max(-12, Math.min(12, value));
      }
    }
    this.applyParams();
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
    for (const band of this.bands) band.disconnect();
  }
}

export function createGraphicEqPlugin(ctx: AudioContext, options?: GraphicEqOptions): GraphicEqPlugin {
  return new GraphicEqPlugin(ctx, options);
}

export default GraphicEqPlugin;
