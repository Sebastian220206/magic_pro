export type ParamType = 'float' | 'int' | 'boolean' | 'enum';

export interface PluginParameter {
  id: string;
  name: string;
  type: ParamType;
  defaultValue: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  unit?: string;
  automatable: boolean;
  enumValues?: string[];
}

export interface AudioIOConfig {
  numInputs: number;
  numOutputs: number;
  supportsMidi: boolean;
}

export interface PluginManifest {
  manifestVersion: number;
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  type: 'effect' | 'instrument';
  category: string;
  parameters: PluginParameter[];
  audioIO: AudioIOConfig;
  wasmUrl?: string;
  ui?: {
    url?: string;
    component?: string;
    width?: number;
    height?: number;
  };
}

export interface PluginUIContract {
  trackId: string;
  pluginId: string;
  manifest: PluginManifest;
  params: Record<string, number>;
  onParamChange: (paramId: string, value: number) => void;
  onPresetLoad?: (presetId: string) => void;
}

export function validateManifest(raw: unknown): raw is PluginManifest {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Record<string, unknown>;
  if (typeof m.manifestVersion !== 'number') return false;
  if (typeof m.id !== 'string' || !m.id) return false;
  if (typeof m.name !== 'string' || !m.name) return false;
  if (typeof m.version !== 'string' || !m.version) return false;
  if (m.type !== 'effect' && m.type !== 'instrument') return false;
  if (!Array.isArray(m.parameters)) return false;
  if (!m.audioIO || typeof m.audioIO !== 'object') return false;
  const io = m.audioIO as Record<string, unknown>;
  if (typeof io.numInputs !== 'number' || typeof io.numOutputs !== 'number') return false;
  return true;
}

export function generateDefaultParams(manifest: PluginManifest): Record<string, number> {
  const params: Record<string, number> = {};
  for (const p of manifest.parameters) {
    params[p.id] = p.defaultValue;
  }
  return params;
}
