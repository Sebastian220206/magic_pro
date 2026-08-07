/**
 * Sidechain Presets - Common Sidechain Configurations
 *
 * Presets for various mixing scenarios:
 * - Ducking (kick → bass)
 * - Pumping (kick → pads)
 * - Vocal presence (vocal → music)
 * - Ghost trigger
 * - Frequency-selective
 */

import { SidechainProcessorConfig } from '../audioEngine/sidechainProcessor';
import { DetectorConfig } from '../audioEngine/sidechainDetector';
import { SidechainFilter, SidechainDetectionMode, SidechainRoutingMode } from '../audioEngine/sidechainRouter';

export interface SidechainPreset {
  id: string;
  name: string;
  description: string;
  category: 'ducking' | 'pumping' | 'presence' | 'creative' | 'frequency';
  processor: Partial<SidechainProcessorConfig>;
  detector: Partial<DetectorConfig>;
  filter: Partial<SidechainFilter>;
  routingMode: SidechainRoutingMode;
  detectionMode: SidechainDetectionMode;
}

export const SIDECHAIN_PRESETS: Record<string, SidechainPreset> = {
  // =============================================================================
  // Ducking Presets
  // =============================================================================

  'kick-bass': {
    id: 'kick-bass',
    name: 'Kick → Bass Ducking',
    description: 'Classic sidechain ducking from kick to bass',
    category: 'ducking',
    processor: {
      attack: 0.5,
      release: 150,
      threshold: -25,
      ratio: 6,
      knee: 6,
      mix: 1,
    },
    detector: {
      mode: 'peak',
      attack: 0.5,
      release: 100,
      hold: 10,
    },
    filter: {
      type: 'lowpass',
      frequency: 150,
      Q: 1,
      enabled: true,
    },
    routingMode: 'post-fader',
    detectionMode: 'peak',
  },

  'kick-bass-subtle': {
    id: 'kick-bass-subtle',
    name: 'Kick → Bass Subtle',
    description: 'Subtle ducking for transparent mix',
    category: 'ducking',
    processor: {
      attack: 2,
      release: 200,
      threshold: -30,
      ratio: 3,
      knee: 10,
      mix: 0.8,
    },
    detector: {
      mode: 'rms',
      attack: 5,
      release: 150,
      hold: 20,
    },
    filter: {
      type: 'lowpass',
      frequency: 200,
      Q: 0.7,
      enabled: true,
    },
    routingMode: 'post-fader',
    detectionMode: 'rms',
  },

  'snare-bass': {
    id: 'snare-bass',
    name: 'Snare → Bass Ducking',
    description: 'Duck bass when snare hits',
    category: 'ducking',
    processor: {
      attack: 0.5,
      release: 100,
      threshold: -20,
      ratio: 4,
      knee: 6,
      mix: 1,
    },
    detector: {
      mode: 'peak',
      attack: 0.5,
      release: 80,
      hold: 5,
    },
    filter: {
      type: 'highpass',
      frequency: 200,
      Q: 1,
      enabled: true,
    },
    routingMode: 'post-fader',
    detectionMode: 'peak',
  },

  // =============================================================================
  // Pumping Presets
  // =============================================================================

  'kick-pads-hard': {
    id: 'kick-pads-hard',
    name: 'Kick → Pads Hard Pump',
    description: 'Heavy pumping effect for electronic music',
    category: 'pumping',
    processor: {
      attack: 0.1,
      release: 250,
      threshold: -20,
      ratio: 10,
      knee: 3,
      makeupGain: 3,
      mix: 1,
    },
    detector: {
      mode: 'peak',
      attack: 0.1,
      release: 200,
      hold: 0,
    },
    filter: {
      type: 'none',
      frequency: 1000,
      Q: 1,
      enabled: false,
    },
    routingMode: 'post-fader',
    detectionMode: 'peak',
  },

  'kick-pads-soft': {
    id: 'kick-pads-soft',
    name: 'Kick → Pads Soft Pump',
    description: 'Gentle pumping for ambient/electronic',
    category: 'pumping',
    processor: {
      attack: 5,
      release: 300,
      threshold: -30,
      ratio: 4,
      knee: 10,
      mix: 0.9,
    },
    detector: {
      mode: 'envelope',
      attack: 10,
      release: 250,
      hold: 20,
    },
    filter: {
      type: 'none',
      frequency: 1000,
      Q: 1,
      enabled: false,
    },
    routingMode: 'post-fader',
    detectionMode: 'envelope',
  },

  'kick-pads-vintage': {
    id: 'kick-pads-vicks',
    name: 'Kick → Pads Vintage Pump',
    description: 'Vintage-style pumping with slower release',
    category: 'pumping',
    processor: {
      attack: 2,
      release: 400,
      threshold: -25,
      ratio: 6,
      knee: 6,
      mix: 1,
    },
    detector: {
      mode: 'rms',
      attack: 5,
      release: 350,
      hold: 30,
    },
    filter: {
      type: 'lowpass',
      frequency: 5000,
      Q: 0.5,
      enabled: true,
    },
    routingMode: 'post-fader',
    detectionMode: 'rms',
  },

  // =============================================================================
  // Presence Presets
  // =============================================================================

  'vocal-music': {
    id: 'vocal-music',
    name: 'Vocal → Music Presence',
    description: 'Make room for vocals in the mix',
    category: 'presence',
    processor: {
      attack: 10,
      release: 200,
      threshold: -25,
      ratio: 2.5,
      knee: 10,
      mix: 0.7,
    },
    detector: {
      mode: 'rms',
      attack: 15,
      release: 180,
      hold: 50,
    },
    filter: {
      type: 'bandpass',
      frequency: 3000,
      Q: 0.8,
      enabled: true,
    },
    routingMode: 'post-fader',
    detectionMode: 'rms',
  },

  'lead-music': {
    id: 'lead-music',
    name: 'Lead → Music Presence',
    description: 'Make room for lead instruments',
    category: 'presence',
    processor: {
      attack: 15,
      release: 250,
      threshold: -28,
      ratio: 2,
      knee: 12,
      mix: 0.6,
    },
    detector: {
      mode: 'rms',
      attack: 20,
      release: 200,
      hold: 60,
    },
    filter: {
      type: 'bandpass',
      frequency: 2500,
      Q: 0.7,
      enabled: true,
    },
    routingMode: 'post-fader',
    detectionMode: 'rms',
  },

  // =============================================================================
  // Creative Presets
  // =============================================================================

  'ghost-trigger': {
    id: 'ghost-trigger',
    name: 'Ghost Trigger',
    description: 'Use silent track as sidechain trigger',
    category: 'creative',
    processor: {
      attack: 0.1,
      release: 150,
      threshold: -40,
      ratio: 8,
      knee: 3,
      mix: 1,
    },
    detector: {
      mode: 'peak',
      attack: 0.1,
      release: 100,
      hold: 5,
    },
    filter: {
      type: 'none',
      frequency: 1000,
      Q: 1,
      enabled: false,
    },
    routingMode: 'pre-fader',
    detectionMode: 'peak',
  },

  'rhythmic-gate': {
    id: 'rhythmic-gate',
    name: 'Rhythmic Gate',
    description: 'Create rhythmic patterns with sidechain',
    category: 'creative',
    processor: {
      attack: 0.01,
      release: 50,
      threshold: -35,
      ratio: 20,
      knee: 0,
      mix: 1,
    },
    detector: {
      mode: 'peak',
      attack: 0.01,
      release: 30,
      hold: 0,
    },
    filter: {
      type: 'none',
      frequency: 1000,
      Q: 1,
      enabled: false,
    },
    routingMode: 'post-fader',
    detectionMode: 'peak',
  },

  // =============================================================================
  // Frequency-Selective Presets
  // =============================================================================

  'kick-bass-frequency': {
    id: 'kick-bass-frequency',
    name: 'Kick → Bass Frequency',
    description: 'Duck only bass frequencies from kick',
    category: 'frequency',
    processor: {
      attack: 1,
      release: 150,
      threshold: -25,
      ratio: 6,
      knee: 6,
      mix: 1,
    },
    detector: {
      mode: 'peak',
      attack: 1,
      release: 100,
      hold: 10,
    },
    filter: {
      type: 'lowpass',
      frequency: 100,
      Q: 2,
      enabled: true,
    },
    routingMode: 'post-fader',
    detectionMode: 'peak',
  },

  'vocal-mid-frequency': {
    id: 'vocal-mid-frequency',
    name: 'Vocal → Music Mid',
    description: 'Duck mid frequencies for vocal clarity',
    category: 'frequency',
    processor: {
      attack: 10,
      release: 200,
      threshold: -28,
      ratio: 3,
      knee: 8,
      mix: 0.8,
    },
    detector: {
      mode: 'rms',
      attack: 15,
      release: 180,
      hold: 40,
    },
    filter: {
      type: 'bandpass',
      frequency: 2000,
      Q: 1.5,
      enabled: true,
    },
    routingMode: 'post-fader',
    detectionMode: 'rms',
  },
};

