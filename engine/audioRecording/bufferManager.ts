/**
 * bufferManager.ts
 * PCM chunk storage and efficient merging
 */

/**
 * RecordingBufferManager - Manages audio chunks during recording
 * Uses chunked storage to avoid large allocations
 */
export class RecordingBufferManager {
  private chunks: Float32Array[] = [];
  private totalSamples = 0;
  private maxChunkSize: number;
  private currentChunk: Float32Array | null = null;
  private currentChunkIndex = 0;

  constructor(maxChunkSize = 16384) {
    this.maxChunkSize = maxChunkSize;
  }

  /**
   * Add a chunk of audio data
   */
  addChunk(data: Float32Array): void {
    // If we have a current chunk being filled, try to append
    if (this.currentChunk && this.currentChunkIndex < this.maxChunkSize) {
      const remaining = this.maxChunkSize - this.currentChunkIndex;
      const toCopy = Math.min(data.length, remaining);

      this.currentChunk.set(data.subarray(0, toCopy), this.currentChunkIndex);
      this.currentChunkIndex += toCopy;
      this.totalSamples += toCopy;

      // If there's more data, store the rest in a new chunk
      if (toCopy < data.length) {
        this.finalizeCurrentChunk();
        this.addChunk(data.subarray(toCopy));
      }
    } else {
      // Start a new chunk
      this.finalizeCurrentChunk();
      this.currentChunk = new Float32Array(this.maxChunkSize);
      this.currentChunkIndex = 0;
      this.addChunk(data);
    }
  }

  /**
   * Finalize the current chunk and add to storage
   */
  private finalizeCurrentChunk(): void {
    if (this.currentChunk && this.currentChunkIndex > 0) {
      // Trim to actual size
      const trimmed = this.currentChunk.subarray(0, this.currentChunkIndex);
      this.chunks.push(trimmed);
    }
    this.currentChunk = null;
    this.currentChunkIndex = 0;
  }

  /**
   * Get total number of samples stored
   */
  getTotalSamples(): number {
    return this.totalSamples;
  }

  /**
   * Get number of chunks
   */
  getChunkCount(): number {
    return this.chunks.length + (this.currentChunk && this.currentChunkIndex > 0 ? 1 : 0);
  }

  /**
   * Get all chunks as raw arrays
   */
  getChunks(): Float32Array[] {
    this.finalizeCurrentChunk();
    return [...this.chunks];
  }

  /**
   * Merge all chunks into a single Float32Array
   */
  mergeChunks(): Float32Array {
    this.finalizeCurrentChunk();

    if (this.chunks.length === 0) {
      return new Float32Array(0);
    }

    if (this.chunks.length === 1) {
      return this.chunks[0];
    }

    // Allocate result buffer
    const result = new Float32Array(this.totalSamples);

    // Copy chunks into result
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Convert chunks to an AudioBuffer
   */
  toAudioBuffer(audioContext: AudioContext, channels: number, sampleRate: number): AudioBuffer {
    const mergedData = this.mergeChunks();
    const duration = mergedData.length / sampleRate;

    // Create AudioBuffer
    const audioBuffer = audioContext.createBuffer(
      channels,
      mergedData.length,
      sampleRate
    );

    // Fill all channels with the same data (mono source)
    for (let ch = 0; ch < channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      channelData.set(mergedData);
    }

    return audioBuffer;
  }

  /**
   * Create interleaved stereo buffer from mono chunks
   */
  toStereoAudioBuffer(audioContext: AudioContext, sampleRate: number): AudioBuffer {
    const mergedData = this.mergeChunks();
    const length = mergedData.length;

    const audioBuffer = audioContext.createBuffer(2, length, sampleRate);

    // Copy to both channels
    audioBuffer.getChannelData(0).set(mergedData);
    audioBuffer.getChannelData(1).set(mergedData);

    return audioBuffer;
  }

  /**
   * Get a slice of the buffer as a new Float32Array
   */
  getSlice(startSample: number, endSample: number): Float32Array {
    this.finalizeCurrentChunk();

    const length = Math.min(endSample - startSample, this.totalSamples - startSample);
    const result = new Float32Array(length);

    let resultIndex = 0;
    let currentSample = 0;

    for (const chunk of this.chunks) {
      const chunkStart = currentSample;
      const chunkEnd = currentSample + chunk.length;

      if (chunkEnd > startSample && chunkStart < endSample) {
        const copyStart = Math.max(0, startSample - chunkStart);
        const copyEnd = Math.min(chunk.length, endSample - chunkStart);
        const toCopy = copyEnd - copyStart;

        result.set(chunk.subarray(copyStart, copyEnd), resultIndex);
        resultIndex += toCopy;
      }

      currentSample = chunkEnd;

      if (currentSample >= endSample) break;
    }

    return result;
  }

  /**
   * Trim silence from start and end (simple threshold-based)
   */
  trimSilence(threshold = 0.001): void {
    this.finalizeCurrentChunk();

    if (this.chunks.length === 0) return;

    const merged = this.mergeChunks();

    // Find start (first sample above threshold)
    let start = 0;
    for (let i = 0; i < merged.length; i++) {
      if (Math.abs(merged[i]) > threshold) {
        start = i;
        break;
      }
    }

    // Find end (last sample above threshold)
    let end = merged.length;
    for (let i = merged.length - 1; i >= 0; i--) {
      if (Math.abs(merged[i]) > threshold) {
        end = i + 1;
        break;
      }
    }

    // If all silence, keep a small portion
    if (start >= end) {
      start = 0;
      end = Math.min(merged.length, 100);
    }

    // Re-chunk the trimmed data
    this.clear();
    this.addChunk(merged.subarray(start, end));
  }

  /**
   * Apply gain to all chunks
   */
  applyGain(gain: number): void {
    this.finalizeCurrentChunk();

    for (const chunk of this.chunks) {
      for (let i = 0; i < chunk.length; i++) {
        chunk[i] *= gain;
      }
    }
  }

  /**
   * Normalize audio to peak level
   */
  normalize(targetPeak = 0.95): void {
    this.finalizeCurrentChunk();

    // Find peak
    let peak = 0;
    for (const chunk of this.chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const abs = Math.abs(chunk[i]);
        if (abs > peak) peak = abs;
      }
    }

    if (peak > 0) {
      const gain = targetPeak / peak;
      this.applyGain(gain);
    }
  }

  /**
   * Clear all chunks
   */
  clear(): void {
    this.chunks = [];
    this.currentChunk = null;
    this.currentChunkIndex = 0;
    this.totalSamples = 0;
  }

  /**
   * Get memory usage estimate in bytes
   */
  getMemoryUsage(): number {
    let bytes = 0;
    for (const chunk of this.chunks) {
      bytes += chunk.length * 4; // Float32 = 4 bytes
    }
    if (this.currentChunk) {
      bytes += this.currentChunk.length * 4;
    }
    return bytes;
  }

  /**
   * Export to Blob (WAV format helper)
   */
  toBlob(mimeType = 'audio/wav'): Blob | null {
    const merged = this.mergeChunks();
    if (merged.length === 0) return null;

    // Create a proper ArrayBuffer for the Blob
    const arrayBuffer = merged.buffer.slice(
      merged.byteOffset,
      merged.byteOffset + merged.byteLength
    ) as ArrayBuffer;
    return new Blob([arrayBuffer], { type: mimeType });
  }
}

// Convenience functions
export function createBufferManager(maxChunkSize?: number): RecordingBufferManager {
  return new RecordingBufferManager(maxChunkSize);
}

export default RecordingBufferManager;
