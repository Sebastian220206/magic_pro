/**
 * Project Serializer - Convert between app state and project JSON format
 * 
 * Features:
 * - Serialize application state to project.json format
 * - Deserialize project.json to application state
 * - Handle version migration
 * - Validate project data
 */

import { Track, Clip, MidiClip } from '../timeline/types';
import { MixerState } from '../audioEngine/channelStrip';

// =============================================================================
// Serialized Project Types
// =============================================================================

export interface SerializedProject {
  format: 'daw-project-v1';
  project: {
    id: string;
    name: string;
    createdAt: number;
    modifiedAt: number;
    version: number;
  };
  timeline: {
    tempo: number;
    timeSignature: {
      numerator: number;
      denominator: number;
    };
    startBeat: number;
    endBeat: number;
    loop?: {
      enabled: boolean;
      start: number;
      end: number;
    };
  };
  tracks: SerializedTrack[];
  midiClips: SerializedMidiClip[];
  mixer: SerializedMixer;
  automation: Record<string, SerializedAutomation[]>;
  markers: SerializedMarker[];
  assets: SerializedAsset[];
  plugins: SerializedPlugin[];
}

export interface SerializedTrack {
  id: string;
  name: string;
  type: 'audio' | 'midi';
  color: string;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
  clips: SerializedClip[];
}

export interface SerializedClip {
  id: string;
  startBeat: number;
  duration: number;
  assetId: string;
  offset?: number;
  fadeIn?: number;
  fadeOut?: number;
  gain?: number;
}

export interface SerializedMidiClip {
  id: string;
  trackId: string;
  startBeat: number;
  length: number;
  notes: SerializedMidiNote[];
  color?: string;
}

export interface SerializedMidiNote {
  id: string;
  pitch: number;
  velocity: number;
  startBeat: number;
  duration: number;
  channel?: number;
}

export interface SerializedMixer {
  master: {
    volume: number;
    limiter?: boolean;
  };
  channels: SerializedMixerChannel[];
}

export interface SerializedMixerChannel {
  trackId: string;
  volume: number;
  pan: number;
  muted?: boolean;
  soloed?: boolean;
  sends?: Array<{
    busId: string;
    level: number;
    preFader: boolean;
  }>;
}

export interface SerializedAutomation {
  param: string;
  points: Array<{
    beat: number;
    value: number;
    curve?: 'linear' | 'exponential' | 'step';
  }>;
}

export interface SerializedMarker {
  beat: number;
  name: string;
  color: string;
}

export interface SerializedAsset {
  id: string;
  type: 'audio' | 'midi';
  name: string;
  hash?: string;
  duration?: number;
  sampleRate?: number;
  channels?: number;
}

export interface SerializedPlugin {
  id: string;
  trackId: string;
  slot: number;
  type: string;
  name: string;
  params: Record<string, number>;
  bypass: boolean;
}

// =============================================================================
// Application State Types (for serialization)
// =============================================================================

export interface AppState {
  timeline: {
    tempo: number;
    timeSignature: { numerator: number; denominator: number };
    startBeat: number;
    endBeat: number;
    loop: { enabled: boolean; start: number; end: number };
    currentBeat: number;
    isPlaying: boolean;
  };
  tracks: Track[];
  clips: Clip[];
  midiClips: MidiClip[];
  mixer: MixerState;
  markers: Array<{ beat: number; name: string; color: string }>;
  assets: Array<{ id: string; type: string; name: string }>;
}

// =============================================================================
// Project Serializer Class
// =============================================================================

export class ProjectSerializer {
  private currentVersion = 1;

  /**
   * Serialize application state to project format
   */
  serialize(state: AppState, projectId: string, projectName: string): SerializedProject {
    const now = Date.now();

    return {
      format: 'daw-project-v1',
      project: {
        id: projectId,
        name: projectName,
        createdAt: now,
        modifiedAt: now,
        version: 1,
      },
      timeline: {
        tempo: state.timeline.tempo,
        timeSignature: state.timeline.timeSignature,
        startBeat: state.timeline.startBeat,
        endBeat: state.timeline.endBeat,
        loop: state.timeline.loop.enabled ? {
          enabled: true,
          start: state.timeline.loop.start,
          end: state.timeline.loop.end,
        } : undefined,
      },
      tracks: this.serializeTracks(state.tracks, state.clips),
      midiClips: this.serializeMidiClips(state.midiClips),
      mixer: this.serializeMixer(state.mixer, state.tracks),
      automation: {}, // TODO: Implement automation serialization
      markers: state.markers,
      assets: state.assets.map(a => ({
        id: a.id,
        type: a.type as 'audio' | 'midi',
        name: a.name,
      })),
      plugins: [], // TODO: Implement plugin serialization
    };
  }

