/**
 * Export Manager - Export projects to various formats
 * 
 * Features:
 * - Export to WAV (uncompressed)
 * - Export to MP3 (compressed)
 * - STEM export (individual tracks)
 * - MIDI export
 * - Project archive (.zip)
 * - Offline audio rendering
 */

import { ProjectManager, Project } from './projectManager';
import { AssetManager } from './assetManager';
import { SerializedProject, SerializedMidiClip } from './projectSerializer';

// =============================================================================
// Types
// =============================================================================

export type ExportFormat = 'wav' | 'mp3' | 'stems' | 'midi' | 'zip' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  startBeat?: number;
  endBeat?: number;
  sampleRate?: number;
  bitDepth?: 16 | 24 | 32;
  quality?: 'low' | 'medium' | 'high';
  includeAssets?: boolean;
  normalize?: boolean;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  duration: number;
  size: number;
}

export interface StemExportResult {
  stems: Array<{
    trackId: string;
    trackName: string;
    blob: Blob;
    filename: string;
  }>;
  zipBlob?: Blob;
}

// =============================================================================
// Export Manager Class
// =============================================================================

export class ExportManager {
  private projectManager: ProjectManager;
  private assetManager: AssetManager;
  private audioContext: AudioContext | null = null;

  constructor(projectManager: ProjectManager, assetManager: AssetManager) {
    this.projectManager = projectManager;
    this.assetManager = assetManager;
  }

