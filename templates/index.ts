/**
 * index.ts
 * Creating a real project from a template.
 *
 * This module reaches the audio engine and the project store, so importing it
 * pulls the whole DAW. Anything that only needs to *list* templates should
 * import `./catalog` instead — see the note there.
 *
 * The catalogue is re-exported so existing importers keep working unchanged.
 */

import { ProjectTemplate, TemplateTrackDef, TemplateClipDef } from './types';
import { audioEngine } from '@/engine/AudioEngineAdapter';
import { useProjectStore } from '@/store/projectStore';
import type { Track } from '@/models/Track';
import type { Clip } from '@/models/Clip';

export {
  templateCatalog,
  getTemplateById,
  starterTemplates,
  defaultTemplate,
} from './catalog';

function freshId(prefix = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildTrack(td: TemplateTrackDef, index: number): Track {
  return {
    id: freshId('track-'),
    name: td.name,
    type: td.type === 'audio' ? 'audio' : td.type === 'drummer' ? 'drummer' : 'software-instrument',
    muted: td.muted,
    soloed: td.soloed,
    volume: td.volume,
    pan: td.pan,
    color: td.color,
    orderIndex: index,
    recordEnabled: td.recordEnabled ?? false,
    inputMonitoring: td.inputMonitoring ?? false,
    protected: false,
    frozen: false,
    enabled: true,
    freezeMode: 'Source Only',
    alternatives: [{ id: 'alt-1', name: 'A' }],
    activeAlternativeId: 'alt-1',
    showInactiveAlternatives: false,
    instrument: td.instrument,
    icon: td.icon,
    transpose: 0,
    velocityOffset: 0,
    delay: 0,
    plugins: (td.plugins || []).map(p => ({
      id: freshId('plugin-'),
      pluginId: p.pluginId,
      name: p.name,
      enabled: true,
      params: p.params || {},
    })),
    sends: td.sends || [],
    outputBusId: td.outputBusId || 'stereo-out',
    channelStripId: freshId('strip-'),
    zoom: 1,
    hidden: false,
    isCollapsed: false,
    isGrooveTrack: false,
    matchGrooveTrack: false,
  };
}

function buildClip(cd: TemplateClipDef, tracks: Track[], template: ProjectTemplate): Clip {
  const track = tracks[cd.trackIndex];
  return {
    id: freshId('clip-'),
    trackId: track.id,
    type: cd.type,
    name: cd.name,
    color: cd.color,
    alternativeId: 'alt-1',
    startBeat: cd.startBeat,
    start: cd.startBeat,
    startTime: cd.startBeat,
    duration: cd.duration,
    offset: 0,
    muted: false,
    loop: cd.loop ?? false,
    qSwing: 0,
    transpose: 0,
    velocityOffset: 0,
    fileUrl: cd.fileUrl,
    notes: cd.notes?.map(n => ({
      id: freshId('note-'),
      pitch: n.pitch,
      velocity: n.velocity,
      start: n.start,
      duration: n.duration,
    })),
    fadeIn: { duration: 0, curve: 'linear', gain: 1 },
    fadeOut: { duration: 0, curve: 'linear', gain: 1 },
    playbackRate: 1,
    pitchOffset: 0,
    stretchMode: 'none',
  };
}

export async function createProjectFromTemplate(template: ProjectTemplate): Promise<{ id: string }> {
  await audioEngine.waitForReady();

  const projectId = freshId('proj-');
  const tracks = template.tracks.map((td, i) => buildTrack(td, i));
  const clips = template.clips.map(cd => buildClip(cd, tracks, template));

  const store = useProjectStore.getState();

  store.saveHistorySnapshot();

  store.initializeProject({
    tempo: template.bpm,
    keySignature: template.keySignature,
    timeSignature: template.timeSignature,
  });

  useProjectStore.setState({
    id: projectId,
    name: template.name,
    tempo: template.bpm,
    tracks,
    clips,
    isDirty: true,
  });

  audioEngine.setTempo(template.bpm);

  tracks.forEach(t => {
    audioEngine.createTrack(t.id);
    audioEngine.updateTrackParams(t.id, t.volume, t.pan);
    if (t.muted) audioEngine.muteTrack(t.id);
    if (t.instrument) {
      audioEngine.loadInstrument(t.id, t.instrument).catch((e: any) => console.error('[Templates] Failed to load instrument:', e));
    }
  });

  return { id: projectId };
}
