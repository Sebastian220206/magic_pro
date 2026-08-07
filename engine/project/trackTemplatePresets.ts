/**
 * Track Template Presets - Built-in Templates for Common Track Types
 *
 * Includes:
 * - Vocal chain templates
 * - Drum templates
 * - Bass templates
 * - Guitar templates
 * - Keys/Synth templates
 * - Bus/Mastering templates
 */

import { TrackTemplate } from './trackTemplateTypes';

// =============================================================================
// Helper to create template IDs
// =============================================================================

function builtinId(name: string): string {
  return `builtin-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

// =============================================================================
// Vocal Templates
// =============================================================================

export const VOCAL_COMPRESS_EQ: TrackTemplate = {
  id: builtinId('Vocal Comp + EQ'),
  name: 'Vocal Comp + EQ',
  description: 'Basic vocal chain with compression and EQ',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'vocals',
  tags: ['vocal', 'compression', 'eq', 'basic'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Vox',
  color: '#EC4899',
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'mono' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 80, lowPass: 18000, midBoost: 2, midFreq: 3000 },
        wetDry: 1,
        presetName: 'Vocal Presence',
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -18, ratio: 4, attack: 10, release: 100 },
        wetDry: 1,
        presetName: 'Vocal Compression',
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [
    {
      id: 'send-reverb',
      destinationType: 'reverb',
      level: -12,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

export const VOCAL_DEESSER: TrackTemplate = {
  id: builtinId('Vocal De-Esser'),
  name: 'Vocal De-Esser',
  description: 'Vocal chain with de-essing before compression',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'vocals',
  tags: ['vocal', 'de-esser', 'sibilance'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Vox DE',
  color: '#EC4899',
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'mono' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'deesser-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 200, lowPass: 18000, midCut: -6, midFreq: 6000 },
        wetDry: 1,
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -16, ratio: 3, attack: 15, release: 80 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [],
  automationLanes: [],
};

export const VOCAL_DOUBLE: TrackTemplate = {
  id: builtinId('Vocal Double'),
  name: 'Vocal Double',
  description: 'Wide vocal double with chorus effect',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'vocals',
  tags: ['vocal', 'double', 'wide', 'chorus'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Vox DBL',
  color: '#F472B6',
  volume: 0.7,
  pan: 0.3,
  muted: false,
  solo: false,
  gain: -3,
  input: { type: 'mono' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -20, ratio: 3, attack: 10, release: 100 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: -3,
  },
  sends: [
    {
      id: 'send-delay',
      destinationType: 'delay',
      level: -15,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

// =============================================================================
// Drum Templates
// =============================================================================

export const DRUM_OVERHEAD: TrackTemplate = {
  id: builtinId('Drum Overhead'),
  name: 'Drum Overhead',
  description: 'Drum overhead mics with gentle compression',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'drums',
  tags: ['drums', 'overhead', 'stereo'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'OH',
  color: '#EF4444',
  volume: 0.75,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'stereo' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -12, ratio: 2, attack: 5, release: 50 },
        wetDry: 1,
        presetName: 'Drum Overheads',
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [],
  automationLanes: [],
};

export const DRUM_ROOM: TrackTemplate = {
  id: builtinId('Drum Room'),
  name: 'Drum Room',
  description: 'Drum room mics with heavy compression for ambience',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'drums',
  tags: ['drums', 'room', 'ambience', 'parallel'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Room',
  color: '#F87171',
  volume: 0.6,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'stereo' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -24, ratio: 8, attack: 1, release: 100 },
        wetDry: 1,
        presetName: 'Room Crush',
      },
    ],
    preGain: 0,
    postGain: -6,
  },
  sends: [],
  automationLanes: [],
};

export const DRUM_KICK: TrackTemplate = {
  id: builtinId('Drum Kick'),
  name: 'Drum Kick',
  description: 'Kick drum with punch compression',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'drums',
  tags: ['drums', 'kick', 'punch'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Kick',
  color: '#DC2626',
  volume: 0.85,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'mono' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 40, lowPass: 5000, lowBoost: 3, lowFreq: 60 },
        wetDry: 1,
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -15, ratio: 4, attack: 3, release: 80 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [],
  automationLanes: [],
};

export const DRUM_SNARE: TrackTemplate = {
  id: builtinId('Drum Snare'),
  name: 'Drum Snare',
  description: 'Snare drum with snap and body',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'drums',
  tags: ['drums', 'snare', 'snap'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Snare',
  color: '#EF4444',
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'mono' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 100, lowPass: 12000, midBoost: 2, midFreq: 4000 },
        wetDry: 1,
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -12, ratio: 3, attack: 5, release: 60 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [
    {
      id: 'send-reverb',
      destinationType: 'reverb',
      level: -15,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

// =============================================================================
// Bass Templates
// =============================================================================

export const BASS_DI: TrackTemplate = {
  id: builtinId('Bass DI'),
  name: 'Bass DI',
  description: 'Direct input bass with compression and EQ',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'bass',
  tags: ['bass', 'di', 'direct'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Bass',
  color: '#F59E0B',
  volume: 0.85,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'mono' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 30, lowPass: 8000, lowBoost: 2, lowFreq: 80 },
        wetDry: 1,
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -14, ratio: 4, attack: 20, release: 150 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [],
  automationLanes: [],
};

export const BASS_AMPEG: TrackTemplate = {
  id: builtinId('Bass Ampeg'),
  name: 'Bass Ampeg',
  description: 'Bass with Ampeg-style amp simulation',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'bass',
  tags: ['bass', 'amp', 'ampeg', 'vintage'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Bass Amp',
  color: '#D97706',
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'mono' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 50, lowPass: 6000, midBoost: 3, midFreq: 800 },
        wetDry: 1,
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -16, ratio: 5, attack: 15, release: 120 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [],
  automationLanes: [],
};

// =============================================================================
// Guitar Templates
// =============================================================================

export const GUITAR_CLEAN: TrackTemplate = {
  id: builtinId('Guitar Clean'),
  name: 'Guitar Clean',
  description: 'Clean guitar with compression and reverb',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'guitar',
  tags: ['guitar', 'clean', 'acoustic'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Gtr Clean',
  color: '#10B981',
  volume: 0.75,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'mono' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -18, ratio: 2, attack: 10, release: 100 },
        wetDry: 1,
      },
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 80, lowPass: 12000 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [
    {
      id: 'send-reverb',
      destinationType: 'reverb',
      level: -10,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

export const GUITAR_DISTORTION: TrackTemplate = {
  id: builtinId('Guitar Distortion'),
  name: 'Guitar Distortion',
  description: 'High-gain guitar with tight compression',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'guitar',
  tags: ['guitar', 'distortion', 'high-gain', 'metal'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Gtr Dist',
  color: '#059669',
  volume: 0.7,
  pan: 0,
  muted: false,
  solo: false,
  gain: 6,
  input: { type: 'mono' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 80, lowPass: 8000, midBoost: 2, midFreq: 2500 },
        wetDry: 1,
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -20, ratio: 6, attack: 5, release: 80 },
        wetDry: 1,
      },
    ],
    preGain: 6,
    postGain: -3,
  },
  sends: [
    {
      id: 'send-delay',
      destinationType: 'delay',
      level: -18,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

export const GUITAR_ACOUSTIC: TrackTemplate = {
  id: builtinId('Guitar Acoustic'),
  name: 'Guitar Acoustic',
  description: 'Acoustic guitar with natural compression',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'guitar',
  tags: ['guitar', 'acoustic', 'natural'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'audio',
  namePrefix: 'Ac Gtr',
  color: '#34D399',
  volume: 0.75,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'stereo' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 60, lowPass: 14000, midBoost: 1, midFreq: 2500 },
        wetDry: 1,
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -16, ratio: 2, attack: 15, release: 120 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [
    {
      id: 'send-reverb',
      destinationType: 'reverb',
      level: -14,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

// =============================================================================
// Keys/Synth Templates
// =============================================================================

export const KEYS_PIANO: TrackTemplate = {
  id: builtinId('Keys Piano'),
  name: 'Keys Piano',
  description: 'Acoustic piano with gentle compression',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'keys',
  tags: ['keys', 'piano', 'acoustic'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'instrument',
  namePrefix: 'Piano',
  color: '#3B82F6',
  volume: 0.75,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'midi' },
  output: { type: 'master' },
  instrument: {
    pluginId: 'sampler',
    parameters: {},
    presetName: 'Grand Piano',
  },
  effects: {
    slots: [
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -18, ratio: 2, attack: 20, release: 200 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [
    {
      id: 'send-reverb',
      destinationType: 'reverb',
      level: -12,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

export const SYNTH_PAD: TrackTemplate = {
  id: builtinId('Synth Pad'),
  name: 'Synth Pad',
  description: 'Lush synth pad with chorus and reverb',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'synths',
  tags: ['synth', 'pad', 'atmospheric', 'chorus'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'instrument',
  namePrefix: 'Pad',
  color: '#8B5CF6',
  volume: 0.65,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'midi' },
  output: { type: 'master' },
  instrument: {
    pluginId: 'synth',
    parameters: { waveform: 'saw', voices: 4, detune: 10 },
    presetName: 'Lush Pad',
  },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 100, lowPass: 10000 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [
    {
      id: 'send-reverb',
      destinationType: 'reverb',
      level: -8,
      preFader: false,
      enabled: true,
      pan: 0,
    },
    {
      id: 'send-delay',
      destinationType: 'delay',
      level: -14,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

export const SYNTH_LEAD: TrackTemplate = {
  id: builtinId('Synth Lead'),
  name: 'Synth Lead',
  description: 'Bright synth lead with delay',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'synths',
  tags: ['synth', 'lead', 'bright'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'instrument',
  namePrefix: 'Lead',
  color: '#A78BFA',
  volume: 0.75,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'midi' },
  output: { type: 'master' },
  instrument: {
    pluginId: 'synth',
    parameters: { waveform: 'saw', voices: 1, detune: 0 },
    presetName: 'Bright Lead',
  },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 200, lowPass: 12000, midBoost: 2, midFreq: 3000 },
        wetDry: 1,
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -16, ratio: 3, attack: 5, release: 80 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [
    {
      id: 'send-delay',
      destinationType: 'delay',
      level: -12,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

// =============================================================================
// Bus/Mastering Templates
// =============================================================================

export const BUS_DRUM: TrackTemplate = {
  id: builtinId('Bus Drum'),
  name: 'Bus Drum',
  description: 'Drum bus with glue compression',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'bus',
  tags: ['bus', 'drum', 'glue', 'parallel'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'bus',
  namePrefix: 'Drum Bus',
  color: '#6366F1',
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'stereo' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -12, ratio: 2, attack: 30, release: 150 },
        wetDry: 1,
        presetName: 'Drum Bus Glue',
      },
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 30, lowPass: 18000, lowBoost: 1, lowFreq: 60 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [],
  automationLanes: [],
};

export const BUS_VOCAL: TrackTemplate = {
  id: builtinId('Bus Vocal'),
  name: 'Bus Vocal',
  description: 'Vocal bus with gentle compression and EQ',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'bus',
  tags: ['bus', 'vocal', 'glue'],
  isBuiltIn: true,
  isFavorite: false,
  trackType: 'bus',
  namePrefix: 'Vox Bus',
  color: '#EC4899',
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'stereo' },
  output: { type: 'master' },
  effects: {
    slots: [
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -14, ratio: 2, attack: 20, release: 120 },
        wetDry: 1,
        presetName: 'Vocal Bus',
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [
    {
      id: 'send-reverb',
      destinationType: 'reverb',
      level: -10,
      preFader: false,
      enabled: true,
      pan: 0,
    },
  ],
  automationLanes: [],
};

export const MASTERING: TrackTemplate = {
  id: builtinId('Mastering'),
  name: 'Mastering',
  description: 'Master bus with limiter and final polish',
  version: 1,
  createdAt: 0,
  updatedAt: 0,
  author: 'DAW',
  category: 'mastering',
  tags: ['master', 'mastering', 'limiter', 'final'],
  isBuiltIn: true,
  isFavorite: true,
  trackType: 'bus',
  namePrefix: 'Master',
  color: '#14B8A6',
  volume: 1,
  pan: 0,
  muted: false,
  solo: false,
  gain: 0,
  input: { type: 'stereo' },
  output: { type: 'audio-output' },
  effects: {
    slots: [
      {
        id: 'eq-1',
        pluginId: 'eq',
        enabled: true,
        bypassed: false,
        parameters: { highPass: 20, lowPass: 20000 },
        wetDry: 1,
      },
      {
        id: 'comp-1',
        pluginId: 'compressor',
        enabled: true,
        bypassed: false,
        parameters: { threshold: -6, ratio: 2, attack: 30, release: 200 },
        wetDry: 1,
      },
      {
        id: 'limiter-1',
        pluginId: 'limiter',
        enabled: true,
        bypassed: false,
        parameters: { ceiling: -0.3, release: 100 },
        wetDry: 1,
      },
    ],
    preGain: 0,
    postGain: 0,
  },
  sends: [],
  automationLanes: [],
};

// =============================================================================
// All Built-in Templates
// =============================================================================

export const BUILTIN_TRACK_TEMPLATES: TrackTemplate[] = [
  // Vocals
  VOCAL_COMPRESS_EQ,
  VOCAL_DEESSER,
  VOCAL_DOUBLE,
  // Drums
  DRUM_OVERHEAD,
  DRUM_ROOM,
  DRUM_KICK,
  DRUM_SNARE,
  // Bass
  BASS_DI,
  BASS_AMPEG,
  // Guitar
  GUITAR_CLEAN,
  GUITAR_DISTORTION,
  GUITAR_ACOUSTIC,
  // Keys/Synth
  KEYS_PIANO,
  SYNTH_PAD,
  SYNTH_LEAD,
  // Bus/Mastering
  BUS_DRUM,
  BUS_VOCAL,
  MASTERING,
];

export default BUILTIN_TRACK_TEMPLATES;