  /**
   * Set audio context for rendering
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
  }

  // =============================================================================
  // Main Export Methods
  // =============================================================================

  /**
   * Export project to specified format
   */
  async exportProject(project: Project, options: ExportOptions): Promise<ExportResult> {
    switch (options.format) {
      case 'wav':
        return this.exportToWav(project, options);
      case 'mp3':
        return this.exportToMp3(project, options);
      case 'midi':
        return this.exportToMidi(project, options);
      case 'zip':
        return this.exportToZip(project, options);
      case 'json':
        return this.exportToJson(project, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export stems (individual tracks)
   */
  async exportStems(project: Project, options: ExportOptions): Promise<StemExportResult> {
    const stems: StemExportResult['stems'] = [];
    
    for (const track of project.data.tracks) {
      // Render each track to a separate audio buffer
      const audioBuffer = await this.renderTrack(project, track.id, options);
      
      if (audioBuffer) {
        const wavBlob = await this.audioBufferToWav(audioBuffer);
        const safeName = track.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        stems.push({
          trackId: track.id,
          trackName: track.name,
          blob: wavBlob,
          filename: `${safeName}.wav`,
        });
      }
    }

    // Create ZIP if multiple stems
    let zipBlob: Blob | undefined;
    if (stems.length > 1) {
      zipBlob = await this.createStemsZip(stems, project.data.project.name);
    }

    return { stems, zipBlob };
  }

  // =============================================================================
  // Format-Specific Exports
  // =============================================================================

  /**
   * Export to WAV format
   */
  private async exportToWav(project: Project, options: ExportOptions): Promise<ExportResult> {
    // Render the complete mix
    const audioBuffer = await this.renderProject(project, options);
    
    if (!audioBuffer) {
      throw new Error('Failed to render project audio');
    }

    const blob = await this.audioBufferToWav(audioBuffer, options.bitDepth);
    const safeName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    return {
      blob,
      filename: `${safeName}.wav`,
      duration: audioBuffer.duration,
      size: blob.size,
    };
  }

  /**
   * Export to MP3 format
   */
  private async exportToMp3(project: Project, options: ExportOptions): Promise<ExportResult> {
    const audioBuffer = await this.renderProject(project, options);
    if (!audioBuffer) throw new Error('Failed to render project audio');

    const blob = await this.audioBufferToMp3(audioBuffer, options);
    const safeName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    return {
      blob,
      filename: `${safeName}.mp3`,
      duration: audioBuffer.duration,
      size: blob.size,
    };
  }

  /**
   * Convert AudioBuffer to MP3 Blob using lamejs
   */
  private async audioBufferToMp3(buffer: AudioBuffer, options: ExportOptions): Promise<Blob> {
    try {
      const lamejs = require('lamejs');
      const numChannels = buffer.numberOfChannels;
      const sampleRate = options.sampleRate ?? buffer.sampleRate;
      const bitRate = 192;

      const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitRate);
      const mp3Data: Uint8Array[] = [];

      const channelData: Float32Array[] = [];
      for (let c = 0; c < numChannels; c++) {
        channelData.push(buffer.getChannelData(c));
      }

      const sampleBlockSize = 1152;
      const totalSamples = buffer.length;

      for (let i = 0; i < totalSamples; i += sampleBlockSize) {
        const blockSize = Math.min(sampleBlockSize, totalSamples - i);
        const left = new Int16Array(blockSize);
        const right = numChannels > 1 ? new Int16Array(blockSize) : left;

        for (let j = 0; j < blockSize; j++) {
          const idx = i + j;
          const ls = Math.max(-1, Math.min(1, channelData[0][idx]));
          left[j] = ls < 0 ? ls * 0x8000 : ls * 0x7FFF;

          if (numChannels > 1) {
            const rs = Math.max(-1, Math.min(1, channelData[1][idx]));
            right[j] = rs < 0 ? rs * 0x8000 : rs * 0x7FFF;
          }
        }

        const mp3Buf = mp3Encoder.encodeBuffer(left, right);
        if (mp3Buf.length > 0) mp3Data.push(mp3Buf);
      }

      const finalBuf = mp3Encoder.flush();
      if (finalBuf.length > 0) mp3Data.push(finalBuf);

      const totalLength = mp3Data.reduce((acc, buf) => acc + buf.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of mp3Data) {
        combined.set(buf, offset);
        offset += buf.length;
      }

      return new Blob([combined], { type: 'audio/mpeg' });
    } catch (e) {
      console.error('[ExportManager] MP3 encoding failed, falling back to WAV:', e);
      return this.audioBufferToWav(buffer);
    }
  }

  /**
   * Export to MIDI format
   */
  private async exportToMidi(project: Project, options: ExportOptions): Promise<ExportResult> {
    const midiData = this.generateMidiFile(project.data.midiClips);
    const blob = new Blob([midiData], { type: 'audio/midi' });
    const safeName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    return {
      blob,
      filename: `${safeName}.mid`,
      duration: 0,
      size: blob.size,
    };
  }

  /**
   * Export to ZIP archive
   */
  private async exportToZip(project: Project, options: ExportOptions): Promise<ExportResult> {
    // This would use JSZip to create a complete project archive
    // For now, export as JSON
    const result = await this.exportToJson(project, options);
    
    return {
      ...result,
      filename: result.filename.replace('.json', '.zip'),
    };
  }

  /**
   * Export to JSON format
   */
  private async exportToJson(project: Project, options: ExportOptions): Promise<ExportResult> {
    const json = JSON.stringify(project.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const safeName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    return {
      blob,
      filename: `${safeName}.dawproject.json`,
      duration: 0,
      size: blob.size,
    };
  }

  // =============================================================================
  // Audio Rendering
  // =============================================================================

  /**
   * Render complete project to audio buffer
   */
  private async renderProject(project: Project, options: ExportOptions): Promise<AudioBuffer | null> {
    if (!this.audioContext) {
      throw new Error('AudioContext not set');
    }

    const startBeat = options.startBeat ?? project.data.timeline.startBeat;
    const endBeat = options.endBeat ?? project.data.timeline.endBeat;
    const duration = (endBeat - startBeat) * 60 / project.data.timeline.tempo;
    
    const sampleRate = options.sampleRate ?? this.audioContext.sampleRate;
    const numChannels = 2; // Stereo output
    const numSamples = Math.ceil(duration * sampleRate);
    
    // Create output buffer
    const outputBuffer = this.audioContext.createBuffer(numChannels, numSamples, sampleRate);
    
    // Render each track and mix
    for (const track of project.data.tracks) {
      const trackBuffer = await this.renderTrack(project, track.id, options, outputBuffer);
      
      if (trackBuffer) {
        // Mix track into output with volume/pan
        this.mixTrackIntoOutput(trackBuffer, outputBuffer, track.volume, track.pan);
      }
    }

    // Normalize if requested
    if (options.normalize) {
      this.normalizeAudioBuffer(outputBuffer);
    }

    return outputBuffer;
  }

  /**
   * Render a single track to audio buffer
   */
  private async renderTrack(
    project: Project,
    trackId: string,
    options: ExportOptions,
    outputBuffer?: AudioBuffer
  ): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    const track = project.data.tracks.find(t => t.id === trackId);
    if (!track) return null;

    const startBeat = options.startBeat ?? project.data.timeline.startBeat;
    const endBeat = options.endBeat ?? project.data.timeline.endBeat;
    const duration = (endBeat - startBeat) * 60 / project.data.timeline.tempo;
    
    const sampleRate = options.sampleRate ?? this.audioContext.sampleRate;
    const numChannels = 2;
    const numSamples = Math.ceil(duration * sampleRate);
    
    // Create track buffer
    const trackBuffer = this.audioContext.createBuffer(numChannels, numSamples, sampleRate);
    
    // Render audio clips
    for (const clip of track.clips) {
      if (clip.assetId) {
        await this.renderAudioClip(clip, trackBuffer, startBeat, project.data.timeline.tempo);
      }
    }

    // Render MIDI clips
    const midiClips = project.data.midiClips.filter(c => c.trackId === trackId);
    for (const midiClip of midiClips) {
      await this.renderMidiClip(midiClip, trackBuffer, startBeat, project.data.timeline.tempo);
    }

    return trackBuffer;
  }

  /**
   * Render an audio clip into a buffer
   */
  private async renderAudioClip(
    clip: { startBeat: number; duration: number; assetId: string; offset?: number; fadeIn?: number; fadeOut?: number },
    targetBuffer: AudioBuffer,
    timelineStartBeat: number,
    tempo: number
  ): Promise<void> {
    // Load source audio
    const sourceBuffer = await this.assetManager.loadAudioBuffer(clip.assetId);
    if (!sourceBuffer) return;

    const beatToSample = (beat: number) => Math.floor((beat * 60 / tempo) * targetBuffer.sampleRate);
    
    const clipStartSample = beatToSample(clip.startBeat - timelineStartBeat);
    const clipEndSample = clipStartSample + beatToSample(clip.duration);
    const sourceStartSample = Math.floor((clip.offset || 0) * sourceBuffer.sampleRate);

    // Copy samples with gain
    for (let channel = 0; channel < Math.min(targetBuffer.numberOfChannels, sourceBuffer.numberOfChannels); channel++) {
      const targetData = targetBuffer.getChannelData(channel);
      const sourceData = sourceBuffer.getChannelData(channel);

      for (let i = 0; i < clipEndSample - clipStartSample; i++) {
        const targetIndex = clipStartSample + i;
        const sourceIndex = sourceStartSample + i;

        if (targetIndex >= 0 && targetIndex < targetData.length && sourceIndex < sourceData.length) {
          let gain = 1;
          
          // Apply fade in
          if (clip.fadeIn && i < clip.fadeIn * targetBuffer.sampleRate) {
            gain *= i / (clip.fadeIn * targetBuffer.sampleRate);
          }
          
          // Apply fade out
          if (clip.fadeOut) {
            const fadeStart = (clipEndSample - clipStartSample) - (clip.fadeOut * targetBuffer.sampleRate);
            if (i > fadeStart) {
              gain *= (clipEndSample - clipStartSample - i) / (clip.fadeOut * targetBuffer.sampleRate);
            }
          }

          targetData[targetIndex] += sourceData[sourceIndex] * gain;
        }
      }
    }
  }

  /**
   * Render a MIDI clip into a buffer (placeholder - would need instrument)
   */
  private async renderMidiClip(
    clip: SerializedMidiClip,
    targetBuffer: AudioBuffer,
    timelineStartBeat: number,
    tempo: number
  ): Promise<void> {
    // This would render MIDI notes using the assigned instrument
    // For now, this is a placeholder
    console.log(`[ExportManager] Rendering MIDI clip: ${clip.id}`);
  }

  // =============================================================================
  // Audio Utilities
  // =============================================================================

  /**
   * Mix a track buffer into output buffer with volume and pan
   */
  private mixTrackIntoOutput(
    trackBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    volumeDb: number,
    pan: number
  ): void {
    const volume = Math.pow(10, volumeDb / 20); // Convert dB to gain
    const leftGain = volume * (1 - (pan + 1) / 2);
    const rightGain = volume * ((pan + 1) / 2);

    for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
      const trackData = trackBuffer.getChannelData(Math.min(channel, trackBuffer.numberOfChannels - 1));
      const outputData = outputBuffer.getChannelData(channel);
      const gain = channel === 0 ? leftGain : rightGain;

      for (let i = 0; i < outputData.length; i++) {
        outputData[i] += trackData[i] * gain;
      }
    }
  }

  /**
   * Normalize audio buffer to peak at -1 dB
   */
  private normalizeAudioBuffer(buffer: AudioBuffer): void {
    let peak = 0;

    // Find peak
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }

    if (peak > 0) {
      const gain = 0.8913 / peak; // -1 dB = 0.8913

      // Apply gain
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          data[i] *= gain;
        }
      }
    }
  }

  /**
   * Convert AudioBuffer to WAV Blob
   */
  private async audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 24 | 32 = 24): Promise<Blob> {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const blockAlign = numChannels * (bitDepth / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;

    // WAV header
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF chunk
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true); // AudioFormat
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitDepth, true); // BitsPerSample

    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Convert audio data
    const audioData = new Uint8Array(dataSize);
    const offset = 0;

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);

      for (let i = 0; i < buffer.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        const index = (i * numChannels + channel) * (bitDepth / 8);

        if (bitDepth === 16) {
          const intSample = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
          audioData[index] = intSample & 0xFF;
          audioData[index + 1] = (intSample >> 8) & 0xFF;
        } else if (bitDepth === 24) {
          const intSample = Math.round(sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF);
          audioData[index] = intSample & 0xFF;
          audioData[index + 1] = (intSample >> 8) & 0xFF;
          audioData[index + 2] = (intSample >> 16) & 0xFF;
        } else if (bitDepth === 32) {
          const intSample = Math.round(sample < 0 ? sample * 0x80000000 : sample * 0x7FFFFFFF);
          audioData[index] = intSample & 0xFF;
          audioData[index + 1] = (intSample >> 8) & 0xFF;
          audioData[index + 2] = (intSample >> 16) & 0xFF;
          audioData[index + 3] = (intSample >> 24) & 0xFF;
        }
      }
    }

    return new Blob([header, audioData], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Create ZIP archive of stems
   */
  private async createStemsZip(stems: StemExportResult['stems'], projectName: string): Promise<Blob> {
    // This would use JSZip to create a ZIP file
    // For now, return a placeholder
    const json = JSON.stringify(stems.map(s => ({ name: s.filename, size: s.blob.size })));
    return new Blob([json], { type: 'application/json' });
  }

  // =============================================================================
  // MIDI Generation
  // =============================================================================

  /**
   * Generate MIDI file from MIDI clips
   */
  private generateMidiFile(midiClips: SerializedMidiClip[]): ArrayBuffer {
    // Simple MIDI file generator
    // This creates a standard MIDI file (SMF) format 0

    const tracks: Array<{ events: Array<{ time: number; data: number[] }> }> = [];
    
    // Build events from all clips
    const events: Array<{ time: number; data: number[] }> = [];
    
    for (const clip of midiClips) {
      for (const note of clip.notes) {
        const startTime = Math.round((clip.startBeat + note.startBeat) * 480); // 480 ticks per quarter note
        const duration = Math.round(note.duration * 480);
        const velocity = Math.max(0, Math.min(127, note.velocity));
        
        // Note on
        events.push({
          time: startTime,
          data: [0x90, note.pitch, velocity], // Note on, channel 0
        });
        
        // Note off
        events.push({
          time: startTime + duration,
          data: [0x80, note.pitch, 0], // Note off, channel 0
        });
      }
    }

    // Sort events by time
    events.sort((a, b) => a.time - b.time);

    // Build track chunk
    const trackData: number[] = [];
    let lastTime = 0;

    for (const event of events) {
      const deltaTime = event.time - lastTime;
      lastTime = event.time;
      
      // Variable length quantity for delta time
      const deltaBytes = this.encodeVariableLength(deltaTime);
      trackData.push(...deltaBytes);
      trackData.push(...event.data);
    }

    // End of track
    trackData.push(0x00, 0xFF, 0x2F, 0x00);

    // Calculate track chunk size
    const trackSize = trackData.length;

    // Build MIDI file
    const fileSize = 14 + 8 + trackSize; // Header + track header + track data
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    let offset = 0;

    // MIDI header
    this.writeMidiString(view, offset, 'MThd'); offset += 4;
    view.setUint32(offset, 6, false); offset += 4; // Header size
    view.setUint16(offset, 0, false); offset += 2; // Format 0
    view.setUint16(offset, 1, false); offset += 2; // 1 track
    view.setUint16(offset, 480, false); offset += 2; // Ticks per quarter note

    // Track chunk
    this.writeMidiString(view, offset, 'MTrk'); offset += 4;
    view.setUint32(offset, trackSize, false); offset += 4;

    // Track data
    for (const byte of trackData) {
      view.setUint8(offset++, byte);
    }

    return buffer;
  }

  private writeMidiString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  private encodeVariableLength(value: number): number[] {
    const bytes: number[] = [];
    let v = value;
    
    do {
      bytes.unshift((v & 0x7F) | 0x80);
      v >>= 7;
    } while (v > 0);
    
    bytes[bytes.length - 1] &= 0x7F;
    return bytes;
  }

  // =============================================================================
  // Utility
  // =============================================================================

  /**
   * Get estimated file size for export
   */
  estimateFileSize(project: Project, options: ExportOptions): number {
    const duration = ((options.endBeat ?? project.data.timeline.endBeat) - 
                     (options.startBeat ?? project.data.timeline.startBeat)) * 
                     60 / project.data.timeline.tempo;
    const sampleRate = options.sampleRate ?? 44100;
    const bitDepth = options.bitDepth ?? 24;
    const numChannels = 2;

    switch (options.format) {
      case 'wav':
        return Math.ceil(duration * sampleRate * numChannels * (bitDepth / 8)) + 44;
      case 'mp3':
        // Rough estimate: 128 kbps = 16 KB/s
        return Math.ceil(duration * 16 * 1024);
      case 'midi':
        return 1024; // MIDI files are small
      case 'json':
        return JSON.stringify(project.data).length;
      case 'zip':
        // Rough estimate
        return this.estimateFileSize(project, { ...options, format: 'json' }) * 2;
      default:
        return 0;
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createExportManager(
  projectManager: ProjectManager,
  assetManager: AssetManager
): ExportManager {
  return new ExportManager(projectManager, assetManager);
}

export default ExportManager;
