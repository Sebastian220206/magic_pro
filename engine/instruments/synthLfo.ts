/**
 * Synth LFO Module
 * Low Frequency Oscillator for modulating synth parameters (pitch, filter, amplitude).
 */

export type LFOTarget = 'pitch' | 'filter' | 'amplitude';

export interface LFOParams {
  rate: number;       // Hz (0.1 - 20)
  depth: number;      // 0-1 modulation depth
  target: LFOTarget;  // what to modulate
  waveform: OscillatorType; // LFO waveform shape
}

export const defaultLFOParams: LFOParams = {
  rate: 1.0,
  depth: 0.0,
  target: 'filter',
  waveform: 'sine',
};

/**
 * LFO instance that connects to synth parameters.
 * One LFO per voice.
 */
export class SynthLFO {
  private ctx: AudioContext;
  private oscillator: OscillatorNode;
  private depthGain: GainNode;
  private params: LFOParams;
  private connected = false;

  constructor(ctx: AudioContext, params: LFOParams = defaultLFOParams) {
    this.ctx = ctx;
    this.params = { ...params };

    // Create LFO oscillator (sub-audio rate)
    this.oscillator = ctx.createOscillator();
    this.oscillator.type = params.waveform;
    this.oscillator.frequency.value = params.rate;

    // Depth scaling gain (0-1 -> parameter range)
    this.depthGain = ctx.createGain();
    this.depthGain.gain.value = params.depth;

    // Connect: oscillator -> depth gain
    this.oscillator.connect(this.depthGain);
  }

  /**
   * Start the LFO oscillator. Call once per voice lifecycle.
   */
  start(time?: number): void {
    this.oscillator.start(time);
  }

  /**
   * Connect LFO output to a target AudioParam.
   *
   * @param targetParam - The AudioParam to modulate (e.g., filter.frequency, osc.frequency, gain.gain)
   * @param baseValue - The base value of the target param (used to calculate modulation range)
   * @param modulationScale - Scale factor for the modulation (e.g., 50 for filter cutoff modulation in Hz)
   */
  connectToParam(targetParam: AudioParam, baseValue: number, modulationScale: number): void {
    if (this.connected) return;
    this.connected = true;

    // Scale depth gain output to the desired modulation range
    this.depthGain.gain.value = this.params.depth * modulationScale;

    // Connect LFO -> target param
    this.depthGain.connect(targetParam);
  }

  /**
   * Update LFO parameters in real time.
   */
  setRate(rate: number): void {
    this.params.rate = rate;
    this.oscillator.frequency.value = rate;
  }

  setDepth(depth: number): void {
    this.params.depth = depth;
    this.depthGain.gain.value = depth * (this.depthGain.gain.value / Math.max(this.params.depth, 0.001));
  }

  setWaveform(waveform: OscillatorType): void {
    this.params.waveform = waveform;
    this.oscillator.type = waveform;
  }

  /**
   * Get current params (for UI display).
   */
  getParams(): LFOParams {
    return { ...this.params };
  }

  /**
   * Disconnect and stop the LFO.
   */
  dispose(): void {
    try {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.depthGain.disconnect();
    } catch {
      // Already stopped/disconnected
    }
  }
}
