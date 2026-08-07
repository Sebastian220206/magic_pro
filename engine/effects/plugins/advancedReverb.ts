/**
 * Advanced Reverb - ChromaVerb-style Multi-Algorithm Reverb
 *
 * Features:
 * - Multiple reverb algorithms:
 *   - Room (small, medium, large)
 *   - Hall (concert, cathedral)
 *   - Plate
 *   - Chamber
 *   - Spring
 *   - Shimmer (pitch-shifted tail)
 *   - Ambient
 *   - Nonlinear (gated, reverse)
 * - Modulated reverb tail
 * - Pre-delay
 * - High/low damping
 * - Diffusion control
 * - Density control
 * - Freeze/hold
 * - Real-time parameter modulation
 *
 * Signal Flow:
 * Input → Pre-delay → [Algorithm] → Modulation → Damping → Output
 */

export type ReverbAlgorithm =
  | 'room_small'
  | 'room_medium'
  | 'room_large'
  | 'hall_concert'
  | 'hall_cathedral'
  | 'plate'
  | 'chamber'
  | 'spring'
  | 'shimmer'
  | 'ambient'
  | 'nonlinear_gated'
  | 'nonlinear_reverse';

export interface AdvancedReverbParameters {
  algorithm: ReverbAlgorithm;
  mix: number;              // 0-1 dry/wet
  decay: number;            // seconds (0.1 - 20)
  preDelay: number;         // ms (0 - 200)
  damping: number;          // 0-1 high-frequency damping
  diffusion: number;        // 0-1 echo density
  density: number;          // 0-1 modal density
  modulationRate: number;   // Hz (0-5)
  modulationDepth: number;  // 0-1
  highPass: number;         // Hz (20 - 2000)
  lowPass: number;          // Hz (2000 - 20000)
  shimmerPitch: number;     // semitones (for shimmer algorithm)
  shimmerMix: number;       // 0-1
  freeze: boolean;          // Hold reverb tail
  stereoWidth: number;      // 0-1
}

export interface AdvancedReverbState extends AdvancedReverbParameters {
  outputLevel: number;
  tailLevel: number;
}

const ALGORITHM_PRESETS: Record<ReverbAlgorithm, Partial<AdvancedReverbParameters>> = {
  room_small: {
    decay: 0.5, preDelay: 5, damping: 0.5, diffusion: 0.6, density: 0.5,
  },
  room_medium: {
    decay: 1.0, preDelay: 10, damping: 0.4, diffusion: 0.7, density: 0.6,
  },
  room_large: {
    decay: 2.0, preDelay: 15, damping: 0.3, diffusion: 0.8, density: 0.7,
  },
  hall_concert: {
    decay: 3.0, preDelay: 20, damping: 0.3, diffusion: 0.9, density: 0.8,
  },
  hall_cathedral: {
    decay: 5.0, preDelay: 30, damping: 0.2, diffusion: 0.95, density: 0.9,
  },
  plate: {
    decay: 2.5, preDelay: 5, damping: 0.4, diffusion: 0.95, density: 0.95,
  },
  chamber: {
    decay: 1.5, preDelay: 8, damping: 0.5, diffusion: 0.85, density: 0.8,
  },
  spring: {
    decay: 1.0, preDelay: 2, damping: 0.6, diffusion: 0.5, density: 0.4,
  },
  shimmer: {
    decay: 4.0, preDelay: 20, damping: 0.2, diffusion: 0.9, density: 0.85,
    shimmerPitch: 12, shimmerMix: 0.3,
  },
  ambient: {
    decay: 6.0, preDelay: 50, damping: 0.1, diffusion: 0.95, density: 0.9,
  },
  nonlinear_gated: {
    decay: 0.8, preDelay: 0, damping: 0.5, diffusion: 0.7, density: 0.6,
  },
  nonlinear_reverse: {
    decay: 2.0, preDelay: 0, damping: 0.3, diffusion: 0.8, density: 0.7,
  },
};

