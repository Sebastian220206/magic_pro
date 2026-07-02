/**
 * Sound Library - Instrument Definitions
 * Detailed sound parameters and presets for the DAW library
 */

import type { SynthPreset } from '../instruments/synthEngine';

// Extended synth presets with more detailed configurations
export const extendedSynthPresets: Record<string, SynthPreset> = {
  analog_pad: {
    name: 'Analog Pad',
    oscillators: [
      { type: 'sawtooth', detune: -7, mix: 0.5 },
      { type: 'sawtooth', detune: 7, mix: 0.5 },
    ],
    filter: { type: 'lowpass', frequency: 800, resonance: 2 },
    envelope: { attack: 0.3, decay: 0.5, sustain: 0.7, release: 1.5 },
    polyphony: 8,
  },
  lead_synth: {
    name: 'Lead Synth',
    oscillators: [
      { type: 'sawtooth', detune: 0, mix: 0.7 },
      { type: 'square', detune: 12, mix: 0.3 },
    ],
    filter: { type: 'lowpass', frequency: 2000, resonance: 5 },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.4 },
    polyphony: 6,
    portamento: 0.05,
  },
  warm_strings: {
    name: 'Warm Strings',
    oscillators: [
      { type: 'sawtooth', detune: -10, mix: 0.4 },
      { type: 'sawtooth', detune: 0, mix: 0.3 },
      { type: 'sawtooth', detune: 10, mix: 0.3 },
    ],
    filter: { type: 'lowpass', frequency: 1200, resonance: 1 },
    envelope: { attack: 0.4, decay: 0.6, sustain: 0.8, release: 1.2 },
    polyphony: 10,
  },
  deep_bass: {
    name: 'Deep Bass',
    oscillators: [
      { type: 'sawtooth', detune: 0, mix: 0.5 },
      { type: 'square', detune: -12, mix: 0.5 },
    ],
    filter: { type: 'lowpass', frequency: 400, resonance: 3 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.3 },
    polyphony: 4,
  },
  hammond_organ: {
    name: 'Hammond Organ',
    oscillators: [
      { type: 'square', detune: 0, mix: 0.25 },
      { type: 'sawtooth', detune: 0, mix: 0.25 },
      { type: 'triangle', detune: 0, mix: 0.5 },
    ],
    filter: { type: 'lowpass', frequency: 3000, resonance: 1 },
    envelope: { attack: 0.02, decay: 0.1, sustain: 1, release: 0.1 },
    polyphony: 8,
  },
  clavinet: {
    name: 'Clavinet',
    oscillators: [
      { type: 'sawtooth', detune: -5, mix: 0.4 },
      { type: 'square', detune: 5, mix: 0.6 },
    ],
    filter: { type: 'highpass', frequency: 200, resonance: 0 },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.2 },
    polyphony: 6,
  },
  // Additional presets
  pluck_synth: {
    name: 'Pluck',
    oscillators: [
      { type: 'triangle', detune: 0, mix: 0.8 },
      { type: 'sawtooth', detune: 12, mix: 0.2 },
    ],
    filter: { type: 'lowpass', frequency: 3000, resonance: 4 },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.6 },
    polyphony: 8,
  },
  brass_section: {
    name: 'Brass',
    oscillators: [
      { type: 'sawtooth', detune: -5, mix: 0.5 },
      { type: 'sawtooth', detune: 5, mix: 0.5 },
    ],
    filter: { type: 'lowpass', frequency: 1500, resonance: 3 },
    envelope: { attack: 0.1, decay: 0.4, sustain: 0.7, release: 0.5 },
    polyphony: 6,
  },
  bell_tone: {
    name: 'Bell',
    oscillators: [
      { type: 'sine', detune: 0, mix: 0.6 },
      { type: 'sine', detune: 12, mix: 0.3 },
      { type: 'triangle', detune: 24, mix: 0.1 },
    ],
    filter: { type: 'lowpass', frequency: 6000, resonance: 1 },
    envelope: { attack: 0.005, decay: 1.5, sustain: 0.2, release: 2.0 },
    polyphony: 6,
  },
  // Phase 2 expansions
  ambient_pad: {
    name: 'Ambient Pad',
    oscillators: [
      { type: 'sine', detune: -12, mix: 0.3 },
      { type: 'sine', detune: 0, mix: 0.4 },
      { type: 'sine', detune: 12, mix: 0.3 },
    ],
    filter: { type: 'lowpass', frequency: 600, resonance: 0.5 },
    envelope: { attack: 1.0, decay: 1.0, sustain: 0.9, release: 3.0 },
    polyphony: 12,
  },
  arp_synth: {
    name: 'Arp Synth',
    oscillators: [
      { type: 'square', detune: 0, mix: 0.5 },
      { type: 'triangle', detune: 7, mix: 0.5 },
    ],
    filter: { type: 'bandpass', frequency: 1500, resonance: 6 },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.3 },
    polyphony: 8,
  },
  wobble_bass: {
    name: 'Wobble Bass',
    oscillators: [
      { type: 'sawtooth', detune: -5, mix: 0.6 },
      { type: 'square', detune: 0, mix: 0.4 },
    ],
    filter: { type: 'lowpass', frequency: 300, resonance: 8 },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.2 },
    polyphony: 3,
  },
  fx_noise: {
    name: 'FX Noise',
    oscillators: [
      { type: 'sawtooth', detune: 0, mix: 0.3 },
      { type: 'square', detune: 0, mix: 0.7 },
    ],
    filter: { type: 'highpass', frequency: 4000, resonance: 0 },
    envelope: { attack: 0.1, decay: 0.5, sustain: 0.3, release: 1.5 },
    polyphony: 4,
  },
  sub_drop: {
    name: 'Sub Drop',
    oscillators: [
      { type: 'sine', detune: -24, mix: 0.5 },
      { type: 'sine', detune: 0, mix: 0.5 },
    ],
    filter: { type: 'lowpass', frequency: 150, resonance: 1 },
    envelope: { attack: 0.001, decay: 2.0, sustain: 0.1, release: 0.5 },
    polyphony: 2,
  },
};

