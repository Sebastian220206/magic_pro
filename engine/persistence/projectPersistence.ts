import { getIndexedDBAdapter, type ProjectData, type ProjectMetadata } from '@/engine/filesystem/indexedDBAdapter';
import { migrateProject } from './migration';

export const CURRENT_SCHEMA_VERSION = 1;

export interface PersistedProject {
  version: number;
  schemaVersion: number;
  savedAt: number;
  state: SerializedState;
}

export interface SerializedState {
  id: string | null;
  name: string;
  tempo: number;
  timeSignature: string;
  keySignature: string;
  playhead: number;
  tracks: any[];
  /** Inserts across the summed mix. */
  masterPlugins?: any[];
  clips: any[];
  annotations?: any[];
  globalTracks: any;
  settings: any;
  globalSettings: any;
  environment: any;
  alternatives: any[];
  currentAlternativeId: string | null;
  projectFormat: string;
  surroundFormat: string;
  spatialAudioMode: string;
  zoom: number;
  trackHeight: number;
  snap: string;
  metronomeEnabled: boolean;
  countInEnabled: boolean;
  countInBars: number;
  cycleEnabled: boolean;
  locatorLeft: number;
  locatorRight: number;
  selectedTrackIds: string[];
  focusedTrackId: string | null;
  selectedClipId: string | null;
  selectedClipIds: string[];
  articulationSets: any[];
  channelStripSettings: any[];
  channelStripCopyBuffer: any | null;
  channelStripPerformances: any[];
  mixerState?: any;
}

const DB_KEY_PREFIX = 'magicpro-project-';

function getAdapter() {
  return getIndexedDBAdapter();
}

export async function saveToIndexedDB(projectId: string, state: SerializedState): Promise<void> {
  const adapter = getAdapter();
  const now = Date.now();

  // ── Backup protection: load existing data before overwriting ────────────
  let backup: string | null = null;
  try {
    const existing = await adapter.loadProject(projectId);
    if (existing) {
      backup = existing.projectJson;
    }
  } catch {
    // No existing data — first save, no backup needed
  }

  const json = JSON.stringify({
    version: CURRENT_SCHEMA_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: now,
    state,
  });

  const metadata: ProjectMetadata = {
    id: projectId,
    name: state.name,
    createdAt: now,
    modifiedAt: now,
    version: 1,
    duration: state.settings?.projectEnd || 128,
    trackCount: state.tracks.length,
    assetCount: 0,
    size: new Blob([json]).size,
  };

  const backupVersions = backup
    ? [{ version: 1, timestamp: now, data: backup }]
    : [];

  const data: ProjectData = {
    metadata,
    projectJson: json,
    backupVersions,
  };

  try {
    await adapter.saveProject(projectId, data);
  } catch (e) {
    // ── Crash recovery: if save fails and we have backup, attempt restore ──
    if (backup) {
      console.error('[Persistence] Save failed, restoring backup:', e);
      try {
        const restoreData: ProjectData = {
          metadata: { ...metadata, modifiedAt: now },
          projectJson: backup,
          backupVersions: [],
        };
        await adapter.saveProject(projectId, restoreData);
        console.log('[Persistence] Backup restored successfully');
      } catch (restoreErr) {
        console.error('[Persistence] Backup restore also failed:', restoreErr);
      }
    }
    throw e;
  }
}

export async function loadFromIndexedDB(projectId: string): Promise<PersistedProject | null> {
  const adapter = getAdapter();
  const data = await adapter.loadProject(projectId);
  if (!data) return null;

  // Try primary data first
  try {
    const parsed = JSON.parse(data.projectJson);
    const migrated = migrateProject(parsed);
    return migrated as PersistedProject;
  } catch (primaryErr) {
    console.warn('[Persistence] Primary data corrupted, trying backup:', primaryErr);

    // Fallback to latest backup version
    if (data.backupVersions?.length) {
      const sorted = [...data.backupVersions].sort((a, b) => b.timestamp - a.timestamp);
      for (const backup of sorted) {
        try {
          const parsed = JSON.parse(backup.data);
          const migrated = migrateProject(parsed);
          console.log('[Persistence] Recovered from backup version', backup.version);
          return migrated as PersistedProject;
        } catch {
          continue;
        }
      }
    }

    return null;
  }
}

export async function deleteFromIndexedDB(projectId: string): Promise<void> {
  const adapter = getAdapter();
  await adapter.deleteProject(projectId);
}

export async function listLocalProjects(): Promise<ProjectMetadata[]> {
  const adapter = getAdapter();
  return adapter.listProjects();
}