  /**
   * Deserialize project format to application state
   */
  deserialize(serialized: SerializedProject): AppState {
    return {
      timeline: {
        tempo: serialized.timeline.tempo,
        timeSignature: serialized.timeline.timeSignature,
        startBeat: serialized.timeline.startBeat,
        endBeat: serialized.timeline.endBeat,
        loop: {
          enabled: serialized.timeline.loop?.enabled || false,
          start: serialized.timeline.loop?.start || 0,
          end: serialized.timeline.loop?.end || 0,
        },
        currentBeat: 0,
        isPlaying: false,
      },
      tracks: this.deserializeTracks(serialized.tracks),
      clips: this.deserializeClips(serialized.tracks),
      midiClips: this.deserializeMidiClips(serialized.midiClips),
      mixer: this.deserializeMixer(serialized.mixer),
      markers: serialized.markers,
      assets: serialized.assets.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
      })),
    };
  }

  // =============================================================================
  // Serialization Helpers
  // =============================================================================

  private serializeTracks(tracks: Track[], clips: Clip[]): SerializedTrack[] {
    return tracks.map(track => ({
      id: track.id,
      name: track.name,
      type: track.type,
      color: track.color || '#3B82F6',
      muted: track.muted || false,
      soloed: track.soloed || false,
      volume: track.volume ?? 0,
      pan: track.pan ?? 0,
      clips: clips
        .filter(c => c.trackId === track.id)
        .map(c => this.serializeClip(c)),
    }));
  }

  private serializeClip(clip: Clip): SerializedClip {
    return {
      id: clip.id,
      startBeat: clip.startBeat,
      duration: clip.duration,
      assetId: clip.assetId || '',
      offset: clip.offset,
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
      gain: clip.gain,
    };
  }

  private serializeMidiClips(midiClips: MidiClip[]): SerializedMidiClip[] {
    return midiClips.map(clip => ({
      id: clip.id,
      trackId: clip.trackId,
      startBeat: clip.startBeat,
      length: clip.length || clip.duration,
      notes: clip.notes.map(note => ({
        id: note.id,
        pitch: note.pitch,
        velocity: note.velocity,
        startBeat: note.startBeat,
        duration: note.duration,
        channel: note.channel,
      })),
      color: clip.color,
    }));
  }

  private serializeMixer(mixer: MixerState, tracks: Track[]): SerializedMixer {
    // This is a simplified mixer serialization
    // In a real implementation, you'd serialize all mixer state
    return {
      master: {
        volume: 0,
        limiter: true,
      },
      channels: tracks.map(track => ({
        trackId: track.id,
        volume: track.volume ?? 0,
        pan: track.pan ?? 0,
        muted: track.muted,
        soloed: track.soloed,
      })),
    };
  }

  // =============================================================================
  // Deserialization Helpers
  // =============================================================================

  private deserializeTracks(serializedTracks: SerializedTrack[]): Track[] {
    return serializedTracks.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      color: t.color,
      muted: t.muted,
      soloed: t.soloed,
      volume: t.volume,
      pan: t.pan,
      clips: [], // Clips are loaded separately
    }));
  }

  private deserializeClips(serializedTracks: SerializedTrack[]): Clip[] {
    const clips: Clip[] = [];

    for (const track of serializedTracks) {
      for (const clip of track.clips) {
        clips.push({
          id: clip.id,
          trackId: track.id,
          type: 'audio',
          startBeat: clip.startBeat,
          duration: clip.duration,
          offset: clip.offset || 0,
          assetId: clip.assetId,
          fadeIn: clip.fadeIn,
          fadeOut: clip.fadeOut,
          gain: clip.gain || 1,
        });
      }
    }

    return clips;
  }

  private deserializeMidiClips(serialized: SerializedMidiClip[]): MidiClip[] {
    return serialized.map(c => ({
      id: c.id,
      trackId: c.trackId,
      startBeat: c.startBeat,
      length: c.length,
      duration: c.length,
      notes: c.notes.map(n => ({
        id: n.id,
        pitch: n.pitch,
        velocity: n.velocity,
        startBeat: n.startBeat,
        duration: n.duration,
        channel: n.channel ?? 0,
        selected: false,
      })),
      color: c.color,
      name: c.id,
    }));
  }

  private deserializeMixer(serialized: SerializedMixer): MixerState {
    // Simplified mixer deserialization
    return {
      tracks: {},
      masterBus: null as any,
      sendBuses: [],
      selectedTrackId: null,
      pluginRegistry: new Map(),
      isMixerVisible: true,
      meterRefreshRate: 30,
      isInitialized: false,
    };
  }

  // =============================================================================
  // Validation
  // =============================================================================

  /**
   * Validate a serialized project
   */
  validate(serialized: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check format
    if (!serialized.format) {
      errors.push('Missing format field');
    } else if (serialized.format !== 'daw-project-v1') {
      errors.push(`Unknown format: ${serialized.format}`);
    }

    // Check required sections
    if (!serialized.project) {
      errors.push('Missing project section');
    }
    if (!serialized.timeline) {
      errors.push('Missing timeline section');
    }
    if (!serialized.tracks) {
      errors.push('Missing tracks section');
    }

    // Validate tracks
    if (serialized.tracks) {
      if (!Array.isArray(serialized.tracks)) {
        errors.push('tracks must be an array');
      } else {
        for (let i = 0; i < serialized.tracks.length; i++) {
          const track = serialized.tracks[i];
          if (!track.id) errors.push(`Track ${i}: missing id`);
          if (!track.name) errors.push(`Track ${i}: missing name`);
          if (!track.type) errors.push(`Track ${i}: missing type`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // =============================================================================
  // Migration
  // =============================================================================

  /**
   * Migrate an older project format to current version
   */
  migrate(serialized: any): SerializedProject {
    // Currently only v1 is supported
    // Future versions would handle migrations from v1 -> v2, etc.
    
    if (serialized.format === 'daw-project-v1') {
      return serialized as SerializedProject;
    }

    throw new Error(`Cannot migrate from format: ${serialized.format}`);
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createProjectSerializer(): ProjectSerializer {
  return new ProjectSerializer();
}

export default ProjectSerializer;