// Sampler instrument metadata
export const samplerInstruments = {
  grand_piano: {
    name: 'Grand Piano',
    description: 'Acoustic grand piano with realistic sustain',
    noteRange: { min: 21, max: 108 },
    velocityLayers: 4,
    samplePack: 'grand_piano_pack',
  },
  electric_piano: {
    name: 'Electric Piano',
    description: 'Classic electric piano with bell-like tone',
    noteRange: { min: 28, max: 103 },
    velocityLayers: 3,
    samplePack: 'electric_piano_pack',
  },
  harpsichord: {
    name: 'Harpsichord',
    description: 'Baroque harpsichord with authentic pluck',
    noteRange: { min: 29, max: 89 },
    velocityLayers: 2,
    samplePack: 'harpsichord_pack',
  },
  vibraphone: {
    name: 'Vibraphone',
    description: 'Jazz vibraphone with motor vibrato',
    noteRange: { min: 53, max: 93 },
    velocityLayers: 3,
    samplePack: 'vibraphone_pack',
  },
  // Phase 2 expansions
  string_ensemble: {
    name: 'String Ensemble',
    description: 'Full string ensemble with expressive dynamics',
    noteRange: { min: 28, max: 100 },
    velocityLayers: 3,
    samplePack: 'string_ensemble_pack',
  },
  woodwinds: {
    name: 'Woodwinds',
    description: 'Flute, clarinet, and oboe ensemble',
    noteRange: { min: 36, max: 96 },
    velocityLayers: 2,
    samplePack: 'woodwinds_pack',
  },
  brass_ensemble: {
    name: 'Brass Ensemble',
    description: 'Trumpet, horn, and trombone section',
    noteRange: { min: 28, max: 84 },
    velocityLayers: 3,
    samplePack: 'brass_ensemble_pack',
  },
  choir: {
    name: 'Choir',
    description: 'Vocal ensemble with oohs and aahs',
    noteRange: { min: 36, max: 84 },
    velocityLayers: 2,
    samplePack: 'choir_pack',
  },
};