function serializeWaveformPeaks(wp: any): any {
  if (!wp || !wp.channels) return wp;
  return {
    ...wp,
    channels: wp.channels.map((ch: any) => ({
      min: Array.from(ch.min ?? ch),
      max: Array.from(ch.max ?? ch),
    })),
  };
}

function deserializeWaveformPeaks(wp: any): any {
  if (!wp || !wp.channels) return wp;
  return {
    ...wp,
    channels: wp.channels.map((ch: any) => ({
      min: ch.min ? new Float32Array(ch.min) : ch,
      max: ch.max ? new Float32Array(ch.max) : ch,
    })),
  };
}

export function serializeStoreState(getState: () => any, extra?: { mixerState?: any }): SerializedState {
  const s = getState();
  return {
    id: s.id,
    name: s.name,
    tempo: s.tempo,
    timeSignature: s.timeSignature,
    keySignature: s.keySignature,
    playhead: s.playhead,
    tracks: s.tracks,
    masterPlugins: s.masterPlugins ?? [],
    clips: (s.clips ?? []).map((c: any) => ({
      ...c,
      waveformPeaks: serializeWaveformPeaks(c.waveformPeaks),
    })),
    annotations: s.annotations ?? [],
    globalTracks: s.globalTracks,
    settings: s.settings,
    globalSettings: s.globalSettings,
    environment: s.environment,
    alternatives: s.alternatives,
    currentAlternativeId: s.currentAlternativeId,
    projectFormat: s.projectFormat,
    surroundFormat: s.surroundFormat,
    spatialAudioMode: s.spatialAudioMode,
    zoom: s.zoom,
    trackHeight: s.trackHeight,
    snap: s.snap,
    metronomeEnabled: s.metronomeEnabled,
    countInEnabled: s.countInEnabled,
    countInBars: s.countInBars,
    cycleEnabled: s.cycleEnabled,
    locatorLeft: s.locatorLeft,
    locatorRight: s.locatorRight,
    selectedTrackIds: s.selectedTrackIds,
    focusedTrackId: s.focusedTrackId,
    selectedClipId: s.selectedClipId,
    selectedClipIds: s.selectedClipIds,
    articulationSets: s.articulationSets,
    channelStripSettings: s.channelStripSettings,
    channelStripCopyBuffer: s.channelStripCopyBuffer,
    channelStripPerformances: s.channelStripPerformances,
    mixerState: extra?.mixerState,
  };
}

export function deserializeState(serialized: SerializedState): Partial<any> {
  return {
    id: serialized.id,
    name: serialized.name,
    tempo: serialized.tempo,
    timeSignature: serialized.timeSignature,
    keySignature: serialized.keySignature,
    playhead: serialized.playhead,
    tracks: serialized.tracks,
    masterPlugins: serialized.masterPlugins ?? [],
    clips: (serialized.clips ?? []).map((c: any) => ({
      ...c,
      waveformPeaks: deserializeWaveformPeaks(c.waveformPeaks),
    })),
    annotations: serialized.annotations ?? [],
    globalTracks: serialized.globalTracks,
    settings: serialized.settings,
    globalSettings: serialized.globalSettings,
    environment: serialized.environment,
    alternatives: serialized.alternatives,
    currentAlternativeId: serialized.currentAlternativeId,
    projectFormat: serialized.projectFormat,
    surroundFormat: serialized.surroundFormat,
    spatialAudioMode: serialized.spatialAudioMode,
    zoom: serialized.zoom,
    trackHeight: serialized.trackHeight,
    snap: serialized.snap as any,
    metronomeEnabled: serialized.metronomeEnabled,
    countInEnabled: serialized.countInEnabled,
    countInBars: serialized.countInBars,
    cycleEnabled: serialized.cycleEnabled,
    locatorLeft: serialized.locatorLeft,
    locatorRight: serialized.locatorRight,
    selectedTrackIds: serialized.selectedTrackIds,
    focusedTrackId: serialized.focusedTrackId,
    selectedClipId: serialized.selectedClipId,
    selectedClipIds: serialized.selectedClipIds,
    articulationSets: serialized.articulationSets,
    channelStripSettings: serialized.channelStripSettings,
    channelStripCopyBuffer: serialized.channelStripCopyBuffer,
    channelStripPerformances: serialized.channelStripPerformances,
    isDirty: false,
    recording: false,
    playing: false,
    recordingStartTime: null,
    liveRecordingClips: {},
  };
}
