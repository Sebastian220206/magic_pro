/**
 * Vintage/Analog-Modeled EQs - Pultec, Neve, SSL Style EQs
 *
 * Features:
 * - Pultec EQP-1A: Legendary program EQ with low/high boost/cut
 * - Neve 1073: Classic British console EQ
 * - SSL E-Series: Parametric EQ with filters
 * - Tube saturation modeling
 * - Transformer coloration
 * - Switchable EQ curves
 *
 * Signal Flow:
 * Input → HPF → Bell/ Shelf Filters → LPF → Saturation → Output
 */

export type VintageEqType = 'pultec' | 'neve' | 'ssl';

export interface VintageEqBand {
  frequency: number;
  gain: number;
  Q: number;
  type: 'bell' | 'lowShelf' | 'highShelf' | 'highPass' | 'lowPass';
}

export interface VintageEqParameters {
  type: VintageEqType;
  // Pultec-style
  lowBoost: number;
  lowCut: number;
  lowFreq: number;      // 20, 30, 60, 100, 200 Hz
  highBoost: number;
  highCut: number;
  highFreq: number;     // 3, 4, 5, 8, 10, 12, 16 kHz
  bandwidth: number;    // Q for high boost

  // Neve/SSL-style parametric
  highPassFreq: number;
  lowPassFreq: number;
  bell1Freq: number;
  bell1Gain: number;
  bell1Q: number;
  bell2Freq: number;
  bell2Gain: number;
  bell2Q: number;

  // Character
  saturationDrive: number;
  transformerColor: boolean;
  bypass: boolean;
}

export interface VintageEqState extends VintageEqParameters {
  outputLevel: number;
}

const PULTEC_PRESETS: Record<string, Partial<VintageEqParameters>> = {
  'vocal': {
    lowBoost: 3, lowCut: 0, lowFreq: 100,
    highBoost: 4, highCut: 0, highFreq: 10,
    bandwidth: 5,
  },
  'bass': {
    lowBoost: 5, lowCut: 0, lowFreq: 60,
    highBoost: 2, highCut: 0, highFreq: 8,
    bandwidth: 4,
  },
  'drums': {
    lowBoost: 4, lowCut: 0, lowFreq: 60,
    highBoost: 5, highCut: 0, highFreq: 12,
    bandwidth: 6,
  },
  'mix': {
    lowBoost: 2, lowCut: 0, lowFreq: 100,
    highBoost: 2, highCut: 0, highFreq: 10,
    bandwidth: 5,
  },
};

const NEVE_PRESETS: Record<string, Partial<VintageEqParameters>> = {
  'vocal': {
    highPassFreq: 80, lowPassFreq: 18000,
    bell1Freq: 3000, bell1Gain: 3, bell1Q: 1,
    bell2Freq: 200, bell2Gain: 2, bell2Q: 0.7,
  },
  'guitar': {
    highPassFreq: 100, lowPassFreq: 15000,
    bell1Freq: 2500, bell1Gain: 4, bell1Q: 1.2,
    bell2Freq: 400, bell2Gain: -2, bell2Q: 0.8,
  },
  'drums': {
    highPassFreq: 60, lowPassFreq: 16000,
    bell1Freq: 4000, bell1Gain: 4, bell1Q: 0.9,
    bell2Freq: 150, bell2Gain: 3, bell2Q: 0.7,
  },
};

const SSL_PRESETS: Record<string, Partial<VintageEqParameters>> = {
  'vocal': {
    highPassFreq: 100, lowPassFreq: 18000,
    bell1Freq: 3500, bell1Gain: 3, bell1Q: 1.5,
    bell2Freq: 250, bell2Gain: 2, bell2Q: 1,
  },
  'mix': {
    highPassFreq: 30, lowPassFreq: 20000,
    bell1Freq: 10000, bell1Gain: 2, bell1Q: 0.7,
    bell2Freq: 300, bell2Gain: 1, bell2Q: 1,
  },
};

const DEFAULT_PARAMS: VintageEqParameters = {
  type: 'pultec',
  lowBoost: 0, lowCut: 0, lowFreq: 100,
  highBoost: 0, highCut: 0, highFreq: 10,
  bandwidth: 5,
  highPassFreq: 20, lowPassFreq: 20000,
  bell1Freq: 1000, bell1Gain: 0, bell1Q: 1,
  bell2Freq: 500, bell2Gain: 0, bell2Q: 1,
  saturationDrive: 0,
  transformerColor: false,
  bypass: false,
};

