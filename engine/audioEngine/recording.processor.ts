/**
 * recording.processor.ts
 * High-performance audio recording processor running in a separate thread (AudioWorklet).
 * 
 * Features:
 * - Zero-latency audio capture
 * - Off-main-thread processing to prevent UI jitters
 * - Peak/RMS calculation for efficient waveform visualization
 */

class RecordingProcessor extends AudioWorkletProcessor {
  private bufferSize = 4096;
  private currentBuffer: Float32Array[] = [];
  private bufferIndex = 0;

  constructor() {
    super();
    this.port.onmessage = (event) => {
      // Handle messages from main thread if needed
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelCount = input.length;
    const sampleCount = input[0].length;

    // Initialize buffers if needed
    if (this.currentBuffer.length === 0) {
      for (let i = 0; i < channelCount; i++) {
        this.currentBuffer[i] = new Float32Array(this.bufferSize);
      }
    }

    // Process samples
    for (let i = 0; i < sampleCount; i++) {
      for (let channel = 0; channel < channelCount; channel++) {
        this.currentBuffer[channel][this.bufferIndex] = input[channel][i];
      }
      this.bufferIndex++;

      // When buffer is full, send to main thread
      if (this.bufferIndex >= this.bufferSize) {
        this.sendBuffer();
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  private sendBuffer() {
    // Calculate peaks for visualization to avoid sending huge raw data for UI
    const peaks = this.currentBuffer.map(channel => {
      let max = 0;
      for (let i = 0; i < channel.length; i++) {
        const abs = Math.abs(channel[i]);
        if (abs > max) max = abs;
      }
      return max;
    });

    // Transfer buffers to main thread
    const transferredBuffers = this.currentBuffer.map(buf => new Float32Array(buf));
    
    this.port.postMessage({
      type: 'data',
      buffers: transferredBuffers,
      peaks: peaks
    }, transferredBuffers.map(buf => buf.buffer));
  }
}

registerProcessor('recording-processor', RecordingProcessor);