// Drum kit metadata
export const drumKitInstruments = {
  trap: {
    name: 'Trap Drum Kit',
    description: 'Modern trap drum sounds with 808 bass',
    pads: [
      { note: 36, name: 'Kick', color: '#ff6b6b' },
      { note: 38, name: 'Snare', color: '#4ecdc4' },
      { note: 40, name: 'Snare Rim', color: '#45b7d1' },
      { note: 42, name: 'Closed Hat', color: '#96ceb4' },
      { note: 46, name: 'Open Hat', color: '#88d8b0' },
      { note: 39, name: 'Clap', color: '#ffeaa7' },
      { note: 75, name: 'Claves', color: '#dfe6e9' },
      { note: 41, name: '808', color: '#fd79a8' },
      { note: 49, name: 'Crash', color: '#a29bfe' },
      { note: 35, name: 'Sub Kick', color: '#e17055' },
    ],
  },
  acoustic: {
    name: 'Acoustic Kit',
    description: 'Real acoustic drum kit with natural room sound',
    pads: [
      { note: 36, name: 'Kick', color: '#ff6b6b' },
      { note: 38, name: 'Snare', color: '#4ecdc4' },
      { note: 40, name: 'Snare Rim', color: '#45b7d1' },
      { note: 42, name: 'Closed Hat', color: '#96ceb4' },
      { note: 46, name: 'Open Hat', color: '#88d8b0' },
      { note: 43, name: 'Tom Low', color: '#dfe6e9' },
      { note: 47, name: 'Tom Hi', color: '#b2bec3' },
      { note: 41, name: 'Tom Floor', color: '#636e72' },
      { note: 49, name: 'Crash', color: '#a29bfe' },
      { note: 51, name: 'Ride', color: '#74b9ff' },
      { note: 52, name: 'China', color: '#6c5ce7' },
    ],
  },
  '808': {
    name: '808 Classic',
    description: 'Classic Roland TR-808 sounds',
    pads: [
      { note: 35, name: 'Sub Kick', color: '#e17055' },
      { note: 36, name: 'Kick', color: '#ff6b6b' },
      { note: 38, name: 'Snare', color: '#4ecdc4' },
      { note: 40, name: 'Snare Rim', color: '#45b7d1' },
      { note: 42, name: 'Closed Hat', color: '#96ceb4' },
      { note: 46, name: 'Open Hat', color: '#88d8b0' },
      { note: 39, name: 'Clap', color: '#ffeaa7' },
      { note: 56, name: 'Cowbell', color: '#fab1a0' },
      { note: 62, name: 'Conga Hi', color: '#dfe6e9' },
      { note: 63, name: 'Conga Low', color: '#b2bec3' },
      { note: 75, name: 'Claves', color: '#636e72' },
      { note: 70, name: 'Maraca', color: '#a29bfe' },
    ],
  },
};

// Full library categories
export const soundLibraryCategories = [
  {
    id: 'software_instruments',
    name: 'Software Instruments',
    instruments: ['Grand Piano', 'Electric Piano', 'Harpsichord', 'Vibraphone', 'String Ensemble', 'Woodwinds', 'Brass Ensemble', 'Choir'],
  },
  {
    id: 'synthesizers',
    name: 'Synthesizers',
    instruments: ['Analog Pad', 'Lead Synth', 'Warm Strings', 'Deep Bass', 'Brass', 'Bell', 'Pluck', 'Ambient Pad', 'Arp Synth', 'Wobble Bass', 'FX Noise', 'Sub Drop'],
  },
  {
    id: 'keyboards',
    name: 'Keyboards',
    instruments: ['Hammond Organ', 'Clavinet'],
  },
  {
    id: 'drum_kits',
    name: 'Drum Kits',
    instruments: ['Trap Drum Kit', 'Acoustic Kit', '808 Classic', 'Electronic Kit', 'Jazz Kit', 'World Percussion'],
  },
  {
    id: 'soundfonts',
    name: 'SoundFont Instruments',
    instruments: ['SoundFont Instrument'],
  },
];

// Sound info for display
export interface SoundInfo {
  name: string;
  category: string;
  engine: 'synth' | 'sampler' | 'drumkit' | 'soundfont';
  description: string;
  icon?: string;
  color?: string;
}

