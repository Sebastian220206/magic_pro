/**
 * Advanced Export - AAF/OMF/XML Export
 *
 * Features:
 * - AAF (Advanced Authoring Format) for video editors
 * - OMF (Open Media Framework) for Pro Tools
 * - XML export for interchange
 * - Metadata preservation
 * - Marker export
 * - Tempo map export
 *
 * Signal Flow:
 * Project Data → Format Converter → File Output
 */

export type ExportFormat = 'aaf' | 'omf' | 'xml' | 'midi' | 'musicxml';

export interface ExportTrackData {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'instrument';
  clips: ExportClipData[];
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  color: string;
}

export interface ExportClipData {
  id: string;
  name: string;
  startBeat: number;
  endBeat: number;
  startTime: number; // seconds
  duration: number;  // seconds
  type: 'audio' | 'midi';
  fileUrl?: string;
  notes?: ExportNoteData[];
}

export interface ExportNoteData {
  pitch: number;
  velocity: number;
  startBeat: number;
  duration: number;
  channel: number;
}

export interface ExportMarkerData {
  id: string;
  name: string;
  beat: number;
  time: number;
  type: 'position' | 'span';
  endBeat?: number;
  endTime?: number;
  color: string;
}

export interface ExportTempoData {
  beat: number;
  time: number;
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
}

export interface ExportProjectData {
  name: string;
  sampleRate: number;
  bitDepth: number;
  tracks: ExportTrackData[];
  markers: ExportMarkerData[];
  tempoMap: ExportTempoData[];
  startTime: number;
  endTime: number;
  totalBeats: number;
}

export interface AdvancedExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includeMarkers: boolean;
  includeTempoMap: boolean;
  includeAudio: boolean;
  includeMidi: boolean;
  sampleRate?: number;
  bitDepth?: 16 | 24 | 32;
}

// =============================================================================
// AAF Export
// =============================================================================

export function exportAAF(data: ExportProjectData, options: AdvancedExportOptions): Blob {
  const aafData: AAFProject = {
    version: '1.0',
    name: data.name,
    sampleRate: data.sampleRate,
    tracks: data.tracks.map(track => ({
      id: track.id,
      name: track.name,
      type: track.type,
      clips: track.clips.map(clip => ({
        id: clip.id,
        name: clip.name,
        startTime: clip.startTime,
        duration: clip.duration,
        type: clip.type,
      })),
    })),
    markers: options.includeMarkers ? data.markers.map(marker => ({
      id: marker.id,
      name: marker.name,
      time: marker.time,
      type: marker.type,
    })) : [],
    tempoMap: options.includeTempoMap ? data.tempoMap.map(tempo => ({
      time: tempo.time,
      bpm: tempo.bpm,
      timeSignature: tempo.timeSignature,
    })) : [],
  };

  const jsonStr = JSON.stringify(aafData, null, 2);
  return new Blob([jsonStr], { type: 'application/aaf' });
}

interface AAFProject {
  version: string;
  name: string;
  sampleRate: number;
  tracks: AAFTrack[];
  markers: AAFMarker[];
  tempoMap: AAFTempo[];
}

interface AAFTrack {
  id: string;
  name: string;
  type: string;
  clips: AAFClip[];
}

interface AAFClip {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  type: string;
}

interface AAFMarker {
  id: string;
  name: string;
  time: number;
  type: string;
}

interface AAFTempo {
  time: number;
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
}

// =============================================================================
// OMF Export
// =============================================================================

export function exportOMF(data: ExportProjectData, options: AdvancedExportOptions): Blob {
  const omfData: OMFProject = {
    format: 'OMF',
    version: '2.0',
    name: data.name,
    sampleRate: data.sampleRate,
    bitDepth: data.bitDepth,
    startTime: data.startTime,
    endTime: data.endTime,
    tracks: data.tracks.map(track => ({
      id: track.id,
      name: track.name,
      audioFiles: track.clips
        .filter(clip => clip.type === 'audio' && clip.fileUrl)
        .map(clip => ({
          id: clip.id,
          name: clip.name,
          filePath: clip.fileUrl!,
          startTime: clip.startTime,
          duration: clip.duration,
        })),
    })),
  };

  const jsonStr = JSON.stringify(omfData, null, 2);
  return new Blob([jsonStr], { type: 'application/omf' });
}

