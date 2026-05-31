/**
 * Import Manager - Import files into DAW projects
 * 
 * Features:
 * - Import audio files (WAV, MP3, etc.)
 * - Import MIDI files
 * - Import DAW project files
 * - Drag and drop support
 * - Batch import
 * - Duplicate detection
 */

import { ProjectManager, Project } from './projectManager';
import { AssetManager, ImportAudioResult } from './assetManager';
import { ProjectSerializer, SerializedProject } from './projectSerializer';

// =============================================================================
// Types
// =============================================================================

export type ImportFileType = 'audio' | 'midi' | 'project' | 'unknown';

export interface ImportOptions {
  projectId: string;
  addToTimeline?: boolean;
  startBeat?: number;
  trackId?: string;
  createNewTrack?: boolean;
  detectDuplicates?: boolean;
}

export interface ImportResult {
  success: boolean;
  assetId?: string;
  clipId?: string;
  trackId?: string;
  isDuplicate?: boolean;
  error?: string;
}

export interface BatchImportResult {
  results: ImportResult[];
  succeeded: number;
  failed: number;
  duplicates: number;
}

export interface SupportedFormat {
  extension: string;
  type: ImportFileType;
  mimeType: string;
  description: string;
}

// =============================================================================
// Supported Formats
// =============================================================================

export const SUPPORTED_FORMATS: SupportedFormat[] = [
  { extension: 'wav', type: 'audio', mimeType: 'audio/wav', description: 'WAV Audio' },
  { extension: 'mp3', type: 'audio', mimeType: 'audio/mpeg', description: 'MP3 Audio' },
  { extension: 'ogg', type: 'audio', mimeType: 'audio/ogg', description: 'OGG Audio' },
  { extension: 'flac', type: 'audio', mimeType: 'audio/flac', description: 'FLAC Audio' },
  { extension: 'm4a', type: 'audio', mimeType: 'audio/mp4', description: 'M4A Audio' },
  { extension: 'aiff', type: 'audio', mimeType: 'audio/aiff', description: 'AIFF Audio' },
  { extension: 'mid', type: 'midi', mimeType: 'audio/midi', description: 'MIDI File' },
  { extension: 'midi', type: 'midi', mimeType: 'audio/midi', description: 'MIDI File' },
  { extension: 'json', type: 'project', mimeType: 'application/json', description: 'DAW Project' },
  { extension: 'dawproject', type: 'project', mimeType: 'application/json', description: 'DAW Project' },
];

// =============================================================================
// Import Manager Class
// =============================================================================

export class ImportManager {
  private projectManager: ProjectManager;
  private assetManager: AssetManager;
  private audioContext: AudioContext | null = null;

  constructor(projectManager: ProjectManager, assetManager: AssetManager) {
    this.projectManager = projectManager;
    this.assetManager = assetManager;
  }

  /**
   * Set audio context for decoding audio
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    this.assetManager.setAudioContext(context);
  }

  // =============================================================================
  // File Type Detection
  // =============================================================================

  /**
   * Detect file type from filename
   */
  detectFileType(filename: string): ImportFileType {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const format = SUPPORTED_FORMATS.find(f => f.extension === ext);
    return format?.type || 'unknown';
  }

  /**
   * Check if file type is supported
   */
  isSupported(filename: string): boolean {
    return this.detectFileType(filename) !== 'unknown';
  }

  /**
   * Get supported formats for file picker
   */
  getAcceptTypes(): string {
    const audioExts = SUPPORTED_FORMATS
      .filter(f => f.type === 'audio')
      .map(f => `.${f.extension}`)
      .join(',');
    const midiExts = SUPPORTED_FORMATS
      .filter(f => f.type === 'midi')
      .map(f => `.${f.extension}`)
      .join(',');
    const projectExts = SUPPORTED_FORMATS
      .filter(f => f.type === 'project')
      .map(f => `.${f.extension}`)
      .join(',');
    
    return `${audioExts},${midiExts},${projectExts}`;
  }

  // =============================================================================
  // Import Methods
  // =============================================================================

