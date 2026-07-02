import type { PluginManifest } from './manifest';

export interface PluginAPI {
  initialize(sampleRate: number): void;
  process(input: Float32Array[], output: Float32Array[], params: Record<string, number>): void;
  dispose(): void;
}

export interface MidiEvent {
  noteOn: boolean;
  pitch: number;
  velocity: number;
  sampleOffset: number;
}

export interface MagicPlugin {
  initialize(sampleRate: number): void;
  processAudio(inputs: Float32Array[], outputs: Float32Array[]): void;
  processMidi(events: MidiEvent[]): void;
}

export interface PluginFactory {
  new (runtime?: unknown): PluginAPI;
}

export interface PluginDescriptor {
  manifest: PluginManifest;
  factory?: PluginFactory;
  builtin?: boolean;
}