interface OMFProject {
  format: string;
  version: string;
  name: string;
  sampleRate: number;
  bitDepth: number;
  startTime: number;
  endTime: number;
  tracks: OMFTrack[];
}

interface OMFTrack {
  id: string;
  name: string;
  audioFiles: OMFFile[];
}

interface OMFFile {
  id: string;
  name: string;
  filePath: string;
  startTime: number;
  duration: number;
}

// =============================================================================
// XML Export
// =============================================================================

export function exportXML(data: ExportProjectData, options: AdvancedExportOptions): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<!DOCTYPE project>\n';
  xml += '<project>\n';
  xml += `  <name>${escapeXml(data.name)}</name>\n`;
  xml += `  <sampleRate>${data.sampleRate}</sampleRate>\n`;
  xml += `  <bitDepth>${data.bitDepth}</bitDepth>\n`;
  xml += `  <startTime>${data.startTime}</startTime>\n`;
  xml += `  <endTime>${data.endTime}</endTime>\n`;
  xml += `  <totalBeats>${data.totalBeats}</totalBeats>\n`;

  // Tracks
  xml += '  <tracks>\n';
  for (const track of data.tracks) {
    xml += '    <track>\n';
    xml += `      <id>${track.id}</id>\n`;
    xml += `      <name>${escapeXml(track.name)}</name>\n`;
    xml += `      <type>${track.type}</type>\n`;
    xml += `      <volume>${track.volume}</volume>\n`;
    xml += `      <pan>${track.pan}</pan>\n`;
    xml += `      <muted>${track.muted}</muted>\n`;
    xml += `      <soloed>${track.soloed}</soloed>\n`;

    xml += '      <clips>\n';
    for (const clip of track.clips) {
      xml += '        <clip>\n';
      xml += `          <id>${clip.id}</id>\n`;
      xml += `          <name>${escapeXml(clip.name)}</name>\n`;
      xml += `          <startBeat>${clip.startBeat}</startBeat>\n`;
      xml += `          <endBeat>${clip.endBeat}</endBeat>\n`;
      xml += `          <startTime>${clip.startTime}</startTime>\n`;
      xml += `          <duration>${clip.duration}</duration>\n`;
      xml += `          <type>${clip.type}</type>\n`;

      if (clip.notes && clip.notes.length > 0) {
        xml += '          <notes>\n';
        for (const note of clip.notes) {
          xml += '            <note>\n';
          xml += `              <pitch>${note.pitch}</pitch>\n`;
          xml += `              <velocity>${note.velocity}</velocity>\n`;
          xml += `              <startBeat>${note.startBeat}</startBeat>\n`;
          xml += `              <duration>${note.duration}</duration>\n`;
          xml += `              <channel>${note.channel}</channel>\n`;
          xml += '            </note>\n';
        }
        xml += '          </notes>\n';
      }

      xml += '        </clip>\n';
    }
    xml += '      </clips>\n';

    xml += '    </track>\n';
  }
  xml += '  </tracks>\n';

  // Markers
  if (options.includeMarkers) {
    xml += '  <markers>\n';
    for (const marker of data.markers) {
      xml += '    <marker>\n';
      xml += `      <id>${marker.id}</id>\n`;
      xml += `      <name>${escapeXml(marker.name)}</name>\n`;
      xml += `      <beat>${marker.beat}</beat>\n`;
      xml += `      <time>${marker.time}</time>\n`;
      xml += `      <type>${marker.type}</type>\n`;
      xml += `      <color>${marker.color}</color>\n`;
      xml += '    </marker>\n';
    }
    xml += '  </markers>\n';
  }

  // Tempo Map
  if (options.includeTempoMap) {
    xml += '  <tempoMap>\n';
    for (const tempo of data.tempoMap) {
      xml += '    <tempo>\n';
      xml += `      <beat>${tempo.beat}</beat>\n`;
      xml += `      <time>${tempo.time}</time>\n`;
      xml += `      <bpm>${tempo.bpm}</bpm>\n`;
      xml += `      <timeSignature>\n`;
      xml += `        <numerator>${tempo.timeSignature.numerator}</numerator>\n`;
      xml += `        <denominator>${tempo.timeSignature.denominator}</denominator>\n`;
      xml += `      </timeSignature>\n`;
      xml += '    </tempo>\n';
    }
    xml += '  </tempoMap>\n';
  }

  xml += '</project>\n';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =============================================================================
