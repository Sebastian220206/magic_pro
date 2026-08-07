/**
 * MIDI Export Utility
 * Exports MIDI clips to standard MIDI file format (SMF)
 */

import { MidiClip, MidiNote } from '../engine/midi/types';

interface MidiExportOptions {
  clips: MidiClip[];
  tempo: number;
  timeSignature?: { numerator: number; denominator: number };
  ticksPerBeat?: number;
}

interface MidiEvent {
  deltaTime: number;
  type: number;
  channel: number;
  param1: number;
  param2: number;
  data?: number[];
}

interface MidiTrack {
  events: MidiEvent[];
}

function writeVarLength(value: number): number[] {
  const bytes: number[] = [];
  if (value === 0) return [0];
  
  const buffer: number[] = [];
  while (value > 0) {
    buffer.push(value & 0x7F);
    value >>= 7;
  }
  
  for (let i = buffer.length - 1; i >= 0; i--) {
    bytes.push(buffer[i] | (i > 0 ? 0x80 : 0));
  }
  return bytes;
}

function writeUint16(value: number): number[] {
  return [(value >> 8) & 0xFF, value & 0xFF];
}

function writeUint32(value: number): number[] {
  return [
    (value >> 24) & 0xFF,
    (value >> 16) & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF
  ];
}

function writeString(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }
  return bytes;
}

function noteToMidiEvents(note: MidiNote, ticksPerBeat: number, channel: number): MidiEvent[] {
  const startTick = Math.round(note.startBeat * ticksPerBeat);
  const endTick = Math.round((note.startBeat + note.duration) * ticksPerBeat);
  const velocity = Math.max(1, Math.min(127, note.velocity));
  
  return [
    {
      deltaTime: startTick,
      type: 0x90, // Note On
      channel,
      param1: note.pitch,
      param2: velocity
    },
    {
      deltaTime: endTick - startTick,
      type: 0x80, // Note Off
      channel,
      param1: note.pitch,
      param2: 0
    }
  ];
}

function createTempoEvent(tempo: number, ticksPerBeat: number): MidiEvent {
  // Microseconds per beat = 60,000,000 / tempo
  const microsecondsPerBeat = Math.round(60000000 / tempo);
  return {
    deltaTime: 0,
    type: 0xFF, // Meta event
    channel: 0,
    param1: 0x51, // Set Tempo
    param2: microsecondsPerBeat
  };
}

function createTimeSignatureEvent(numerator: number, denominator: number): MidiEvent {
  return {
    deltaTime: 0,
    type: 0xFF, // Meta event
    channel: 0,
    param1: 0x58, // Time Signature
    param2: (numerator << 24) | (denominator << 16) | (0x18 << 8) | 8 // Standard MIDI clocks per click
  };
}

function createTrackNameEvent(name: string): MidiEvent {
  const nameBytes = writeString(name);
  return {
    deltaTime: 0,
    type: 0xFF, // Meta event
    channel: 0,
    param1: 0x03, // Track Name
    param2: nameBytes.length,
    data: nameBytes
  };
}

function createEndOfTrackEvent(): MidiEvent {
  return {
    deltaTime: 0,
    type: 0xFF, // Meta event
    channel: 0,
    param1: 0x2F, // End of Track
    param2: 0
  };
}