// Get info for a sound
export function getSoundInfo(name: string): SoundInfo | null {
  const infoMap: Record<string, SoundInfo> = {
    'Grand Piano': {
      name: 'Grand Piano',
      category: 'Software Instruments',
      engine: 'sampler',
      description: 'Acoustic grand piano with realistic sustain',
      icon: 'piano',
      color: '#e74c3c',
    },
    'Electric Piano': {
      name: 'Electric Piano',
      category: 'Software Instruments',
      engine: 'sampler',
      description: 'Classic electric piano with bell-like tone',
      icon: 'keyboard',
      color: '#3498db',
    },
    'Harpsichord': {
      name: 'Harpsichord',
      category: 'Software Instruments',
      engine: 'sampler',
      description: 'Baroque harpsichord with authentic pluck',
      icon: 'keyboard',
      color: '#8e44ad',
    },
    'Vibraphone': {
      name: 'Vibraphone',
      category: 'Software Instruments',
      engine: 'sampler',
      description: 'Jazz vibraphone with motor vibrato',
      icon: 'keyboard',
      color: '#1abc9c',
    },
    'String Ensemble': {
      name: 'String Ensemble',
      category: 'Software Instruments',
      engine: 'sampler',
      description: 'Full string ensemble with expressive dynamics',
      icon: 'music',
      color: '#e67e22',
    },
    'Woodwinds': {
      name: 'Woodwinds',
      category: 'Software Instruments',
      engine: 'sampler',
      description: 'Flute, clarinet, and oboe ensemble',
      icon: 'music',
      color: '#d35400',
    },
    'Brass Ensemble': {
      name: 'Brass Ensemble',
      category: 'Software Instruments',
      engine: 'sampler',
      description: 'Trumpet, horn, and trombone section',
      icon: 'music',
      color: '#f39c12',
    },
    'Choir': {
      name: 'Choir',
      category: 'Software Instruments',
      engine: 'sampler',
      description: 'Vocal ensemble with oohs and aahs',
      icon: 'mic',
      color: '#c0392b',
    },
    'Analog Pad': {
      name: 'Analog Pad',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Warm analog-style pad with slow attack',
      icon: 'wave-sine',
      color: '#9b59b6',
    },
    'Lead Synth': {
      name: 'Lead Synth',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Bright lead sound for melodies',
      icon: 'zap',
      color: '#f1c40f',
    },
    'Warm Strings': {
      name: 'Warm Strings',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'String ensemble emulation',
      icon: 'music',
      color: '#1abc9c',
    },
    'Deep Bass': {
      name: 'Deep Bass',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Sub-bass for low frequencies',
      icon: 'volume-2',
      color: '#e67e22',
    },
    'Hammond Organ': {
      name: 'Hammond Organ',
      category: 'Keyboards',
      engine: 'synth',
      description: 'Classic organ with drawbar emulation',
      icon: 'layout',
      color: '#2ecc71',
    },
    'Clavinet': {
      name: 'Clavinet',
      category: 'Keyboards',
      engine: 'synth',
      description: 'Funky clavinet sound',
      icon: 'music-2',
      color: '#34495e',
    },
    'Trap Drum Kit': {
      name: 'Trap Drum Kit',
      category: 'Drum Kits',
      engine: 'drumkit',
      description: 'Modern trap drum sounds with 808 bass',
      icon: 'drum',
      color: '#e91e63',
    },
    'Acoustic Kit': {
      name: 'Acoustic Kit',
      category: 'Drum Kits',
      engine: 'drumkit',
      description: 'Real acoustic drum kit',
      icon: 'drum',
      color: '#795548',
    },
    '808 Classic': {
      name: '808 Classic',
      category: 'Drum Kits',
      engine: 'drumkit',
      description: 'Classic Roland TR-808 sounds',
      icon: 'drum',
      color: '#607d8b',
    },
    'Electronic Kit': {
      name: 'Electronic Kit',
      category: 'Drum Kits',
      engine: 'drumkit',
      description: 'Modern electronic drum sounds',
      icon: 'drum',
      color: '#00bcd4',
    },
    'Jazz Kit': {
      name: 'Jazz Kit',
      category: 'Drum Kits',
      engine: 'drumkit',
      description: 'Jazz-style brush and ride-focused kit',
      icon: 'drum',
      color: '#4caf50',
    },
    'World Percussion': {
      name: 'World Percussion',
      category: 'Drum Kits',
      engine: 'drumkit',
      description: 'Congas, bongos, djembe, and hand percussion',
      icon: 'drum',
      color: '#ff9800',
    },
    // Phase 2 expansions
    'Ambient Pad': {
      name: 'Ambient Pad',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Ethereal ambient pad with slow evolution',
      icon: 'wave-sine',
      color: '#8e44ad',
    },
    'Arp Synth': {
      name: 'Arp Synth',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Bright arpeggiated synth texture',
      icon: 'zap',
      color: '#00bcd4',
    },
    'Wobble Bass': {
      name: 'Wobble Bass',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Aggressive wobble bass for electronic music',
      icon: 'volume-2',
      color: '#ff5722',
    },
    'FX Noise': {
      name: 'FX Noise',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Atmospheric noise textures and sweeps',
      icon: 'headphones',
      color: '#9c27b0',
    },
    'Sub Drop': {
      name: 'Sub Drop',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Deep sub-bass drop for dramatic entrances',
      icon: 'volume-2',
      color: '#3f51b5',
    },
    'Brass': {
      name: 'Brass',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Synthesized brass section',
      icon: 'music',
      color: '#f39c12',
    },
    'Bell': {
      name: 'Bell',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Bright bell-like tones',
      icon: 'music-2',
      color: '#00bcd4',
    },
    'Pluck': {
      name: 'Pluck',
      category: 'Synthesizers',
      engine: 'synth',
      description: 'Fast plucked synth sound',
      icon: 'music-2',
      color: '#4caf50',
    },
    'SoundFont Instrument': {
      name: 'SoundFont Instrument',
      category: 'SoundFont Instruments',
      engine: 'soundfont',
      description: 'General MIDI SoundFont (.sf2)',
      icon: 'music',
      color: '#ff6b35',
    },
  };

  return infoMap[name] ?? null;
}

// Get all sounds in a category
export function getSoundsByCategory(category: string): string[] {
  const cat = soundLibraryCategories.find((c) => c.name === category);
  return cat?.instruments ?? [];
}

// Get all available sounds
export function getAllSounds(): string[] {
  return soundLibraryCategories.flatMap((cat) => cat.instruments);
}
