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

export interface LoopPack {
  id: string;
  name: string;
  genre: string;
  description: string;
  loops: LoopItem[];
}

export interface LoopItem {
  id: string;
  name: string;
  path: string;
  bpm: number;
  key?: string;
  duration?: number;
  type: 'drum' | 'bass' | 'melodic' | 'fx' | 'percussion';
}

export const libraryData: Category[] = [
  {
    name: "Pianos & Keys",
    presets: [
      { id: "grand_piano", name: "Grand Piano", type: "instrument", category: "Pianos & Keys", engine: "multi-sampler", description: "Acoustic grand piano with realistic sustain", icon: "piano", color: "#3B82F6" },
      { id: "electric_piano", name: "Electric Piano", type: "instrument", category: "Pianos & Keys", engine: "sampler", description: "Classic electric piano with bell-like tone", icon: "piano", color: "#10B981" },
      { id: "harpsichord", name: "Harpsichord", type: "instrument", category: "Pianos & Keys", engine: "sampler", description: "Baroque harpsichord with authentic pluck", icon: "piano", color: "#F59E0B" },
      { id: "vibraphone", name: "Vibraphone", type: "instrument", category: "Pianos & Keys", engine: "sampler", description: "Jazz vibraphone with motor vibrato", icon: "piano", color: "#8B5CF6" },
      { id: "clavinet", name: "Clavinet", type: "instrument", category: "Pianos & Keys", engine: "synth", description: "Funky clavinet with percussive attack", icon: "piano", color: "#EF4444" },
      { id: "hammond_organ", name: "Hammond Organ", type: "instrument", category: "Pianos & Keys", engine: "synth", description: "Classic tonewheel organ", icon: "piano", color: "#EC4899" },
    ],
  },
  {
    name: "Synthesizers",
    presets: [
      { id: "analog_pad", name: "Analog Pad", type: "instrument", category: "Synthesizers", engine: "synth", description: "Warm analog-style pad", icon: "synth", color: "#06B6D4" },
      { id: "lead_synth", name: "Lead Synth", type: "instrument", category: "Synthesizers", engine: "synth", description: "Cutting lead with filter sweep", icon: "synth", color: "#84CC16" },
      { id: "warm_strings", name: "Warm Strings", type: "instrument", category: "Synthesizers", engine: "synth", description: "Rich layered string ensemble", icon: "synth", color: "#3B82F6" },
      { id: "deep_bass", name: "Deep Bass", type: "instrument", category: "Synthesizers", engine: "synth", description: "Sub-heavy bass with punch", icon: "synth", color: "#10B981" },
      { id: "pluck_synth", name: "Pluck Synth", type: "instrument", category: "Synthesizers", engine: "synth", description: "Bright plucked synth with fast decay", icon: "synth", color: "#F59E0B" },
      { id: "brass_section", name: "Brass Section", type: "instrument", category: "Synthesizers", engine: "synth", description: "Synthetic brass ensemble", icon: "synth", color: "#EF4444" },
      { id: "bell_tone", name: "Bell Tone", type: "instrument", category: "Synthesizers", engine: "synth", description: "Crystalline bell with long decay", icon: "synth", color: "#8B5CF6" },
      { id: "ambient_pad", name: "Ambient Pad", type: "instrument", category: "Synthesizers", engine: "synth", description: "Evolving ambient texture", icon: "synth", color: "#EC4899" },
      { id: "arp_synth", name: "Arp Synth", type: "instrument", category: "Synthesizers", engine: "synth", description: "Bright arpeggiator synth", icon: "synth", color: "#06B6D4" },
      { id: "wobble_bass", name: "Wobble Bass", type: "instrument", category: "Synthesizers", engine: "synth", description: "Dubstep-style wobble with resonance", icon: "synth", color: "#84CC16" },
      { id: "fx_noise", name: "FX Noise", type: "instrument", category: "Synthesizers", engine: "synth", description: "Atmospheric noise textures", icon: "synth", color: "#78716C" },
      { id: "sub_drop", name: "Sub Drop", type: "instrument", category: "Synthesizers", engine: "synth", description: "Deep sub-bass with slow decay", icon: "synth", color: "#292524" },
    ],
  },
  {
    name: "Orchestral",
    presets: [
      { id: "string_ensemble", name: "String Ensemble", type: "instrument", category: "Orchestral", engine: "sampler", description: "Full string ensemble with expressive dynamics", icon: "orchestra", color: "#3B82F6" },
      { id: "woodwinds", name: "Woodwinds", type: "instrument", category: "Orchestral", engine: "sampler", description: "Flute, clarinet, and oboe ensemble", icon: "orchestra", color: "#10B981" },
      { id: "brass_ensemble", name: "Brass Ensemble", type: "instrument", category: "Orchestral", engine: "sampler", description: "Full brass section", icon: "orchestra", color: "#F59E0B" },
      { id: "choir", name: "Choir", type: "instrument", category: "Orchestral", engine: "sampler", description: "Vocal chorus", icon: "orchestra", color: "#8B5CF6" },
    ],
  },
  {
    name: "Drum Kits",
    presets: [
      { id: "trap_kit", name: "Trap Kit", type: "drum_kit", category: "Drum Kits", engine: "drumkit", description: "Modern trap drum kit with 808s", icon: "drums", color: "#EF4444" },
      { id: "acoustic_kit", name: "Acoustic Kit", type: "drum_kit", category: "Drum Kits", engine: "drumkit", description: "Natural acoustic drum kit", icon: "drums", color: "#F59E0B" },
      { id: "808_classic", name: "808 Classic", type: "drum_kit", category: "Drum Kits", engine: "drumkit", description: "Classic Roland TR-808 sounds", icon: "drums", color: "#EC4899" },
      { id: "electronic_kit", name: "Electronic Kit", type: "drum_kit", category: "Drum Kits", engine: "drumkit", description: "Modern electronic drum sounds", icon: "drums", color: "#06B6D4" },
      { id: "jazz_kit", name: "Jazz Kit", type: "drum_kit", category: "Drum Kits", engine: "drumkit", description: "Jazz-style brush and ride-focused kit", icon: "drums", color: "#10B981" },
      { id: "world_percussion", name: "World Percussion", type: "drum_kit", category: "Drum Kits", engine: "drumkit", description: "Congas, bongos, djembe, and hand percussion", icon: "drums", color: "#F59E0B" },
    ],
  },
  {
    name: "SoundFont Instruments",
    presets: [
      { id: "soundfont_instrument", name: "SoundFont Instrument", type: "instrument", category: "SoundFont Instruments", engine: "soundfont", description: "Load .sf2 files for playback", icon: "music", color: "#FF6B35" },
    ],
  },
  {
    name: "Audio Effects",
    presets: [
      { id: "reverb_space", name: "Space Reverb", type: "audio_effect", category: "Audio Effects", description: "Large hall reverb", icon: "effect", color: "#06B6D4" },
      { id: "compressor_pro", name: "Pro Compressor", type: "audio_effect", category: "Audio Effects", description: "Studio-grade dynamics processing", icon: "effect", color: "#84CC16" },
      { id: "echo_delay", name: "Tape Echo", type: "audio_effect", category: "Audio Effects", description: "Warm analog-style delay", icon: "effect", color: "#3B82F6" },
    ],
  },
];

