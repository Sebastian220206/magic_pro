import { WasmEQ } from '../dsp/processors/WasmEQ';
import { WasmCompressor } from '../dsp/processors/WasmCompressor';
import { PluginAPI } from './PluginAPI';

export interface PluginDefinition {
  id: string;
  name: string;
  type: 'effect' | 'instrument';
  category: 'dynamics' | 'eq' | 'reverb' | 'synth';
  instantiateDSP: () => PluginAPI;
}

export class PluginRegistry {
  private static plugins: Map<string, PluginDefinition> = new Map();

  public static initialize() {
    this.register({
      id: 'magic_wasm_eq',
      name: 'Magic EQ',
      type: 'effect',
      category: 'eq',
      instantiateDSP: () => new WasmEQ(globalThis as any) // Replaced with actual global runtime in practice
    });

    this.register({
      id: 'magic_wasm_comp',
      name: 'Magic Compressor',
      type: 'effect',
      category: 'dynamics',
      instantiateDSP: () => new WasmCompressor(globalThis as any)
    });
  }

  public static register(def: PluginDefinition) {
    this.plugins.set(def.id, def);
  }

  public static get(id: string): PluginDefinition | undefined {
    return this.plugins.get(id);
  }

  public static getAll(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }
}
