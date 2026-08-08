import midiLoops from './midiLoops.json';

/** A loop exactly as `generate-midi-loops.mjs` writes it. */
interface GeneratedLoop {
  id: string;
  name: string;
  category: string;
  genre: string;
  instrument: string;
  bpm: number;
  beats: number;
  key?: string;
  program?: number;
  drums?: boolean;
  /** [pitch, velocity, startBeat, durationBeats] */
  notes: [number, number, number, number][];
}

/**
 * A single note in a MIDI loop.
 *
 * Stored on disk as a compact tuple — `[pitch, velocity, startBeat,
 * durationBeats]` — because the generated library holds several thousand of
 * them and object keys would roughly triple the file. Expanded to this shape
 * on load.
 */
export interface LoopNote {
  /** MIDI note number, 0-127. */
  pitch: number;
  /** 1-127. */
  velocity: number;
  /** Beats from the start of the loop. */
  start: number;
  /** Length in beats. */
  duration: number;
}

export interface LoopAsset {
  id: string;
  name: string;
  category: 'drums' | 'bass' | 'melodic';
  bpm: number;
  key?: string;
  /**
   * Audio file, for sample-based loops.
   *
   * Absent on MIDI loops, which is now most of the library — see `notes`.
   */
  path?: string;
  duration: number;
  beats: number;
  genre: string;
  instrument: string;
  pack?: string;

  /**
   * The loop as MIDI, when it has one.
   *
   * Present on generated loops, absent on the sampled ones. A MIDI loop is
   * dropped onto the timeline as an editable MIDI clip rather than an audio
   * region, so the user can transpose it, change the instrument or fix a
   * single note — none of which an audio loop allows.
   */
  notes?: LoopNote[];

  /**
   * General MIDI program the loop was written for, 0-127.
   *
   * A suggestion, not a requirement: the clip plays on whatever instrument the
   * target track already has, and this is used only when the track has none.
   */
  program?: number;

  /**
   * True when pitches are General MIDI drum-map notes rather than pitches.
   *
   * 36 is a kick, 38 a snare, 42 a closed hat. Both the SoundFont's bank-128
   * kits and the built-in drum machine use these same numbers.
   */
  drums?: boolean;
}

export interface GenrePack {
  id: string;
  name: string;
  genre: string;
  description: string;
  color: string;
  loopIds: string[];
}

