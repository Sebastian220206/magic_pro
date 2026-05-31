class DSPWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.transportBuffer = null;
    this.parameterBuffer = null;
    this.activeGraph = null;

    this.port.onmessage = (event) => {
      const { type, sharedTransport, sharedParameters, graph } = event.data;
      
      if (type === 'INIT_BUFFERS') {
        this.transportBuffer = new Float64Array(sharedTransport);
        this.parameterBuffer = new Float32Array(sharedParameters);
      } else if (type === 'GRAPH_SWAP') {
        this.activeGraph = graph;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    // Read Clock
    let currentBeat = 0;
    let isPlaying = false;
    let bpm = 120;

    if (this.transportBuffer) {
      currentBeat = this.transportBuffer[0]; // CURRENT_BEAT
      bpm = this.transportBuffer[1]; // BPM
      isPlaying = this.transportBuffer[2] === 1.0; // PLAYING
    }

    // DSP execution happens here based on this.activeGraph
    
    // Pass-through or clear
    if (output) {
      for (let channel = 0; channel < output.length; channel++) {
        const out = output[channel];
        for (let i = 0; i < out.length; i++) {
          out[i] = 0.0;
        }
      }
    }

    // Advance Clock locally if playing
    if (isPlaying && this.transportBuffer) {
      // 128 frames at 48000hz
      const sampleRate = 48000;
      const deltaTime = 128 / sampleRate;
      const deltaBeat = (deltaTime * bpm) / 60;
      
      this.transportBuffer[0] = currentBeat + deltaBeat;
    }

    return true;
  }
}

registerProcessor('dsp-worklet-processor', DSPWorkletProcessor);