export class VintageEq {
  private ctx: AudioContext;
  private params: VintageEqParameters;
  private inputNode: GainNode;
  private outputNode: GainNode;

  // Filter nodes
  private highPassFilter: BiquadFilterNode;
  private lowPassFilter: BiquadFilterNode;
  private bell1Filter: BiquadFilterNode;
  private bell2Filter: BiquadFilterNode;

  // Saturation
  private saturationNode: WaveShaperNode;

  // State
  private state: VintageEqState;

  constructor(ctx: AudioContext, type: VintageEqType = 'pultec') {
    this.ctx = ctx;
    this.params = { ...DEFAULT_PARAMS, type };

    // Create nodes
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.highPassFilter = ctx.createBiquadFilter();
    this.lowPassFilter = ctx.createBiquadFilter();
    this.bell1Filter = ctx.createBiquadFilter();
    this.bell2Filter = ctx.createBiquadFilter();
    this.saturationNode = ctx.createWaveShaper();

    // Configure filters
    this.highPassFilter.type = 'highpass';
    this.lowPassFilter.type = 'lowpass';
    this.bell1Filter.type = 'peaking';
    this.bell2Filter.type = 'peaking';

    // Connect chain
    this.inputNode
      .connect(this.highPassFilter)
      .connect(this.bell1Filter)
      .connect(this.bell2Filter)
      .connect(this.lowPassFilter)
      .connect(this.saturationNode)
      .connect(this.outputNode);

    // Initialize saturation curve
    this.updateSaturationCurve();

    this.state = {
      ...this.params,
      outputLevel: 0,
    };
  }

  /**
   * Apply Pultec-style EQ
   */
  applyPultec(
    lowBoost: number,
    lowCut: number,
    lowFreq: number,
    highBoost: number,
    highCut: number,
    highFreq: number,
    bandwidth: number
  ): void {
    this.params.lowBoost = lowBoost;
    this.params.lowCut = lowCut;
    this.params.lowFreq = lowFreq;
    this.params.highBoost = highBoost;
    this.params.highCut = highCut;
    this.params.highFreq = highFreq;
    this.params.bandwidth = bandwidth;

    // Pultec low shelf: simultaneous boost and cut creates unique curve
    const lowGain = lowBoost - lowCut * 0.5;  // Interactive behavior
    this.bell1Filter.frequency.value = lowFreq;
    this.bell1Filter.gain.value = lowGain * 2;  // Pultec has strong effect
    this.bell1Filter.Q.value = 0.7;

    // Pultec high shelf
    const highGain = highBoost - highCut * 0.5;
    this.bell2Filter.frequency.value = highFreq;
    this.bell2Filter.gain.value = highGain * 2;
    this.bell2Filter.Q.value = 1 / bandwidth;

    this.updateState();
  }

  /**
   * Apply Neve 1073-style EQ
   */
  applyNeve(
    highPassFreq: number,
    lowPassFreq: number,
    bell1Freq: number,
    bell1Gain: number,
    bell1Q: number,
    bell2Freq: number,
    bell2Gain: number,
    bell2Q: number
  ): void {
    this.params.highPassFreq = highPassFreq;
    this.params.lowPassFreq = lowPassFreq;
    this.params.bell1Freq = bell1Freq;
    this.params.bell1Gain = bell1Gain;
    this.params.bell1Q = bell1Q;
    this.params.bell2Freq = bell2Freq;
    this.params.bell2Gain = bell2Gain;
    this.params.bell2Q = bell2Q;

    // Neve-style filters
    this.highPassFilter.frequency.value = highPassFreq;
    this.highPassFilter.Q.value = 0.707;

    this.lowPassFilter.frequency.value = lowPassFreq;
    this.lowPassFilter.Q.value = 0.707;

    // Bell filters
    this.bell1Filter.frequency.value = bell1Freq;
    this.bell1Filter.gain.value = bell1Gain;
    this.bell1Filter.Q.value = bell1Q;

    this.bell2Filter.frequency.value = bell2Freq;
    this.bell2Filter.gain.value = bell2Gain;
    this.bell2Filter.Q.value = bell2Q;

    // Neve transformer saturation
    this.params.saturationDrive = 0.3;
    this.updateSaturationCurve();

    this.updateState();
  }

