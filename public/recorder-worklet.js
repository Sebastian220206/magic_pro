/**
 * recorder-worklet.js
 * Streamlined audio recording worklet.
 * Pure sample collection without passthrough (routing handled on main thread).
 */

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.batchSize = 1024; // Default batch size (configurable)
    this.buffer = new Float32Array(this.batchSize);
    this.bufferIndex = 0;

    this.port.onmessage = (event) => {
      const { type, config } = event.data;
      if (type === 'start') {
        this.recording = true;
        if (config?.batchSize) this.batchSize = config.batchSize;
        this.resetBuffer();
      } else if (type === 'stop' || type === 'pause') {
        this.recording = false;
        this.flush();
      } else if (type === 'resume') {
        this.recording = true;
      }
    };
  }

  resetBuffer() {
    if (this.buffer.length !== this.batchSize) {
      this.buffer = new Float32Array(this.batchSize);
    }
    this.bufferIndex = 0;
  }

  flush() {
    if (this.bufferIndex > 0) {
      const batch = this.buffer.subarray(0, this.bufferIndex);
      this.port.postMessage({ type: 'data', samples: new Float32Array(batch) });
      this.bufferIndex = 0;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (this.recording && input && input.length > 0 && input[0].length > 0) {
      const channelData = input[0];

      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];
        
        if (this.bufferIndex >= this.batchSize) {
          // Send batch and reset
          this.port.postMessage({ 
            type: 'data', 
            samples: new Float32Array(this.buffer) 
          });
          this.bufferIndex = 0;
        }
      }
    }

    // Never pass audio through to outputs in this worklet
    // Keep processor alive
    return true;
  }
}

registerProcessor('recorder', RecorderProcessor);
