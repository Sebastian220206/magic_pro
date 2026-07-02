/**
 * Asset Manager - Audio file and asset management
 * 
 * Features:
 * - Import audio files (WAV, MP3, etc.)
 * - Store audio buffers in IndexedDB
 * - Generate waveform data
 * - Deduplicate assets by hash
 * - Lazy loading of audio buffers
 * - Reference counting for garbage collection
 */

import { IndexedDBAdapter, AssetMetadata, AssetData } from './indexedDBAdapter';

// =============================================================================
// Types
// =============================================================================

export interface AudioAsset extends AssetMetadata {
  type: 'audio';
  duration: number;
  sampleRate: number;
  channels: number;
}

export interface MidiAsset extends AssetMetadata {
  type: 'midi';
}

export type Asset = AudioAsset | MidiAsset;

export interface ImportAudioResult {
  asset: AudioAsset;
  isDuplicate: boolean;
  originalAssetId?: string;
}

export interface WaveformPeaks {
  min: Float32Array;
  max: Float32Array;
  samplesPerPeak: number;
}

// =============================================================================
// Asset Manager Class
// =============================================================================

export class AssetManager {
  private db: IndexedDBAdapter;
  private audioContext: AudioContext | null = null;
  private loadedBuffers: Map<string, AudioBuffer> = new Map();
  private referenceCounts: Map<string, number> = new Map();

  constructor(db: IndexedDBAdapter) {
    this.db = db;
  }