const sampledLoops: LoopAsset[] = [
  // ── Drums ──────────────────────────────────────────────────────────────
  {
    id: 'drums_house_01',
    name: 'House Beat 01',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_house_01.wav',
    duration: 2,
    beats: 4,
    genre: 'House',
    instrument: 'Drums',
    pack: 'house_essentials',
  },
  {
    id: 'drums_house_02',
    name: 'House Beat 02',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_house_02.wav',
    duration: 2,
    beats: 4,
    genre: 'House',
    instrument: 'Drums',
    pack: 'house_essentials',
  },
  {
    id: 'drums_lofi_01',
    name: 'Lo-fi Beat 01',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_lofi_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Lo-fi',
    instrument: 'Drums',
    pack: 'lofi_study',
  },
  {
    id: 'drums_lofi_02',
    name: 'Lo-fi Beat 02',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_lofi_02.wav',
    duration: 2,
    beats: 4,
    genre: 'Lo-fi',
    instrument: 'Drums',
    pack: 'lofi_study',
  },
  {
    id: 'drums_trap_01',
    name: 'Trap Beat 01',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_trap_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Trap',
    instrument: 'Drums',
    pack: 'trap_essentials',
  },
  {
    id: 'drums_trap_02',
    name: 'Trap Beat 02',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_trap_02.wav',
    duration: 2,
    beats: 4,
    genre: 'Trap',
    instrument: 'Drums',
    pack: 'trap_essentials',
  },
  {
    id: 'drums_techno_01',
    name: 'Techno Beat 01',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_techno_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Techno',
    instrument: 'Drums',
    pack: 'techno_warehouse',
  },
  {
    id: 'drums_techno_02',
    name: 'Techno Beat 02',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_techno_02.wav',
    duration: 2,
    beats: 4,
    genre: 'Techno',
    instrument: 'Drums',
    pack: 'techno_warehouse',
  },
  {
    id: 'drums_hiphop_01',
    name: 'Hip Hop Beat 01',
    category: 'drums',
    bpm: 120,
    key: 'C',
    path: '/audio/loops/drums/drums_hiphop_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Hip Hop',
    instrument: 'Drums',
    pack: 'hiphop_bangers',
  },
  {
    id: 'drums_hiphop_02',
    name: 'Hip Hop Beat 02',
    category: 'drums',
    bpm: 120,
    key: 'C',
    path: '/audio/loops/drums/drums_hiphop_02.wav',
    duration: 2,
    beats: 4,
    genre: 'Hip Hop',
    instrument: 'Drums',
    pack: 'hiphop_bangers',
  },
  {
    id: 'drums_funk_01',
    name: 'Funk Beat 01',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_funk_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Funk',
    instrument: 'Drums',
    pack: 'funk_grooves',
  },
  {
    id: 'drums_rock_01',
    name: 'Rock Beat 01',
    category: 'drums',
    bpm: 120,
    path: '/audio/loops/drums/drums_rock_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Rock',
    instrument: 'Drums',
    pack: 'rock_anthems',
  },

  // ── Bass ───────────────────────────────────────────────────────────────
  {
    id: 'bass_deep_01',
    name: 'Deep Bass 01',
    category: 'bass',
    bpm: 120,
    key: 'Am',
    path: '/audio/loops/bass/bass_deep_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Deep House',
    instrument: 'Bass Synth',
    pack: 'deep_house_grooves',
  },
  {
    id: 'bass_deep_02',
    name: 'Deep Bass 02',
    category: 'bass',
    bpm: 120,
    key: 'C',
    path: '/audio/loops/bass/bass_deep_02.wav',
    duration: 2,
    beats: 4,
    genre: 'Deep House',
    instrument: 'Bass Synth',
    pack: 'deep_house_grooves',
  },
  {
    id: 'bass_walking_01',
    name: 'Walking Bass 01',
    category: 'bass',
    bpm: 120,
    key: 'Am',
    path: '/audio/loops/bass/bass_walking_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Jazz',
    instrument: 'Upright Bass',
    pack: 'jazz_standards',
  },
  {
    id: 'bass_sub_01',
    name: 'Sub Bass 01',
    category: 'bass',
    bpm: 120,
    key: 'D',
    path: '/audio/loops/bass/bass_sub_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Dubstep',
    instrument: 'Sub Bass',
    pack: 'electronic_bass',
  },
  {
    id: 'bass_electro_01',
    name: 'Electro Bass 01',
    category: 'bass',
    bpm: 120,
    key: 'C',
    path: '/audio/loops/bass/bass_electro_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Electro',
    instrument: 'Bass Synth',
    pack: 'electronic_bass',
  },

  // ── Melodic ────────────────────────────────────────────────────────────
  {
    id: 'melodic_keys_01',
    name: 'Keys Chord 01',
    category: 'melodic',
    bpm: 120,
    key: 'C',
    path: '/audio/loops/melodic/melodic_keys_01.wav',
    duration: 2,
    beats: 4,
    genre: 'House',
    instrument: 'Piano',
    pack: 'house_essentials',
  },
  {
    id: 'melodic_keys_02',
    name: 'Keys Melody 01',
    category: 'melodic',
    bpm: 120,
    key: 'C',
    path: '/audio/loops/melodic/melodic_keys_02.wav',
    duration: 2,
    beats: 4,
    genre: 'House',
    instrument: 'Piano',
    pack: 'house_essentials',
  },
  {
    id: 'melodic_guitar_01',
    name: 'Guitar Riff 01',
    category: 'melodic',
    bpm: 120,
    key: 'C',
    path: '/audio/loops/melodic/melodic_guitar_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Pop',
    instrument: 'Acoustic Guitar',
    pack: 'pop_hits',
  },
  {
    id: 'melodic_strings_01',
    name: 'Strings Pad 01',
    category: 'melodic',
    bpm: 120,
    key: 'C',
    path: '/audio/loops/melodic/melodic_strings_01.wav',
    duration: 2,
    beats: 4,
    genre: 'Cinematic',
    instrument: 'Strings',
    pack: 'cinematic_scores',
  },
  {
    id: 'melodic_ambient_01',
    name: 'Ambient Pad 01',
    category: 'melodic',
    bpm: 120,
    key: 'C',
    path: '/audio/loops/melodic/melodic_ambient_01.wav',
    duration: 4,
    beats: 8,
    genre: 'Ambient',
    instrument: 'Synth Pad',
    pack: 'ambient_textures',
  },
];

/**
 * The generated MIDI library.
 *
 * Built by `scripts/generate-midi-loops.mjs` from chord progressions, drum
 * grids and scale theory, then committed. Notes arrive as compact tuples and
 * are expanded here — see `LoopNote` for why they are stored that way.
 */