export const loopPacks: LoopPack[] = [
  {
    id: "house",
    name: "House Essentials",
    genre: "House",
    description: "Four-on-the-floor house loops and percussion",
    loops: [
      { id: "hh_kick_01", name: "House Kick 01", path: "/audio/loops/drums/drums_house_01.wav", bpm: 126, type: "drum" },
      { id: "hh_kick_02", name: "House Kick 02", path: "/audio/loops/drums/drums_house_02.wav", bpm: 124, type: "drum" },
    ],
  },
  {
    id: "lofi",
    name: "Lo-Fi Beats",
    genre: "Lo-Fi",
    description: "Chilled lo-fi drum loops and textures",
    loops: [
      { id: "lf_kick_01", name: "Lo-Fi Beat 01", path: "/audio/loops/drums/drums_lofi_01.wav", bpm: 85, type: "drum" },
      { id: "lf_kick_02", name: "Lo-Fi Beat 02", path: "/audio/loops/drums/drums_lofi_02.wav", bpm: 90, type: "drum" },
    ],
  },
  {
    id: "trap",
    name: "Trap Beats",
    genre: "Trap",
    description: "Hard-hitting trap drum patterns",
    loops: [
      { id: "tp_kick_01", name: "Trap Beat 01", path: "/audio/loops/drums/drums_trap_01.wav", bpm: 140, type: "drum" },
      { id: "tp_kick_02", name: "Trap Beat 02", path: "/audio/loops/drums/drums_trap_02.wav", bpm: 150, type: "drum" },
    ],
  },
  {
    id: "techno",
    name: "Techno Grooves",
    genre: "Techno",
    description: "Driving techno percussion",
    loops: [
      { id: "tn_kick_01", name: "Techno Beat 01", path: "/audio/loops/drums/drums_techno_01.wav", bpm: 130, type: "drum" },
      { id: "tn_kick_02", name: "Techno Beat 02", path: "/audio/loops/drums/drums_techno_02.wav", bpm: 128, type: "drum" },
    ],
  },
  {
    id: "hiphop",
    name: "Hip-Hop Beats",
    genre: "Hip-Hop",
    description: "Classic hip-hop drum patterns",
    loops: [
      { id: "hh_kick_01", name: "Hip-Hop Beat 01", path: "/audio/loops/drums/drums_hiphop_01.wav", bpm: 95, type: "drum" },
      { id: "hh_kick_02", name: "Hip-Hop Beat 02", path: "/audio/loops/drums/drums_hiphop_02.wav", bpm: 100, type: "drum" },
    ],
  },
  {
    id: "funk",
    name: "Funk & Soul",
    genre: "Funk",
    description: "Funky drum breaks",
    loops: [
      { id: "fk_kick_01", name: "Funk Beat 01", path: "/audio/loops/drums/drums_funk_01.wav", bpm: 108, type: "drum" },
    ],
  },
  {
    id: "rock",
    name: "Rock Drums",
    genre: "Rock",
    description: "Live rock drum grooves",
    loops: [
      { id: "rk_kick_01", name: "Rock Beat 01", path: "/audio/loops/drums/drums_rock_01.wav", bpm: 120, type: "drum" },
    ],
  },
  {
    id: "bass",
    name: "Bass Grooves",
    genre: "Bass",
    description: "Bass loops across genres",
    loops: [
      { id: "bs_deep_01", name: "Deep Bass 01", path: "/audio/loops/bass/bass_deep_01.wav", bpm: 120, type: "bass" },
      { id: "bs_deep_02", name: "Deep Bass 02", path: "/audio/loops/bass/bass_deep_02.wav", bpm: 100, type: "bass" },
      { id: "bs_walk_01", name: "Walking Bass 01", path: "/audio/loops/bass/bass_walking_01.wav", bpm: 120, type: "bass" },
      { id: "bs_sub_01", name: "Sub Bass 01", path: "/audio/loops/bass/bass_sub_01.wav", bpm: 140, type: "bass" },
      { id: "bs_elec_01", name: "Electro Bass 01", path: "/audio/loops/bass/bass_electro_01.wav", bpm: 128, type: "bass" },
    ],
  },
  {
    id: "melodic",
    name: "Melodic Elements",
    genre: "Melodic",
    description: "Keys, guitars, and ambient melodic loops",
    loops: [
      { id: "ml_keys_01", name: "Keys 01", path: "/audio/loops/melodic/melodic_keys_01.wav", bpm: 120, type: "melodic" },
      { id: "ml_keys_02", name: "Keys 02", path: "/audio/loops/melodic/melodic_keys_02.wav", bpm: 100, type: "melodic" },
      { id: "ml_guitar_01", name: "Guitar 01", path: "/audio/loops/melodic/melodic_guitar_01.wav", bpm: 120, type: "melodic" },
      { id: "ml_strings_01", name: "Strings 01", path: "/audio/loops/melodic/melodic_strings_01.wav", bpm: 90, type: "melodic" },
      { id: "ml_ambient_01", name: "Ambient Pad 01", path: "/audio/loops/melodic/melodic_ambient_01.wav", bpm: 80, type: "melodic" },
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

export function getLoopsByGenre(genre: string): LoopItem[] {
  return loopPacks.find(p => p.genre === genre)?.loops ?? [];
}

export function getAllLoopItems(): LoopItem[] {
  return loopPacks.flatMap(p => p.loops);
}
