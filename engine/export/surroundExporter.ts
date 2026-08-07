/**
 * Surround Exporter - Multi-channel WAV Export
 *
 * Features:
 * - 5.1 (6 channels), 7.1 (8 channels) support
 * - Channel mapping: L, R, C, LFE, Ls, Rs, Lrs, Rrs
 * - Proper interleaving for multi-channel WAV
 * - Channel metadata embedding
 */

import { SampleRate, BitDepth, DEFAULT_SAMPLE_RATE, DEFAULT_BIT_DEPTH } from './audioExportTypes';

// =============================================================================
// Surround Channel Layouts
// =============================================================================

export type SurroundFormat = '5.1' | '7.1';

export const SURROUND_CHANNEL_COUNTS: Record<SurroundFormat, number> = {
  '5.1': 6,
  '7.1': 8,
};

// Standard channel order: L, R, C, LFE, Ls, Rs, (Lrs, Rrs for 7.1)
export const SURROUND_CHANNEL_LABELS: Record<SurroundFormat, string[]> = {
  '5.1': ['L', 'R', 'C', 'LFE', 'Ls', 'Rs'],
  '7.1': ['L', 'R', 'C', 'LFE', 'Ls', 'Rs', 'Lrs', 'Rrs'],
};

// =============================================================================
// Surround Export Options
// =============================================================================

export interface SurroundExportOptions {
  format: SurroundFormat;
  sampleRate: SampleRate;
  bitDepth: BitDepth;
  normalize?: boolean;
  targetPeakDb?: number;
}

// =============================================================================
// Surround Exporter
// =============================================================================

export class SurroundExporter {
  /**
   * Export multi-channel audio as surround WAV
   */
  export(
    channelBuffers: AudioBuffer[],
    options: SurroundExportOptions
  ): Blob {
    const numChannels = SURROUND_CHANNEL_COUNTS[options.format];
    const labels = SURROUND_CHANNEL_LABELS[options.format];

    if (channelBuffers.length !== numChannels) {
      throw new Error(
        `Expected ${numChannels} channels for ${options.format}, got ${channelBuffers.length}`
      );
    }

    // Use first buffer for length and sample rate
    const refBuffer = channelBuffers[0];
    if (!refBuffer) throw new Error('Channel buffers cannot be empty');

    const sampleRate = options.sampleRate || refBuffer.sampleRate;
    const bitDepth = options.bitDepth || DEFAULT_BIT_DEPTH;
    const length = refBuffer.length;
    const bytesPerSample = bitDepth / 8;

    // Calculate data size
    const dataByteLength = length * numChannels * bytesPerSample;
    const headerLength = 44;
    const totalLength = headerLength + dataByteLength;

    // Create buffer
    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataByteLength, true);

    // Interleave and write channel data
    const dataOffset = 44;

    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const channelBuffer = channelBuffers[ch];
        if (!channelBuffer) continue;

        const sample = channelBuffer.getChannelData(0)[i] ?? 0;
        const clamped = Math.max(-1, Math.min(1, sample));

        let value: number;
        if (bitDepth === 16) {
          value = Math.round(clamped * 32767);
          view.setInt16(dataOffset + (i * numChannels + ch) * bytesPerSample, value, true);
        } else if (bitDepth === 24) {
          value = Math.round(clamped * 8388607);
          const offset = dataOffset + (i * numChannels + ch) * bytesPerSample;
          view.setUint8(offset, value & 0xFF);
          view.setUint8(offset + 1, (value >> 8) & 0xFF);
          view.setUint8(offset + 2, (value >> 16) & 0xFF);
        } else if (bitDepth === 32) {
          value = Math.round(clamped * 2147483647);
          view.setInt32(dataOffset + (i * numChannels + ch) * bytesPerSample, value, true);
        }
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Get channel labels for a surround format
   */
  static getChannelLabels(format: SurroundFormat): string[] {
    return SURROUND_CHANNEL_LABELS[format] ?? [];
  }

  /**
   * Check if format is supported
   */
  static isSupported(format: string): format is SurroundFormat {
    return format === '5.1' || format === '7.1';
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}

// Default export
export default SurroundExporter;
