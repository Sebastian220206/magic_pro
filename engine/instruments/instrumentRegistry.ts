/**
 * Instrument Registry
 * Maps sound names to their respective engines and presets
 */

export type InstrumentEngine = 'synth' | 'sampler' | 'drumkit' | 'soundfont';

export interface InstrumentDefinition {
  engine: InstrumentEngine;
  preset: string;
  displayName: string;
  category: string;
  description?: string;
}

/**
 * Registry mapping instrument names to their engine configurations
 */
export const instrumentRegistry: Record<string, InstrumentDefinition> = {
  // Software Instruments - Sampler based
  'Grand Piano': {
    engine: 'sampler',
    preset: 'grand_piano',
    displayName: 'Grand Piano',
    category: 'Software Instruments',
    description: 'Acoustic grand piano with realistic sustain',
  },
  'Electric Piano': {
    engine: 'sampler',
    preset: 'electric_piano',
    displayName: 'Electric Piano',
    category: 'Software Instruments',
    description: 'Classic electric piano with bell-like tone',
  },
  'Harpsichord': {
    engine: 'sampler',
    preset: 'harpsichord',
    displayName: 'Harpsichord',
    category: 'Software Instruments',
    description: 'Baroque harpsichord with authentic pluck',
  },
  'Vibraphone': {
    engine: 'sampler',
    preset: 'vibraphone',
    displayName: 'Vibraphone',
    category: 'Software Instruments',
    description: 'Jazz vibraphone with motor vibrato',
  },
  'String Ensemble': {
    engine: 'sampler',
    preset: 'string_ensemble',
    displayName: 'String Ensemble',
    category: 'Software Instruments',
    description: 'Full string ensemble with expressive dynamics',
  },
  'Woodwinds': {
    engine: 'sampler',
    preset: 'woodwinds',
    displayName: 'Woodwinds',
    category: 'Software Instruments',
    description: 'Flute, clarinet, and oboe ensemble',
  },
  'Brass Ensemble': {
    engine: 'sampler',
    preset: 'brass_ensemble',
    displayName: 'Brass Ensemble',
    category: 'Software Instruments',
    description: 'Trumpet, horn, and trombone section',
  },
  'Choir': {
    engine: 'sampler',
    preset: 'choir',
    displayName: 'Choir',
    category: 'Software Instruments',
    description: 'Vocal ensemble with oohs and aahs',
  },

  // Synthesizers
  'Analog Pad': {
    engine: 'synth',
    preset: 'analog_pad',
    displayName: 'Analog Pad',
    category: 'Synthesizers',
    description: 'Warm analog-style pad with slow attack',
  },
  'Lead Synth': {
    engine: 'synth',
    preset: 'lead_synth',
    displayName: 'Lead Synth',
    category: 'Synthesizers',
    description: 'Bright lead sound for melodies',
  },
  'Warm Strings': {
    engine: 'synth',
    preset: 'warm_strings',
    displayName: 'Warm Strings',
    category: 'Synthesizers',
    description: 'String ensemble emulation',
  },
  'Deep Bass': {
    engine: 'synth',
    preset: 'deep_bass',
    displayName: 'Deep Bass',
    category: 'Synthesizers',
    description: 'Sub-bass for low frequencies',
  },
  'Hammond Organ': {
    engine: 'synth',
    preset: 'hammond_organ',
    displayName: 'Hammond Organ',
    category: 'Keyboards',
    description: 'Classic organ with drawbar emulation',
  },
  'Clavinet': {
    engine: 'synth',
    preset: 'clavinet',
    displayName: 'Clavinet',
    category: 'Keyboards',
    description: 'Funky clavinet sound',
  },
  'Brass': {
    engine: 'synth',
    preset: 'brass_section',
    displayName: 'Brass',
    category: 'Synthesizers',
    description: 'Synthesized brass section',
  },
  'Bell': {
    engine: 'synth',
    preset: 'bell_tone',
    displayName: 'Bell',
    category: 'Synthesizers',
    description: 'Bright bell-like tones',
  },
  'Pluck': {
    engine: 'synth',
    preset: 'pluck_synth',
    displayName: 'Pluck',
    category: 'Synthesizers',
    description: 'Fast plucked synth sound',
  },
  'Ambient Pad': {
    engine: 'synth',
    preset: 'ambient_pad',
    displayName: 'Ambient Pad',
    category: 'Synthesizers',
    description: 'Ethereal ambient pad with slow evolution',
  },
  'Arp Synth': {
    engine: 'synth',
    preset: 'arp_synth',
    displayName: 'Arp Synth',
    category: 'Synthesizers',
    description: 'Bright arpeggiated synth texture',
  },
  'Wobble Bass': {
    engine: 'synth',
    preset: 'wobble_bass',
    displayName: 'Wobble Bass',
    category: 'Synthesizers',
    description: 'Aggressive wobble bass for electronic music',
  },
  'FX Noise': {
    engine: 'synth',
    preset: 'fx_noise',
    displayName: 'FX Noise',
    category: 'Synthesizers',
    description: 'Atmospheric noise textures and sweeps',
  },
  'Sub Drop': {
    engine: 'synth',
    preset: 'sub_drop',
    displayName: 'Sub Drop',
    category: 'Synthesizers',
    description: 'Deep sub-bass drop for dramatic entrances',
  },

  // SoundFont Instruments
  'SoundFont Instrument': {
    engine: 'soundfont',
    preset: 'soundfont_gm',
    displayName: 'SoundFont Instrument',
    category: 'SoundFont Instruments',
    description: 'General MIDI SoundFont instrument (load .sf2 file)',
  },

  // Drum Kits
  'Trap Drum Kit': {
    engine: 'drumkit',
    preset: 'trap',
    displayName: 'Trap Drum Kit',
    category: 'Drum Kits',
    description: 'Modern trap drum sounds',
  },
  'Acoustic Kit': {
    engine: 'drumkit',
    preset: 'acoustic',
    displayName: 'Acoustic Kit',
    category: 'Drum Kits',
    description: 'Real acoustic drum kit',
  },
  '808 Classic': {
    engine: 'drumkit',
    preset: '808',
    displayName: '808 Classic',
    category: 'Drum Kits',
    description: 'Classic Roland TR-808 sounds',
  },
  'Electronic Kit': {
    engine: 'drumkit',
    preset: 'electronic',
    displayName: 'Electronic Kit',
    category: 'Drum Kits',
    description: 'Modern electronic drum sounds',
  },
  'Jazz Kit': {
    engine: 'drumkit',
    preset: 'jazz',
    displayName: 'Jazz Kit',
    category: 'Drum Kits',
    description: 'Jazz-style brush and ride-focused kit',
  },
  'World Percussion': {
    engine: 'drumkit',
    preset: 'percussion',
    displayName: 'World Percussion',
    category: 'Drum Kits',
    description: 'Congas, bongos, djembe, and hand percussion',
  },
};

/**
 * Get instrument definition by name
 */
export function getInstrument(name: string): InstrumentDefinition | undefined {
  return instrumentRegistry[name];
}

/**
 * Get all instruments by category
 */
export function getInstrumentsByCategory(category: string): InstrumentDefinition[] {
  return Object.values(instrumentRegistry).filter(
    (inst) => inst.category === category
  );
}

/**
 * Get all available instrument names
 */
export function getAllInstrumentNames(): string[] {
  return Object.keys(instrumentRegistry);
}

/**
 * Get all categories
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  Object.values(instrumentRegistry).forEach((inst) => {
    categories.add(inst.category);
  });
  return Array.from(categories);
}

/**
 * Check if instrument exists
 */
export function hasInstrument(name: string): boolean {
  return name in instrumentRegistry;
}