  /**
   * Apply SSL E-Series-style EQ
   */
  applySSL(
    highPassFreq: number,
    lowPassFreq: number,
    bell1Freq: number,
    bell1Gain: number,
    bell1Q: number,
    bell2Freq: number,
    bell2Gain: number,
    bell2Q: number
  ): void {
    this.params.highPassFreq = highPassFreq;
    this.params.lowPassFreq = lowPassFreq;
    this.params.bell1Freq = bell1Freq;
    this.params.bell1Gain = bell1Gain;
    this.params.bell1Q = bell1Q;
    this.params.bell2Freq = bell2Freq;
    this.params.bell2Gain = bell2Gain;
    this.params.bell2Q = bell2Q;

    // SSL-style filters (steeper slopes)
    this.highPassFilter.frequency.value = highPassFreq;
    this.highPassFilter.Q.value = 1.0;

    this.lowPassFilter.frequency.value = lowPassFreq;
    this.lowPassFilter.Q.value = 1.0;

    // Parametric bells
    this.bell1Filter.frequency.value = bell1Freq;
    this.bell1Filter.gain.value = bell1Gain;
    this.bell1Filter.Q.value = bell1Q;

    this.bell2Filter.frequency.value = bell2Freq;
    this.bell2Filter.gain.value = bell2Gain;
    this.bell2Filter.Q.value = bell2Q;

    this.updateState();
  }

  /**
   * Load preset
   */
  loadPreset(name: string): void {
    const type = this.params.type;
    const presets = type === 'pultec' ? PULTEC_PRESETS
                  : type === 'neve' ? NEVE_PRESETS
                  : SSL_PRESETS;

    const preset = presets[name];
    if (preset) {
      this.params = { ...this.params, ...preset };
      this.applyCurrentType();
    }
  }

  /**
   * Apply EQ based on current type
   */
  private applyCurrentType(): void {
    switch (this.params.type) {
      case 'pultec':
        this.applyPultec(
          this.params.lowBoost, this.params.lowCut, this.params.lowFreq,
          this.params.highBoost, this.params.highCut, this.params.highFreq,
          this.params.bandwidth
        );
        break;
      case 'neve':
        this.applyNeve(
          this.params.highPassFreq, this.params.lowPassFreq,
          this.params.bell1Freq, this.params.bell1Gain, this.params.bell1Q,
          this.params.bell2Freq, this.params.bell2Gain, this.params.bell2Q
        );
        break;
      case 'ssl':
        this.applySSL(
          this.params.highPassFreq, this.params.lowPassFreq,
          this.params.bell1Freq, this.params.bell1Gain, this.params.bell1Q,
          this.params.bell2Freq, this.params.bell2Gain, this.params.bell2Q
        );
        break;
    }
  }

  /**
   * Update saturation curve
   */
  private updateSaturationCurve(): void {
    const drive = this.params.saturationDrive;
    const samples = 256;
    const curve = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft clipping with tube-like saturation
      curve[i] = Math.tanh(x * (1 + drive * 5));
    }

    this.saturationNode.curve = curve;
    this.saturationNode.oversample = '4x';
  }

  /**
   * Set transformer color
   */
  setTransformerColor(enabled: boolean): void {
    this.params.transformerColor = enabled;
    if (enabled) {
      this.params.saturationDrive = Math.max(this.params.saturationDrive, 0.2);
    }
    this.updateSaturationCurve();
  }

  /**
   * Set bypass
   */
  setBypass(bypass: boolean): void {
    this.params.bypass = bypass;
    if (bypass) {
      this.inputNode.disconnect();
      this.inputNode.connect(this.outputNode);
    } else {
      this.inputNode.disconnect();
      this.inputNode
        .connect(this.highPassFilter)
        .connect(this.bell1Filter)
        .connect(this.bell2Filter)
        .connect(this.lowPassFilter)
        .connect(this.saturationNode)
        .connect(this.outputNode);
    }
  }

  /**
   * Update state
   */
  private updateState(): void {
    this.state = { ...this.params, outputLevel: 0 };
  }

  /**
   * Get input node
   */
  getInputNode(): GainNode {
    return this.inputNode;
  }

  /**
   * Get output node
   */
  getOutputNode(): GainNode {
    return this.outputNode;
  }

  /**
   * Get state
   */
  getState(): Readonly<VintageEqState> {
    return this.state;
  }

  /**
   * Get params
   */
  getParams(): Readonly<VintageEqParameters> {
    return this.params;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.highPassFilter.disconnect();
    this.lowPassFilter.disconnect();
    this.bell1Filter.disconnect();
    this.bell2Filter.disconnect();
    this.saturationNode.disconnect();
  }
}

export default VintageEq;