// =============================================================================
// Preset Categories
// =============================================================================

export const SIDECHAIN_CATEGORIES = {
  ducking: {
    name: 'Ducking',
    description: 'Classic sidechain ducking for mixing',
    presets: ['kick-bass', 'kick-bass-subtle', 'snare-bass'],
  },
  pumping: {
    name: 'Pumping',
    description: 'Creative pumping effects for electronic music',
    presets: ['kick-pads-hard', 'kick-pads-soft', 'kick-pads-vintage'],
  },
  presence: {
    name: 'Presence',
    description: 'Make room for lead elements',
    presets: ['vocal-music', 'lead-music'],
  },
  creative: {
    name: 'Creative',
    description: 'Creative sidechain effects',
    presets: ['ghost-trigger', 'rhythmic-gate'],
  },
  frequency: {
    name: 'Frequency',
    description: 'Frequency-selective sidechain',
    presets: ['kick-bass-frequency', 'vocal-mid-frequency'],
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

export function getSidechainPreset(presetId: string): SidechainPreset | null {
  return SIDECHAIN_PRESETS[presetId] ?? null;
}

export function getSidechainPresetsByCategory(category: string): SidechainPreset[] {
  return Object.values(SIDECHAIN_PRESETS).filter(p => p.category === category);
}

export function getAllSidechainPresets(): SidechainPreset[] {
  return Object.values(SIDECHAIN_PRESETS);
}

export default SIDECHAIN_PRESETS;
