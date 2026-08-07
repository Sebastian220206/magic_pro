/**
 * Unified Library Data - Consolidated instrument/loop/effect definitions
 * Bridges engine/soundLibrary with UI components
 */
export interface Preset {
  id: string;
  name: string;
  type: 'instrument' | 'audio_effect' | 'midi_effect' | 'drum_kit';
  category: string;
  engine?: 'synth' | 'sampler' | 'drumkit' | 'multi-sampler' | 'soundfont';
  description?: string;
  tags?: string[];
  icon?: string;
  color?: string;
  samplePath?: string;
}

export interface Category {
  name: string;
  presets: Preset[];
}

export const libraryData: Category[] = [
  {
    name: "SoundFont Instruments",
    presets: [
      { id: "soundfont_instrument", name: "SoundFont Instrument", type: "instrument", category: "SoundFont Instruments", engine: "soundfont", description: "Load .sf2 files for playback", icon: "music", color: "#FF6B35" },
    ],
  },
];

export function getAllPresets(): Preset[] {
  return libraryData.flatMap(cat => cat.presets);
}

export function getPresetsByCategory(category: string): Preset[] {
  return libraryData.find(c => c.name === category)?.presets ?? [];
}

export function getPresetById(id: string): Preset | undefined {
  return getAllPresets().find(p => p.id === id);
}

export function searchPresets(query: string): Preset[] {
  const q = query.toLowerCase();
  return getAllPresets().filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.description?.toLowerCase().includes(q) ||
    p.tags?.some(t => t.toLowerCase().includes(q))
  );
}