  /**
   * Set the audio context for decoding audio
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
  }

  // =============================================================================
  // Audio Import
  // =============================================================================

  /**
   * Import an audio file
   */
  async importAudio(file: File, projectId: string): Promise<ImportAudioResult> {
    // Check for duplicates by computing hash
    const arrayBuffer = await file.arrayBuffer();
    const hash = await this.computeHash(arrayBuffer);
    
    // Check if asset already exists
    const existingAsset = await this.db.findAssetByHash(hash);
    if (existingAsset) {
      // Update usage to include this project
      const usedBy = [...existingAsset.usedBy, projectId];
      await this.db.updateAssetUsage(existingAsset.id, usedBy);
      
      console.log(`[AssetManager] Using existing asset: ${existingAsset.name}`);
      
      return {
        asset: existingAsset as AudioAsset,
        isDuplicate: true,
        originalAssetId: existingAsset.id,
      };
    }

    // Decode audio to get metadata
    if (!this.audioContext) {
      throw new Error('AudioContext not set');
    }

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
    
    // Generate asset ID
    const assetId = `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create metadata
    const metadata: AudioAsset = {
      id: assetId,
      type: 'audio',
      name: file.name,
      hash,
      size: file.size,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      createdAt: Date.now(),
      usedBy: [projectId],
    };

    // Save to database
    await this.db.saveAsset(assetId, arrayBuffer, metadata);
    
    // Cache the decoded buffer
    this.loadedBuffers.set(assetId, audioBuffer);
    this.referenceCounts.set(assetId, 1);
    
    // Generate and save waveform data
    const waveform = this.generateWaveform(audioBuffer);
    await this.db.saveWaveform(assetId, waveform.peaks, waveform.samplesPerPeak);
    
    console.log(`[AssetManager] Imported audio: ${file.name} (${metadata.duration}s)`);
    
    return {
      asset: metadata,
      isDuplicate: false,
    };
  }

  /**
   * Import multiple audio files
   */
  async importMultipleAudio(files: File[], projectId: string): Promise<ImportAudioResult[]> {
    const results: ImportAudioResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.importAudio(file, projectId);
        results.push(result);
      } catch (error) {
        console.error(`[AssetManager] Failed to import ${file.name}:`, error);
        // Continue with other files
      }
    }
    
    return results;
  }

  // =============================================================================
  // Asset Loading
  // =============================================================================

  /**
   * Load audio buffer (lazy loading)
   */
  async loadAudioBuffer(assetId: string): Promise<AudioBuffer | null> {
    // Check if already loaded
    if (this.loadedBuffers.has(assetId)) {
      // Increment reference count
      const count = this.referenceCounts.get(assetId) || 0;
      this.referenceCounts.set(assetId, count + 1);
      
      return this.loadedBuffers.get(assetId)!;
    }

    // Load from database
    const assetData = await this.db.loadAsset(assetId);
    if (!assetData) {
      return null;
    }

    if (!this.audioContext) {
      throw new Error('AudioContext not set');
    }

    // Decode audio data
    try {
      const audioBuffer = await this.audioContext.decodeAudioData(assetData.buffer.slice(0));
      
      // Cache the buffer
      this.loadedBuffers.set(assetId, audioBuffer);
      this.referenceCounts.set(assetId, 1);
      
      return audioBuffer;
    } catch (error) {
      console.error(`[AssetManager] Failed to decode audio: ${assetId}`, error);
      return null;
    }
  }

  /**
   * Unload audio buffer (decrement reference count)
   */
  unloadAudioBuffer(assetId: string): void {
    const count = this.referenceCounts.get(assetId) || 0;
    
    if (count > 1) {
      this.referenceCounts.set(assetId, count - 1);
    } else {
      // No more references, remove from cache
      this.loadedBuffers.delete(assetId);
      this.referenceCounts.delete(assetId);
    }
  }

  /**
   * Force unload all buffers (use when memory is low)
   */
  unloadAllBuffers(): void {
    this.loadedBuffers.clear();
    this.referenceCounts.clear();
    console.log('[AssetManager] Unloaded all audio buffers');
  }

  // =============================================================================
  // Waveform Data
  // =============================================================================

  /**
   * Load waveform data for an asset
   */
  async loadWaveform(assetId: string): Promise<WaveformPeaks | null> {
    const data = await this.db.loadWaveform(assetId);
    if (!data) return null;

    // Split peaks into min/max arrays
    const halfLength = Math.floor(data.peaks.length / 2);
    const min = data.peaks.slice(0, halfLength);
    const max = data.peaks.slice(halfLength);

    return {
      min,
      max,
      samplesPerPeak: data.samplesPerPeak,
    };
  }

  /**
   * Generate waveform peaks from audio buffer
   */
  private generateWaveform(buffer: AudioBuffer, samplesPerPeak: number = 256): { peaks: Float32Array; samplesPerPeak: number } {
    const channelData = buffer.getChannelData(0); // Use first channel
    const peakCount = Math.ceil(channelData.length / samplesPerPeak);
    
    // Store both min and max peaks
    const peaks = new Float32Array(peakCount * 2);
    
    for (let i = 0; i < peakCount; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, channelData.length);
      
      let min = 1;
      let max = -1;
      
      for (let j = start; j < end; j++) {
        const sample = channelData[j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      
      peaks[i] = min;
      peaks[i + peakCount] = max;
    }
    
    return { peaks, samplesPerPeak };
  }

  /**
   * Regenerate waveform for an asset
   */
  async regenerateWaveform(assetId: string, samplesPerPeak: number = 256): Promise<void> {
    const buffer = await this.loadAudioBuffer(assetId);
    if (!buffer) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const waveform = this.generateWaveform(buffer, samplesPerPeak);
    await this.db.saveWaveform(assetId, waveform.peaks, waveform.samplesPerPeak);
  }

  // =============================================================================
  // Asset Management
  // =============================================================================

  /**
   * Get asset metadata
   */
  async getAsset(assetId: string): Promise<Asset | null> {
    const assetData = await this.db.loadAsset(assetId);
    return (assetData?.metadata as Asset) || null;
  }

  /**
   * Delete an asset
   */
  async deleteAsset(assetId: string): Promise<void> {
    // Remove from cache
    this.loadedBuffers.delete(assetId);
    this.referenceCounts.delete(assetId);
    
    // Delete from database
    await this.db.deleteAsset(assetId);
    await this.db.deleteWaveform(assetId);
    
    console.log(`[AssetManager] Deleted asset: ${assetId}`);
  }

  /**
   * List all assets
   */
  async listAssets(): Promise<Asset[]> {
    return this.db.listAssets() as Promise<Asset[]>;
  }

  /**
   * Find duplicate assets by hash
   */
  async findDuplicate(hash: string): Promise<Asset | null> {
    return this.db.findAssetByHash(hash) as Promise<Asset | null>;
  }

  /**
   * Update which projects use an asset
   */
  async updateAssetUsage(assetId: string, projectIds: string[]): Promise<void> {
    await this.db.updateAssetUsage(assetId, projectIds);
  }

  /**
   * Get unused assets (not referenced by any project)
   */
  async getUnusedAssets(): Promise<Asset[]> {
    const allAssets = await this.listAssets();
    return allAssets.filter(asset => asset.usedBy.length === 0);
  }

  /**
   * Clean up unused assets
   */
  async cleanupUnusedAssets(): Promise<number> {
    const unused = await this.getUnusedAssets();
    
    for (const asset of unused) {
      await this.deleteAsset(asset.id);
    }
    
    console.log(`[AssetManager] Cleaned up ${unused.length} unused assets`);
    
    return unused.length;
  }

  // =============================================================================
  // File Operations
  // =============================================================================

  /**
   * Export asset to file
   */
  async exportAssetToFile(assetId: string, filename?: string): Promise<File | null> {
    const assetData = await this.db.loadAsset(assetId);
    if (!assetData) return null;

    const name = filename || assetData.metadata.name;
    const mimeType = this.getMimeType(name);
    
    return new File([assetData.buffer], name, { type: mimeType });
  }

  /**
   * Get audio buffer (for direct use)
   */
  getCachedBuffer(assetId: string): AudioBuffer | undefined {
    return this.loadedBuffers.get(assetId);
  }

  /**
   * Check if buffer is loaded
   */
  isBufferLoaded(assetId: string): boolean {
    return this.loadedBuffers.has(assetId);
  }

  // =============================================================================
  // Utility
  // =============================================================================

  /**
   * Compute SHA-256 hash of array buffer
   */
  private async computeHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'wav': return 'audio/wav';
      case 'mp3': return 'audio/mpeg';
      case 'ogg': return 'audio/ogg';
      case 'flac': return 'audio/flac';
      case 'm4a': return 'audio/mp4';
      case 'aiff': return 'audio/aiff';
      default: return 'audio/unknown';
    }
  }

  /**
   * Get memory usage stats
   */
  getMemoryStats(): {
    loadedBuffers: number;
    totalMemoryBytes: number;
    referenceCounts: number;
  } {
    let totalMemory = 0;
    
    for (const [assetId, buffer] of this.loadedBuffers.entries()) {
      // Estimate memory: sampleRate * channels * duration * 4 bytes (Float32)
      totalMemory += buffer.sampleRate * buffer.numberOfChannels * buffer.duration * 4;
    }
    
    return {
      loadedBuffers: this.loadedBuffers.size,
      totalMemoryBytes: Math.round(totalMemory),
      referenceCounts: this.referenceCounts.size,
    };
  }

  /**
   * Get storage stats
   */
  async getStorageStats(): Promise<{
    totalAssets: number;
    totalSize: number;
    audioAssets: number;
    midiAssets: number;
  }> {
    const assets = await this.listAssets();
    
    const audioAssets = assets.filter(a => a.type === 'audio');
    const midiAssets = assets.filter(a => a.type === 'midi');
    
    const totalSize = assets.reduce((sum, a) => sum + a.size, 0);
    
    return {
      totalAssets: assets.length,
      totalSize,
      audioAssets: audioAssets.length,
      midiAssets: midiAssets.length,
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createAssetManager(db: IndexedDBAdapter): AssetManager {
  return new AssetManager(db);
}

export default AssetManager;