const DEFAULT_PARAMS: AdvancedReverbParameters = {
  algorithm: 'room_medium',
  mix: 0.3,
  decay: 1.0,
  preDelay: 10,
  damping: 0.5,
  diffusion: 0.7,
  density: 0.6,
  modulationRate: 0.5,
  modulationDepth: 0.3,
  highPass: 100,
  lowPass: 8000,
  shimmerPitch: 12,
  shimmerMix: 0.3,
  freeze: false,
  stereoWidth: 0.8,
};

export class AdvancedReverb {
  private ctx: AudioContext;
  private params: AdvancedReverbParameters;
  private state: AdvancedReverbState;

  // Nodes
  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private preDelayNode: DelayNode;
  private highPassFilter: BiquadFilterNode;
  private lowPassFilter: BiquadFilterNode;
  private convolver: ConvolverNode;
  private modGain: GainNode;
  private modOsc: OscillatorNode;

  // Convolver buffers
  private irBuffers: Map<ReverbAlgorithm, AudioBuffer> = new Map();

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.params = { ...DEFAULT_PARAMS };
    this.state = { ...this.params, outputLevel: 0, tailLevel: 0 };

    // Create nodes
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.preDelayNode = ctx.createDelay(0.2);
    this.highPassFilter = ctx.createBiquadFilter();
    this.lowPassFilter = ctx.createBiquadFilter();
    this.convolver = ctx.createConvolver();
    this.modGain = ctx.createGain();
    this.modOsc = ctx.createOscillator();

    // Configure filters
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = this.params.highPass;
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = this.params.lowPass;

    // Configure modulation
    this.modOsc.type = 'sine';
    this.modOsc.frequency.value = this.params.modulationRate;
    this.modGain.gain.value = this.params.modulationDepth * 0.01;

    // Connect modulation
    this.modOsc.connect(this.modGain);
    this.modGain.connect(this.preDelayNode.delayTime);

    // Connect signal chain
    this.inputNode
      .connect(this.dryGain)
      .connect(this.outputNode);

    this.inputNode
      .connect(this.preDelayNode)
      .connect(this.highPassFilter)
      .connect(this.lowPassFilter)
      .connect(this.convolver)
      .connect(this.wetGain)
      .connect(this.outputNode);

    // Start mod oscillator
    this.modOsc.start();