const generatedLoops: LoopAsset[] = (midiLoops.loops as GeneratedLoop[]).map(loop => ({
  id: loop.id,
  name: loop.name,
  category: loop.category as LoopAsset['category'],
  bpm: loop.bpm,
  key: loop.key,
  // Beats are the source of truth for a MIDI loop; seconds are derived so the
  // browser can show a duration without knowing the project tempo.
  duration: (loop.beats * 60) / loop.bpm,
  beats: loop.beats,
  genre: loop.genre,
  instrument: loop.instrument,
  pack: `${loop.genre.toLowerCase().replace(/[^a-z]/g, '')}_generated`,
  program: loop.program,
  drums: loop.drums,
  notes: loop.notes.map(([pitch, velocity, start, duration]) => ({
    pitch, velocity, start, duration,
  })),
}));

/**
 * Everything the loop browser offers.
 *
 * Sampled loops first: they are recordings, and a recording beats a
 * synthesised approximation of the same thing when both exist.
 */
export const loopLibrary: LoopAsset[] = [...sampledLoops, ...generatedLoops];

export const genrePacks: GenrePack[] = [
  { id: 'house_essentials', name: 'House Essentials', genre: 'House', description: 'Four-on-the-floor house grooves and keys', color: '#f59e0b', loopIds: ['drums_house_01', 'drums_house_02', 'melodic_keys_01', 'melodic_keys_02'] },
  { id: 'lofi_study', name: 'Lo-fi Study Beats', genre: 'Lo-fi', description: 'Chill lo-fi beats for focused work', color: '#10b981', loopIds: ['drums_lofi_01', 'drums_lofi_02'] },
  { id: 'trap_essentials', name: 'Trap Essentials', genre: 'Trap', description: 'Hard-hitting trap drum patterns', color: '#ef4444', loopIds: ['drums_trap_01', 'drums_trap_02'] },
  { id: 'techno_warehouse', name: 'Techno Warehouse', genre: 'Techno', description: 'Driving techno beats for the club', color: '#8b5cf6', loopIds: ['drums_techno_01', 'drums_techno_02'] },
  { id: 'hiphop_bangers', name: 'Hip Hop Bangers', genre: 'Hip Hop', description: 'Boom-bap and modern hip-hop beats', color: '#f97316', loopIds: ['drums_hiphop_01', 'drums_hiphop_02'] },
  { id: 'funk_grooves', name: 'Funk Grooves', genre: 'Funk', description: 'Funky drum patterns with pocket', color: '#ec4899', loopIds: ['drums_funk_01'] },
  { id: 'rock_anthems', name: 'Rock Anthems', genre: 'Rock', description: 'Powerful rock drum patterns', color: '#6366f1', loopIds: ['drums_rock_01'] },
  { id: 'deep_house_grooves', name: 'Deep House Grooves', genre: 'Deep House', description: 'Smooth deep house bass lines', color: '#06b6d4', loopIds: ['bass_deep_01', 'bass_deep_02'] },
  { id: 'jazz_standards', name: 'Jazz Standards', genre: 'Jazz', description: 'Walking bass and jazz progressions', color: '#a855f7', loopIds: ['bass_walking_01'] },
  { id: 'electronic_bass', name: 'Electronic Bass', genre: 'Electronic', description: 'Sub bass and electro bass lines', color: '#3b82f6', loopIds: ['bass_sub_01', 'bass_electro_01'] },
  { id: 'pop_hits', name: 'Pop Hits', genre: 'Pop', description: 'Catchy pop guitar and melody hooks', color: '#f43f5e', loopIds: ['melodic_guitar_01'] },
  { id: 'cinematic_scores', name: 'Cinematic Scores', genre: 'Cinematic', description: 'Epic strings and orchestral pads', color: '#64748b', loopIds: ['melodic_strings_01'] },
  { id: 'ambient_textures', name: 'Ambient Textures', genre: 'Ambient', description: 'Ethereal pads and atmospheric soundscapes', color: '#14b8a6', loopIds: ['melodic_ambient_01'] },
];

export function getLoopsByCategory(category: LoopAsset['category']): LoopAsset[] {
  return loopLibrary.filter(l => l.category === category);
}

export function getLoopById(id: string): LoopAsset | undefined {
  return loopLibrary.find(l => l.id === id);
}

export function getLoopsByPack(packId: string): LoopAsset[] {
  return loopLibrary.filter(l => l.pack === packId);
}

export function getLoopsByGenre(genre: string): LoopAsset[] {
  return loopLibrary.filter(l => l.genre.toLowerCase() === genre.toLowerCase());
}