  /**
   * Import a single file
   */
  async importFile(file: File, options: ImportOptions): Promise<ImportResult> {
    const fileType = this.detectFileType(file.name);

    try {
      switch (fileType) {
        case 'audio':
          return await this.importAudioFile(file, options);
        case 'midi':
          return await this.importMidiFile(file, options);
        case 'project':
          return await this.importProjectFile(file);
        default:
          return { success: false, error: `Unsupported file type: ${file.name}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Import failed' 
      };
    }
  }

  /**
   * Import multiple files
   */
  async importMultipleFiles(files: File[], options: ImportOptions): Promise<BatchImportResult> {
    const results: ImportResult[] = [];
    let succeeded = 0;
    let failed = 0;
    let duplicates = 0;

    for (const file of files) {
      const result = await this.importFile(file, options);
      results.push(result);

      if (result.success) {
        succeeded++;
        if (result.isDuplicate) duplicates++;
      } else {
        failed++;
      }
    }

    return { results, succeeded, failed, duplicates };
  }

  // =============================================================================
  // Audio Import
  // =============================================================================

  /**
   * Import an audio file
   */
  private async importAudioFile(file: File, options: ImportOptions): Promise<ImportResult> {
    // Import into asset manager
    const importResult = await this.assetManager.importAudio(file, options.projectId);
    
    if (!importResult.asset) {
      return { success: false, error: 'Failed to import audio' };
    }

    const result: ImportResult = {
      success: true,
      assetId: importResult.asset.id,
      isDuplicate: importResult.isDuplicate,
    };

    // Add to timeline if requested
    if (options.addToTimeline && !importResult.isDuplicate) {
      const clipResult = await this.addAudioToTimeline(
        importResult.asset.id,
        importResult.asset.duration,
        options
      );
      
      result.clipId = clipResult.clipId;
      result.trackId = clipResult.trackId;
    }

    return result;
  }

  /**
   * Add imported audio to project timeline
   */
  private async addAudioToTimeline(
    assetId: string,
    duration: number,
    options: ImportOptions
  ): Promise<{ clipId: string; trackId: string }> {
    const project = this.projectManager.getCurrentProject();
    if (!project) {
      throw new Error('No project open');
    }

    let trackId = options.trackId;

    // Create new track if requested
    if (options.createNewTrack || !trackId) {
      const newTrackId = `track-${Date.now()}`;
      project.data.tracks.push({
        id: newTrackId,
        name: 'Imported Audio',
        type: 'audio',
        color: '#3B82F6',
        muted: false,
        soloed: false,
        volume: 0,
        pan: 0,
        clips: [],
      });
      trackId = newTrackId;
    }

    // Create clip
    const clipId = `clip-${Date.now()}`;
    const startBeat = options.startBeat ?? this.findNextEmptyBeat(project, trackId);
    
    const track = project.data.tracks.find(t => t.id === trackId);
    if (track) {
      track.clips.push({
        id: clipId,
        startBeat,
        duration: duration * (project.data.timeline.tempo / 60), // Convert seconds to beats
        assetId,
      });
    }

    // Save project
    await this.projectManager.saveProject(project);

    return { clipId, trackId };
  }

  /**
   * Find next empty beat on a track
   */
  private findNextEmptyBeat(project: Project, trackId: string): number {
    const track = project.data.tracks.find(t => t.id === trackId);
    if (!track || track.clips.length === 0) {
      return 0;
    }

    // Find the end of the last clip
    const lastClip = track.clips.reduce((latest, clip) => {
      const clipEnd = clip.startBeat + clip.duration;
      const latestEnd = latest.startBeat + latest.duration;
      return clipEnd > latestEnd ? clip : latest;
    });

    return lastClip.startBeat + lastClip.duration;
  }

  // =============================================================================
  // MIDI Import
  // =============================================================================

  /**
   * Import a MIDI file
   */
  private async importMidiFile(file: File, options: ImportOptions): Promise<ImportResult> {
    const arrayBuffer = await file.arrayBuffer();
    const midiData = this.parseMidiFile(arrayBuffer);

    if (!midiData) {
      return { success: false, error: 'Failed to parse MIDI file' };
    }

    const project = this.projectManager.getCurrentProject();
    if (!project) {
      return { success: false, error: 'No project open' };
    }

    // Create MIDI track if needed
    let trackId = options.trackId;
    if (options.createNewTrack || !trackId) {
      const newTrackId = `track-${Date.now()}`;
      project.data.tracks.push({
        id: newTrackId,
        name: 'Imported MIDI',
        type: 'midi',
        color: '#10B981',
        muted: false,
        soloed: false,
        volume: 0,
        pan: 0,
        clips: [],
      });
      trackId = newTrackId;
    }

    // Create MIDI clip
    const clipId = `midi-${Date.now()}`;
    const startBeat = options.startBeat ?? 0;
    
    // Convert MIDI notes to our format
    const notes = midiData.notes.map((note, index) => ({
      id: `note-${Date.now()}-${index}`,
      pitch: note.pitch,
      velocity: note.velocity,
      startBeat: note.startTime / 480, // Assuming 480 ticks per beat
      duration: note.duration / 480,
      channel: note.channel,
      selected: false,
    }));

    // Calculate clip length
    const maxEndBeat = Math.max(...notes.map(n => n.startBeat + n.duration));
    
    project.data.midiClips.push({
      id: clipId,
      trackId,
      startBeat,
      length: maxEndBeat,
      notes,
    });

    // Update track
    const track = project.data.tracks.find(t => t.id === trackId);
    if (track) {
      track.clips.push({
        id: clipId,
        startBeat,
        duration: maxEndBeat,
        assetId: '', // MIDI clips don't have asset IDs
      });
    }

    // Save project
    await this.projectManager.saveProject(project);

    return {
      success: true,
      clipId,
      trackId,
    };
  }

  /**
   * Parse MIDI file (simplified SMF parser)
   */
  private parseMidiFile(buffer: ArrayBuffer): { notes: Array<{ pitch: number; velocity: number; startTime: number; duration: number; channel: number }> } | null {
    const view = new DataView(buffer);
    let offset = 0;

    // Check MIDI header
    const headerId = this.readString(view, offset, 4);
    if (headerId !== 'MThd') {
      return null;
    }
    offset += 4;

    // Skip header size
    offset += 4;

    // Read format, tracks, division
    const format = view.getUint16(offset); offset += 2;
    const numTracks = view.getUint16(offset); offset += 2;
    const division = view.getUint16(offset); offset += 2;

    const notes: Array<{ pitch: number; velocity: number; startTime: number; duration: number; channel: number }> = [];
    const activeNotes: Map<string, { pitch: number; velocity: number; startTime: number; channel: number }> = new Map();

    // Read tracks
    for (let trackIndex = 0; trackIndex < numTracks; trackIndex++) {
      // Find track chunk
      while (offset < buffer.byteLength - 4) {
        const chunkId = this.readString(view, offset, 4);
        offset += 4;
        
        if (chunkId === 'MTrk') {
          break;
        }
        
        // Skip unknown chunk
        const chunkSize = view.getUint32(offset); offset += 4;
        offset += chunkSize;
      }

      if (offset >= buffer.byteLength) break;

      const trackSize = view.getUint32(offset); offset += 4;
      const trackEnd = offset + trackSize;

      let currentTime = 0;

      // Read track events
      while (offset < trackEnd) {
        // Read delta time
        const deltaTime = this.readVariableLength(view, offset);
        currentTime += deltaTime.value;
        offset = deltaTime.nextOffset;

        if (offset >= trackEnd) break;

        // Read event
        const eventType = view.getUint8(offset);

        if (eventType === 0xFF) {
          // Meta event
          const metaType = view.getUint8(offset + 1);
          const length = this.readVariableLength(view, offset + 2);
          
          if (metaType === 0x2F) {
            // End of track
            break;
          }
          
          offset = length.nextOffset + length.value;
        } else if ((eventType & 0xF0) === 0x90) {
          // Note on
          const channel = eventType & 0x0F;
          const pitch = view.getUint8(offset + 1);
          const velocity = view.getUint8(offset + 2);
          offset += 3;

          if (velocity > 0) {
            const noteKey = `${channel}-${pitch}`;
            activeNotes.set(noteKey, { pitch, velocity, startTime: currentTime, channel });
          } else {
            // Note on with velocity 0 is note off
            const noteKey = `${channel}-${pitch}`;
            const activeNote = activeNotes.get(noteKey);
            if (activeNote) {
              notes.push({
                pitch: activeNote.pitch,
                velocity: activeNote.velocity,
                startTime: activeNote.startTime,
                duration: currentTime - activeNote.startTime,
                channel: activeNote.channel,
              });
              activeNotes.delete(noteKey);
            }
          }
        } else if ((eventType & 0xF0) === 0x80) {
          // Note off
          const channel = eventType & 0x0F;
          const pitch = view.getUint8(offset + 1);
          offset += 3;

          const noteKey = `${channel}-${pitch}`;
          const activeNote = activeNotes.get(noteKey);
          if (activeNote) {
            notes.push({
              pitch: activeNote.pitch,
              velocity: activeNote.velocity,
              startTime: activeNote.startTime,
              duration: currentTime - activeNote.startTime,
              channel: activeNote.channel,
            });
            activeNotes.delete(noteKey);
          }
        } else if ((eventType & 0xF0) === 0xB0 || (eventType & 0xF0) === 0xC0 || (eventType & 0xF0) === 0xD0) {
          // Controller / Program change / Channel pressure
          offset += 3;
        } else if ((eventType & 0xF0) === 0xE0) {
          // Pitch bend
          offset += 3;
        } else if (eventType === 0xF0 || eventType === 0xF7) {
          // Sysex
          const length = this.readVariableLength(view, offset + 1);
          offset = length.nextOffset + length.value;
        } else {
          // Unknown event, skip
          offset++;
        }
      }
    }

    return { notes };
  }

  private readString(view: DataView, offset: number, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(view.getUint8(offset + i));
    }
    return result;
  }

  private readVariableLength(view: DataView, offset: number): { value: number; nextOffset: number } {
    let value = 0;
    let i = 0;
    
    while (i < 4) {
      const byte = view.getUint8(offset + i);
      value = (value << 7) | (byte & 0x7F);
      i++;
      
      if ((byte & 0x80) === 0) {
        break;
      }
    }
    
    return { value, nextOffset: offset + i };
  }

  // =============================================================================
  // Project Import
  // =============================================================================

  /**
   * Import a DAW project file
   */
  private async importProjectFile(file: File): Promise<ImportResult> {
    const text = await file.text();
    
    try {
      const projectData: SerializedProject = JSON.parse(text);
      
      // Validate
      if (!projectData.format || !projectData.project) {
        return { success: false, error: 'Invalid project file format' };
      }

      // Import via project manager
      const project = await this.projectManager.importProjectFromJson(text);

      return {
        success: true,
        assetId: project.id,
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to parse project file' 
      };
    }
  }

  // =============================================================================
  // Drag and Drop
  // =============================================================================

  /**
   * Handle drag and drop files
   */
  async handleDrop(
    items: DataTransferItemList,
    options: ImportOptions
  ): Promise<BatchImportResult> {
    const files: File[] = [];

    // Collect all files
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    return this.importMultipleFiles(files, options);
  }

  // =============================================================================
  // Utility
  // =============================================================================

  /**
   * Get import statistics
   */
  async getImportStats(): Promise<{
    totalImports: number;
    byType: Record<ImportFileType, number>;
  }> {
    // This would track import statistics
    return {
      totalImports: 0,
      byType: { audio: 0, midi: 0, project: 0, unknown: 0 },
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createImportManager(
  projectManager: ProjectManager,
  assetManager: AssetManager
): ImportManager {
  return new ImportManager(projectManager, assetManager);
}

export default ImportManager;
