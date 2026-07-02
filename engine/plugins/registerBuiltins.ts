import { PluginRegistry } from './PluginRegistry';
import { registerPluginUI } from './UIRegistry';
import type { PluginManifest } from './manifest';
import { WasmEQUI } from '@/components/plugins/WasmEQUI';
import { WasmCompressorUI } from '@/components/plugins/WasmCompressorUI';

export function registerBuiltinPlugins(): void {
  PluginRegistry.initialize();

  const eqManifest: PluginManifest = {
    manifestVersion: 1,
    id: 'magic_wasm_eq',
    name: 'Magic EQ',
    version: '1.0.0',
    type: 'effect',
    category: 'eq',
    parameters: [
      { id: 'freq', name: 'Frequency', type: 'float', defaultValue: 1000, minValue: 20, maxValue: 20000, step: 1, unit: 'Hz', automatable: true },
      { id: 'q', name: 'Q (Resonance)', type: 'float', defaultValue: 1, minValue: 0.1, maxValue: 10, step: 0.1, automatable: true },
      { id: 'gain', name: 'Gain', type: 'float', defaultValue: 0, minValue: -24, maxValue: 24, step: 0.1, unit: 'dB', automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
    ui: { component: 'wasm_eq', width: 320, height: 260 },
  };

  const compManifest: PluginManifest = {
    manifestVersion: 1,
    id: 'magic_wasm_comp',
    name: 'Magic Compressor',
    version: '1.0.0',
    type: 'effect',
    category: 'dynamics',
    parameters: [
      { id: 'threshold', name: 'Threshold', type: 'float', defaultValue: -20, minValue: -60, maxValue: 0, step: 0.5, unit: 'dB', automatable: true },
      { id: 'ratio', name: 'Ratio', type: 'float', defaultValue: 4, minValue: 1, maxValue: 20, step: 0.5, unit: ':1', automatable: true },
      { id: 'attack', name: 'Attack', type: 'float', defaultValue: 10, minValue: 0.1, maxValue: 100, step: 0.1, unit: 'ms', automatable: true },
      { id: 'release', name: 'Release', type: 'float', defaultValue: 100, minValue: 1, maxValue: 1000, step: 1, unit: 'ms', automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
    ui: { component: 'wasm_comp', width: 320, height: 260 },
  };

  const reverbManifest: PluginManifest = {
    manifestVersion: 1,
    id: 'magic_wasm_reverb',
    name: 'Magic Reverb',
    version: '1.0.0',
    type: 'effect',
    category: 'reverb',
    parameters: [
      { id: 'decay', name: 'Decay', type: 'float', defaultValue: 2, minValue: 0.1, maxValue: 10, step: 0.1, unit: 's', automatable: true },
      { id: 'damping', name: 'Damping', type: 'float', defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.05, automatable: true },
      { id: 'roomSize', name: 'Room Size', type: 'float', defaultValue: 0.7, minValue: 0, maxValue: 1, step: 0.05, automatable: true },
      { id: 'mix', name: 'Mix', type: 'float', defaultValue: 0.3, minValue: 0, maxValue: 1, step: 0.05, automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
  };

  const delayManifest: PluginManifest = {
    manifestVersion: 1,
    id: 'magic_wasm_delay',
    name: 'Magic Delay',
    version: '1.0.0',
    type: 'effect',
    category: 'delay',
    parameters: [
      { id: 'delayTime', name: 'Delay Time', type: 'float', defaultValue: 250, minValue: 1, maxValue: 2000, step: 1, unit: 'ms', automatable: true },
      { id: 'feedback', name: 'Feedback', type: 'float', defaultValue: 0.3, minValue: 0, maxValue: 0.99, step: 0.01, automatable: true },
      { id: 'mix', name: 'Mix', type: 'float', defaultValue: 0.3, minValue: 0, maxValue: 1, step: 0.05, automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
  };

  const saturationManifest: PluginManifest = {
    manifestVersion: 1,
    id: 'magic_wasm_saturation',
    name: 'Magic Saturation',
    version: '1.0.0',
    type: 'effect',
    category: 'distortion',
    parameters: [
      { id: 'drive', name: 'Drive', type: 'float', defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.05, automatable: true },
      { id: 'mix', name: 'Mix', type: 'float', defaultValue: 1, minValue: 0, maxValue: 1, step: 0.05, automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
  };

  const chorusManifest: PluginManifest = {
    manifestVersion: 1,
    id: 'magic_wasm_chorus',
    name: 'Magic Chorus',
    version: '1.0.0',
    type: 'effect',
    category: 'modulation',
    parameters: [
      { id: 'depth', name: 'Depth', type: 'float', defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.05, automatable: true },
      { id: 'rate', name: 'Rate', type: 'float', defaultValue: 0.5, minValue: 0.01, maxValue: 5, step: 0.01, unit: 'Hz', automatable: true },
      { id: 'mix', name: 'Mix', type: 'float', defaultValue: 0.4, minValue: 0, maxValue: 1, step: 0.05, automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
  };

  const limiterManifest: PluginManifest = {
    manifestVersion: 1,
    id: 'magic_wasm_limiter',
    name: 'Magic Limiter',
    version: '1.0.0',
    type: 'effect',
    category: 'dynamics',
    parameters: [
      { id: 'threshold', name: 'Threshold', type: 'float', defaultValue: -6, minValue: -40, maxValue: 0, step: 0.5, unit: 'dB', automatable: true },
      { id: 'attack', name: 'Attack', type: 'float', defaultValue: 1, minValue: 0.01, maxValue: 50, step: 0.01, unit: 'ms', automatable: true },
      { id: 'release', name: 'Release', type: 'float', defaultValue: 50, minValue: 1, maxValue: 500, step: 1, unit: 'ms', automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
  };

  const deesserManifest: PluginManifest = {
    manifestVersion: 1,
    id: 'magic_wasm_deesser',
    name: 'Magic De-Esser',
    version: '1.0.0',
    type: 'effect',
    category: 'dynamics',
    parameters: [
      { id: 'threshold', name: 'Threshold', type: 'float', defaultValue: -20, minValue: -60, maxValue: 0, step: 0.5, unit: 'dB', automatable: true },
      { id: 'ratio', name: 'Ratio', type: 'float', defaultValue: 5, minValue: 1, maxValue: 20, step: 0.5, automatable: true },
      { id: 'frequency', name: 'Frequency', type: 'float', defaultValue: 7000, minValue: 2000, maxValue: 12000, step: 100, unit: 'Hz', automatable: true },
    ],
    audioIO: { numInputs: 2, numOutputs: 2, supportsMidi: false },
  };

  PluginRegistry.registerDescriptor('magic_wasm_eq', { manifest: eqManifest, builtin: true });
  PluginRegistry.registerDescriptor('magic_wasm_comp', { manifest: compManifest, builtin: true });
  PluginRegistry.registerDescriptor('magic_wasm_reverb', { manifest: reverbManifest, builtin: true });
  PluginRegistry.registerDescriptor('magic_wasm_delay', { manifest: delayManifest, builtin: true });
  PluginRegistry.registerDescriptor('magic_wasm_saturation', { manifest: saturationManifest, builtin: true });
  PluginRegistry.registerDescriptor('magic_wasm_chorus', { manifest: chorusManifest, builtin: true });
  PluginRegistry.registerDescriptor('magic_wasm_limiter', { manifest: limiterManifest, builtin: true });
  PluginRegistry.registerDescriptor('magic_wasm_deesser', { manifest: deesserManifest, builtin: true });

  registerPluginUI('magic_wasm_eq', WasmEQUI, { width: 320, height: 260 });
  registerPluginUI('magic_wasm_comp', WasmCompressorUI, { width: 320, height: 260 });
}

export function getBuiltinManifest(id: string): PluginManifest | undefined {
  return PluginRegistry.getDescriptor(id)?.manifest;
}