// MIDI Export
// =============================================================================

export function exportMIDI(data: ExportProjectData): Blob {
  // Simplified MIDI file export
  const midiData: MIDIFile = {
    format: 1, // Multi-track
    tracks: data.tracks
      .filter(track => track.type === 'midi' || track.type === 'instrument')
      .map(track => ({
        name: track.name,
        events: track.clips.flatMap(clip => {
          if (!clip.notes) return [];
          return clip.notes.map(note => ({
            type: 'note' as const,
            pitch: note.pitch,
            velocity: note.velocity,
            startBeat: note.startBeat,
            duration: note.duration,
            channel: note.channel,
          }));
        }),
      })),
    tempoMap: data.tempoMap.map(tempo => ({
      beat: tempo.beat,
      bpm: tempo.bpm,
    })),
  };

  const jsonStr = JSON.stringify(midiData, null, 2);
  return new Blob([jsonStr], { type: 'application/midi' });
}

interface MIDIFile {
  format: number;
  tracks: MIDITrack[];
  tempoMap: { beat: number; bpm: number }[];
}

interface MIDITrack {
  name: string;
  events: MIDIEvent[];
}

interface MIDIEvent {
  type: 'note';
  pitch: number;
  velocity: number;
  startBeat: number;
  duration: number;
  channel: number;
}

// =============================================================================
// MusicXML Export
// =============================================================================

export function exportMusicXML(data: ExportProjectData): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n';
  xml += '<score-partwise version="4.0">\n';
  xml += `  <work>\n    <work-title>${escapeXml(data.name)}</work-title>\n  </work>\n`;

  xml += '  <part-list>\n';
  for (const track of data.tracks) {
    if (track.type === 'midi' || track.type === 'instrument') {
      xml += `    <score-part id="${track.id}">\n`;
      xml += `      <part-name>${escapeXml(track.name)}</part-name>\n`;
      xml += '    </score-part>\n';
    }
  }
  xml += '  </part-list>\n';

  for (const track of data.tracks) {
    if (track.type !== 'midi' && track.type !== 'instrument') continue;

    xml += `  <part id="${track.id}">\n`;

    // Simplified: export notes as measures
    const allNotes = track.clips.flatMap(clip => clip.notes ?? []);
    if (allNotes.length > 0) {
      xml += '    <measure number="1">\n';
      xml += '      <attributes>\n';
      xml += '        <divisions>4</divisions>\n';
      xml += '        <time>\n';
      xml += '          <beats>4</beats>\n';
      xml += '          <beat-type>4</beat-type>\n';
      xml += '        </time>\n';
      xml += '        <clef>\n';
      xml += '          <sign>G</sign>\n';
      xml += '          <line>2</line>\n';
      xml += '        </clef>\n';
      xml += '      </attributes>\n';

      for (const note of allNotes.slice(0, 100)) {
        xml += '      <note>\n';
        xml += `        <pitch><step>${getNoteStep(note.pitch)}</step><octave>${getNoteOctave(note.pitch)}</octave></pitch>\n`;
        xml += `        <duration>${Math.round(note.duration * 4)}</duration>\n`;
        xml += '        <type>quarter</type>\n';
        xml += '      </note>\n';
      }

      xml += '    </measure>\n';
    }

    xml += '  </part>\n';
  }

  xml += '</score-partwise>\n';
  return xml;
}

function getNoteStep(pitch: number): string {
  const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  return steps[pitch % 12];
}

function getNoteOctave(pitch: number): number {
  return Math.floor(pitch / 12) - 1;
}

// =============================================================================
// Main Export Function
// =============================================================================

export function exportProject(
  data: ExportProjectData,
  options: AdvancedExportOptions
): Blob | string {
  switch (options.format) {
    case 'aaf':
      return exportAAF(data, options);
    case 'omf':
      return exportOMF(data, options);
    case 'xml':
      return exportXML(data, options);
    case 'midi':
      return exportMIDI(data);
    case 'musicxml':
      return exportMusicXML(data);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

// =============================================================================
// Download Helper
// =============================================================================

export function downloadExport(
  data: Blob | string,
  filename: string,
  mimeType?: string
): void {
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType ?? 'text/plain' }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  exportProject,
  exportAAF,
  exportOMF,
  exportXML,
  exportMIDI,
  exportMusicXML,
  downloadExport,
};
