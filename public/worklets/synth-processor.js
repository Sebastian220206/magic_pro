// public/worklets/synth-processor.js
// (must be plain JS, not TS — browsers load this directly)

class SynthProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 20, maxValue: 20000 },
      { name: 'gain',      defaultValue: 0.5, minValue: 0,  maxValue: 1 },
    ];
  }

  constructor() {
    super();
    this.phase = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const frequency = parameters.frequency;
    const gain = parameters.gain;
    const sampleRate = 44100; // Use fixed sample rate for consistency

    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];
      for (let i = 0; i < outputChannel.length; i++) {
        const freq = frequency.length > 1 ? frequency[i] : frequency[0];
        const g    = gain.length > 1 ? gain[i] : gain[0];
        
        // Simple sine oscillator
        this.phase += (2 * Math.PI * freq) / sampleRate;
        if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
        
        outputChannel[i] = Math.sin(this.phase) * g;
      }
    }

    return true; // keep processor alive
  }
}

registerProcessor('synth-processor', SynthProcessor);