export function exportMidiToArrayBuffer(options: MidiExportOptions): ArrayBuffer {
  const { clips, tempo, timeSignature = { numerator: 4, denominator: 4 }, ticksPerBeat = 480 } = options;
  
  // Group notes by track/channel
  const tracks = new Map<number, MidiNote[]>();
  
  for (const clip of clips) {
    for (const note of clip.notes) {
      const channel = note.channel ?? 0;
      if (!tracks.has(channel)) {
        tracks.set(channel, []);
      }
      // Adjust note timing to be absolute (including clip start)
      tracks.get(channel)!.push({
        ...note,
        startBeat: note.startBeat + clip.startBeat
      });
    }
  }
  
  // Create MIDI tracks
  const midiTracks: MidiTrack[] = [];
  
  // Track 0: Tempo and time signature (conductor track)
  const conductorTrack: MidiTrack = { events: [] };
  conductorTrack.events.push(createTrackNameEvent('Conductor'));
  conductorTrack.events.push(createTempoEvent(tempo, ticksPerBeat));
  conductorTrack.events.push(createTimeSignatureEvent(timeSignature.numerator, timeSignature.denominator));
  conductorTrack.events.push(createEndOfTrackEvent());
  midiTracks.push(conductorTrack);
  
  // Create tracks for each channel
  for (const [channel, notes] of tracks) {
    const track: MidiTrack = { events: [] };
    track.events.push(createTrackNameEvent(`Channel ${channel + 1}`));
    
    // Sort notes by start time
    notes.sort((a, b) => a.startBeat - b.startBeat);
    
    let lastTick = 0;
    for (const note of notes) {
      const noteEvents = noteToMidiEvents(note, ticksPerBeat, channel);
      for (const event of noteEvents) {
        event.deltaTime -= lastTick;
        lastTick += event.deltaTime;
        track.events.push(event);
      }
    }
    
    track.events.push(createEndOfTrackEvent());
    midiTracks.push(track);
  }
  
  // Write MIDI file
  const chunks: number[] = [];
  
  // Header chunk
  chunks.push(...writeString('MThd'));
  chunks.push(...writeUint32(6)); // Header length
  chunks.push(...writeUint16(1)); // Format 1 (multiple tracks)
  chunks.push(...writeUint16(midiTracks.length));
  chunks.push(...writeUint16(ticksPerBeat));
  
  // Track chunks
  for (const track of midiTracks) {
    const trackData: number[] = [];
    let runningDelta = 0;
    
    for (const event of track.events) {
      runningDelta += event.deltaTime;
      const deltaBytes = writeVarLength(runningDelta);
      trackData.push(...deltaBytes);
      
      if (event.type >= 0x80 && event.type <= 0xEF) {
        // Channel message
        trackData.push(event.type | event.channel);
        trackData.push(event.param1);
        if (event.type !== 0xC0 && event.type !== 0xD0) {
          trackData.push(event.param2);
        }
      } else if (event.type === 0xFF) {
        // Meta event
        trackData.push(0xFF);
        trackData.push(event.param1);
        if (event.param1 === 0x51) {
          // Tempo event - 3 bytes
          const tempoBytes = writeUint32(event.param2);
          trackData.push(3);
          trackData.push(...tempoBytes.slice(1)); // Only 3 bytes
        } else if (event.param1 === 0x58) {
          // Time signature - 4 bytes
          trackData.push(4);
          trackData.push((event.param2 >> 24) & 0xFF);
          trackData.push((event.param2 >> 16) & 0xFF);
          trackData.push((event.param2 >> 8) & 0xFF);
          trackData.push(event.param2 & 0xFF);
        } else if (event.param1 === 0x03) {
          // Track name
          trackData.push(event.param2);
          if (event.data) trackData.push(...event.data);
        } else if (event.param1 === 0x2F) {
          // End of track
          trackData.push(0);
        }
      }
    }
    
    chunks.push(...writeString('MTrk'));
    chunks.push(...writeUint32(trackData.length));
    chunks.push(...trackData);
  }
  
  return new Uint8Array(chunks).buffer;
}

export function downloadMidiFile(arrayBuffer: ArrayBuffer, filename: string = 'export.mid'): void {
  const blob = new Blob([arrayBuffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportMidiFromClip(clip: MidiClip, tempo: number, filename?: string): void {
  const arrayBuffer = exportMidiToArrayBuffer({
    clips: [clip],
    tempo,
    timeSignature: { numerator: 4, denominator: 4 }
  });
  downloadMidiFile(arrayBuffer, filename || `${clip.name || 'clip'}.mid`);
}

export function exportMidiFromClips(clips: MidiClip[], tempo: number, filename?: string): void {
  const arrayBuffer = exportMidiToArrayBuffer({
    clips,
    tempo,
    timeSignature: { numerator: 4, denominator: 4 }
  });
  downloadMidiFile(arrayBuffer, filename || 'project.mid');
}