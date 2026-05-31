export interface TemplateTrackDef {
  name: string;
  type: 'audio' | 'instrument' | 'drummer';
  instrument?: string;
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  icon?: string;
  plugins?: { pluginId: string; name: string; params?: Record<string, number> }[];
  sends?: { busId: string; level: number }[];
  outputBusId?: string;
  recordEnabled?: boolean;
  inputMonitoring?: boolean;
}

export interface TemplateClipDef {
  trackIndex: number;
  type: 'audio' | 'midi';
  name: string;
  startBeat: number;
  duration: number;
  color: string;
  fileUrl?: string;
  notes?: { pitch: number; velocity: number; start: number; duration: number }[];
  loop?: boolean;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  bpm: number;
  timeSignature: string;
  keySignature: string;
  accentColor: string;
  previewIcon: string;
  tracks: TemplateTrackDef[];
  clips: TemplateClipDef[];
}
