/**
 * Instrument Registry
 * Maps sound names to their respective engines and presets
 */

export type InstrumentEngine = 'synth' | 'sampler' | 'drumkit';

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
