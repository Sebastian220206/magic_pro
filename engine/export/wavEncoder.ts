export interface WavEncodeOptions {
  sampleRate?: number;
  bitDepth?: 16 | 24 | 32;
}

const CHUNK_SIZE = 44100; // yield every ~1s of audio at 44.1kHz

export async function encodeWav(audioBuffer: AudioBuffer, options: WavEncodeOptions = {}): Promise<Blob> {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = options.sampleRate || audioBuffer.sampleRate;
  const bitDepth = options.bitDepth || 16;
  const bytesPerSample = bitDepth / 8;

  const length = audioBuffer.length;
  const dataByteLength = length * numChannels * bytesPerSample;
  const headerLength = 44;
  const totalLength = headerLength + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  const dataOffset = 44;
  const totalFrames = length;

  if (bitDepth === 16) {
    // Fast path: Int16Array view (batch memory write, no DataView per sample)
    const intView = new Int16Array(arrayBuffer, dataOffset, totalFrames * numChannels);
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < totalFrames; i++) {
        const sample = channelData[i];
        const clamped = Math.max(-1, Math.min(1, sample));
        intView[i * numChannels + ch] = clamped < 0 ? (clamped * 0x8000) | 0 : (clamped * 0x7FFF) | 0;
      }
      // Yield every channel to keep UI responsive for long files
      if (ch < numChannels - 1) await yieldToMain();
    }
  } else if (bitDepth === 24) {
    // 24-bit chunks with yields
    for (let start = 0; start < totalFrames; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, totalFrames);
      for (let i = start; i < end; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sample = audioBuffer.getChannelData(ch)[i];
          const clamped = Math.max(-1, Math.min(1, sample));
          const int24 = clamped < 0 ? (clamped * 0x800000) | 0 : (clamped * 0x7FFFFF) | 0;
          const byteOffset = dataOffset + (i * numChannels + ch) * 3;
          view.setInt8(byteOffset, int24 & 0xFF);
          view.setInt8(byteOffset + 1, (int24 >> 8) & 0xFF);
          view.setInt8(byteOffset + 2, (int24 >> 16) & 0xFF);
        }
      }
      await yieldToMain();
    }
  } else {
    // 32-bit float: Float32Array view (fast)
    const floatView = new Float32Array(arrayBuffer, dataOffset, totalFrames * numChannels);
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < totalFrames; i++) {
        const sample = channelData[i];
        floatView[i * numChannels + ch] = Math.max(-1, Math.min(1, sample));
      }
      if (ch < numChannels - 1) await yieldToMain();
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function yieldToMain(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