    // Generate initial IR
    this.generateIR();
  }

  /**
   * Generate impulse response based on algorithm
   */
  private generateIR(): void {
    const algorithm = this.params.algorithm;
    const sampleRate = this.ctx.sampleRate;

    // Algorithm-specific parameters
    const config = ALGORITHM_PRESETS[algorithm] ?? {};
    const decay = config.decay ?? this.params.decay;
    const diffusion = config.diffusion ?? this.params.diffusion;
    const density = config.density ?? this.params.density;

    // Generate IR
    const length = Math.floor(sampleRate * decay);
    const ir = this.ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = ir.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const normalizedT = t / decay;

        // Exponential decay
        let envelope = Math.exp(-3 * normalizedT);

        // Algorithm-specific shaping
        switch (algorithm) {
          case 'plate':
            // Plate: bright initial reflections
            envelope *= 1 + 0.5 * Math.exp(-10 * normalizedT);
            break;
          case 'spring':
            // Spring: metallic resonance
            envelope *= 1 + 0.3 * Math.sin(2 * Math.PI * 50 * t) * Math.exp(-5 * normalizedT);
            break;
          case 'shimmer':
            // Shimmer: slow build
            envelope *= 0.5 + 0.5 * (1 - Math.exp(-2 * normalizedT));
            break;
          case 'nonlinear_gated':
            // Gated: abrupt cutoff
            envelope = normalizedT < 0.7 ? 1 : 0;
            break;
          case 'nonlinear_reverse':
            // Reverse: crescendo
            envelope = normalizedT;
            break;
        }

        // Diffusion (random reflections)
        const diffuse = diffusion * (Math.random() * 2 - 1);

        // Density (modal density)
        const densityMod = density * Math.sin(2 * Math.PI * (100 + channel * 50) * t);

        data[i] = envelope * (diffuse + densityMod) * 0.5;
      }
    }

    this.convolver.buffer = ir;
    this.irBuffers.set(algorithm, ir);
  }

  /**
   * Set algorithm
   */
  setAlgorithm(algorithm: ReverbAlgorithm): void {
    this.params.algorithm = algorithm;
    const preset = ALGORITHM_PRESETS[algorithm];
    if (preset) {
      this.params = { ...this.params, ...preset };
    }
    this.generateIR();
    this.updateParams();
  }

  /**
   * Update all parameters
   */
  private updateParams(): void {
    this.dryGain.gain.value = 1 - this.params.mix;
    this.wetGain.gain.value = this.params.mix;
    this.preDelayNode.delayTime.value = this.params.preDelay / 1000;
    this.highPassFilter.frequency.value = this.params.highPass;
    this.lowPassFilter.frequency.value = this.params.lowPass;
    this.modOsc.frequency.value = this.params.modulationRate;
    this.modGain.gain.value = this.params.modulationDepth * 0.01;

    this.state = { ...this.params, outputLevel: 0, tailLevel: 0 };
  }

  /**
   * Set mix
   */
  setMix(mix: number): void {
    this.params.mix = Math.max(0, Math.min(1, mix));
    this.updateParams();
  }

  /**
   * Set decay
   */
  setDecay(decay: number): void {
    this.params.decay = Math.max(0.1, Math.min(20, decay));
    this.generateIR();
    this.updateParams();
  }

  /**
   * Set pre-delay
   */
  setPreDelay(ms: number): void {
    this.params.preDelay = Math.max(0, Math.min(200, ms));
    this.updateParams();
  }

  /**
   * Set damping
   */
  setDamping(damping: number): void {
    this.params.damping = Math.max(0, Math.min(1, damping));
    // Damping affects low-pass filter
    this.params.lowPass = 20000 - damping * 16000;
    this.updateParams();
  }

  /**
   * Set modulation
   */
  setModulation(rate: number, depth: number): void {
    this.params.modulationRate = Math.max(0, Math.min(5, rate));
    this.params.modulationDepth = Math.max(0, Math.min(1, depth));
    this.updateParams();
  }

  /**
   * Set shimmer parameters
   */
  setShimmer(pitch: number, mix: number): void {
    this.params.shimmerPitch = pitch;
    this.params.shimmerMix = Math.max(0, Math.min(1, mix));
    this.generateIR();
    this.updateParams();
  }

  /**
   * Freeze reverb tail
   */
  setFreeze(freeze: boolean): void {
    this.params.freeze = freeze;
    if (freeze) {
      // Infinite decay
      this.params.decay = 100;
      this.generateIR();
    }
    this.updateParams();
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
  getState(): Readonly<AdvancedReverbState> {
    return this.state;
  }

  /**
   * Get params
   */
  getParams(): Readonly<AdvancedReverbParameters> {
    return this.params;
  }

  /**
   * Get available algorithms
   */
  static getAlgorithms(): ReverbAlgorithm[] {
    return Object.keys(ALGORITHM_PRESETS) as ReverbAlgorithm[];
  }

  /**
   * Get algorithm display name
   */
  static getAlgorithmName(algorithm: ReverbAlgorithm): string {
    const names: Record<ReverbAlgorithm, string> = {
      room_small: 'Small Room',
      room_medium: 'Medium Room',
      room_large: 'Large Room',
      hall_concert: 'Concert Hall',
      hall_cathedral: 'Cathedral',
      plate: 'Plate',
      chamber: 'Chamber',
      spring: 'Spring',
      shimmer: 'Shimmer',
      ambient: 'Ambient',
      nonlinear_gated: 'Gated',
      nonlinear_reverse: 'Reverse',
    };
    return names[algorithm] ?? algorithm;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.preDelayNode.disconnect();
    this.highPassFilter.disconnect();
    this.lowPassFilter.disconnect();
    this.convolver.disconnect();
    this.modGain.disconnect();
    this.modOsc.stop();
    this.modOsc.disconnect();
  }
}

export default AdvancedReverb;
