/**
 * wavEncoder.ts
 * Float32 to WAV format encoder
 */

/**
 * Write a string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Encode AudioBuffer to WAV format Blob
 */
export function encodeWav(audioBuffer: AudioBuffer, bitDepth: 16 | 24 | 32 = 16): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = bitDepth === 32 ? 3 : 1; // 3 = IEEE float, 1 = PCM
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  // Interleave channels
  const samples = audioBuffer.length;
  const dataLength = samples * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numberOfChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write interleaved data
  const offset = 44;

  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = audioBuffer.getChannelData(ch)[i];
      const byteOffset = offset + (i * blockAlign) + (ch * bytesPerSample);

      if (bitDepth === 16) {
        // Convert to 16-bit PCM (-32768 to 32767)
        const intSample = Math.max(-1, Math.min(1, sample));
        const int16 = intSample < 0 ? intSample * 0x8000 : intSample * 0x7FFF;
        view.setInt16(byteOffset, int16, true);
      } else if (bitDepth === 24) {
        // Convert to 24-bit PCM
        const intSample = Math.max(-1, Math.min(1, sample));
        const int24 = Math.floor(intSample < 0 ? intSample * 0x800000 : intSample * 0x7FFFFF);
        view.setUint8(byteOffset, int24 & 0xFF);
        view.setUint8(byteOffset + 1, (int24 >> 8) & 0xFF);
        view.setUint8(byteOffset + 2, (int24 >> 16) & 0xFF);
      } else if (bitDepth === 32) {
        // 32-bit float
        view.setFloat32(byteOffset, sample, true);
      }
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Encode Float32Array to mono WAV
 */
export function encodeMonoWav(
  samples: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24 | 32 = 16
): Blob {
  const format = bitDepth === 32 ? 3 : 1;
  const bytesPerSample = bitDepth / 8;

  const dataLength = samples.length * bytesPerSample;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataLength);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write samples
  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const byteOffset = offset + i * bytesPerSample;

    if (bitDepth === 16) {
      const intSample = Math.max(-1, Math.min(1, sample));
      const int16 = intSample < 0 ? intSample * 0x8000 : intSample * 0x7FFF;
      view.setInt16(byteOffset, int16, true);
    } else if (bitDepth === 24) {
      const intSample = Math.max(-1, Math.min(1, sample));
      const int24 = Math.floor(intSample < 0 ? intSample * 0x800000 : intSample * 0x7FFFFF);
      view.setUint8(byteOffset, int24 & 0xFF);
      view.setUint8(byteOffset + 1, (int24 >> 8) & 0xFF);
      view.setUint8(byteOffset + 2, (int24 >> 16) & 0xFF);
    } else if (bitDepth === 32) {
      view.setFloat32(byteOffset, sample, true);
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Encode stereo interleaved Float32Array to WAV
 */
export function encodeStereoWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24 | 32 = 16
): Blob {
  if (left.length !== right.length) {
    throw new Error('Left and right channels must have same length');
  }

  const format = bitDepth === 32 ? 3 : 1;
  const bytesPerSample = bitDepth / 8;
  const samples = left.length;

  const dataLength = samples * 2 * bytesPerSample;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataLength);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, 2, true); // Stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2 * bytesPerSample, true);
  view.setUint16(32, 2 * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write interleaved stereo samples
  const offset = 44;
  for (let i = 0; i < samples; i++) {
    const leftSample = left[i];
    const rightSample = right[i];

    const leftOffset = offset + i * 2 * bytesPerSample;
    const rightOffset = leftOffset + bytesPerSample;

    if (bitDepth === 16) {
      const leftInt = Math.max(-1, Math.min(1, leftSample));
      const rightInt = Math.max(-1, Math.min(1, rightSample));
      view.setInt16(leftOffset, leftInt < 0 ? leftInt * 0x8000 : leftInt * 0x7FFF, true);
      view.setInt16(rightOffset, rightInt < 0 ? rightInt * 0x8000 : rightInt * 0x7FFF, true);
    } else if (bitDepth === 24) {
      const leftInt = Math.floor(Math.max(-1, Math.min(1, leftSample)) < 0 ? leftSample * 0x800000 : leftSample * 0x7FFFFF);
      const rightInt = Math.floor(Math.max(-1, Math.min(1, rightSample)) < 0 ? rightSample * 0x800000 : rightSample * 0x7FFFFF);
      view.setUint8(leftOffset, leftInt & 0xFF);
      view.setUint8(leftOffset + 1, (leftInt >> 8) & 0xFF);
      view.setUint8(leftOffset + 2, (leftInt >> 16) & 0xFF);
      view.setUint8(rightOffset, rightInt & 0xFF);
      view.setUint8(rightOffset + 1, (rightInt >> 8) & 0xFF);
      view.setUint8(rightOffset + 2, (rightInt >> 16) & 0xFF);
    } else if (bitDepth === 32) {
      view.setFloat32(leftOffset, leftSample, true);
      view.setFloat32(rightOffset, rightSample, true);
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Download WAV file
 */
export function downloadWav(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse WAV file to AudioBuffer
 */
export async function parseWav(
  arrayBuffer: ArrayBuffer,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const view = new DataView(arrayBuffer);

  // Check RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV file: not a RIFF file');
  }

  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV file: not a WAVE file');
  }

  // Parse fmt chunk
  const format = view.getUint16(20, true);
  const numChannels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);

  // Find data chunk
  let dataOffset = 36;
  while (dataOffset < arrayBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(dataOffset),
      view.getUint8(dataOffset + 1),
      view.getUint8(dataOffset + 2),
      view.getUint8(dataOffset + 3)
    );
    const chunkSize = view.getUint32(dataOffset + 4, true);

    if (chunkId === 'data') {
      dataOffset += 8;
      break;
    }

    dataOffset += 8 + chunkSize;
  }

  const bytesPerSample = bitsPerSample / 8;
  const dataLength = (arrayBuffer.byteLength - dataOffset) / (numChannels * bytesPerSample);

  // Create AudioBuffer
  const audioBuffer = audioContext.createBuffer(numChannels, dataLength, sampleRate);

  // Read samples
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);

    for (let i = 0; i < dataLength; i++) {
      const sampleOffset = dataOffset + (i * numChannels + ch) * bytesPerSample;

      if (bitsPerSample === 16) {
        channelData[i] = view.getInt16(sampleOffset, true) / 0x8000;
      } else if (bitsPerSample === 24) {
        const int24 =
          view.getUint8(sampleOffset) |
          (view.getUint8(sampleOffset + 1) << 8) |
          (view.getUint8(sampleOffset + 2) << 16);
        channelData[i] = (int24 & 0x800000 ? int24 - 0x1000000 : int24) / 0x800000;
      } else if (bitsPerSample === 32) {
        if (format === 3) {
          // Float
          channelData[i] = view.getFloat32(sampleOffset, true);
        } else {
          // Int
          channelData[i] = view.getInt32(sampleOffset, true) / 0x80000000;
        }
      }
    }
  }

  return audioBuffer;
}

export default {
  encodeWav,
  encodeMonoWav,
  encodeStereoWav,
  downloadWav,
  parseWav,
};
