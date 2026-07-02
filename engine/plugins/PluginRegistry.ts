import { WasmEQ } from '../dsp/processors/WasmEQ';
import { WasmCompressor } from '../dsp/processors/WasmCompressor';
import type { PluginAPI, PluginDescriptor } from './PluginAPI';
import type { PluginManifest } from './manifest';
import { validateManifest } from './manifest';

export interface PluginDefinition {
  id: string;
  name: string;
  type: 'effect' | 'instrument';
  category: string;
  instantiateDSP: () => PluginAPI;
  manifest?: PluginManifest;
}

export class PluginRegistry {
  private static plugins: Map<string, PluginDefinition> = new Map();
  private static descriptors: Map<string, PluginDescriptor> = new Map();

  public static initialize() {
    this.register({
      id: 'magic_wasm_eq',
      name: 'Magic EQ',
      type: 'effect',
      category: 'eq',
      instantiateDSP: () => new WasmEQ(globalThis as any),
    });

    this.register({
      id: 'magic_wasm_comp',
      name: 'Magic Compressor',
      type: 'effect',
      category: 'dynamics',
      instantiateDSP: () => new WasmCompressor(globalThis as any),
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

  public static async loadFromManifest(url: string): Promise<PluginDefinition> {
    const response = await fetch(url);
    const raw = await response.json();

    if (!validateManifest(raw)) {
      throw new Error(`Invalid plugin manifest at ${url}`);
    }

    const manifest = raw as PluginManifest;

    const def: PluginDefinition = {
      id: manifest.id,
      name: manifest.name,
      type: manifest.type,
      category: manifest.category,
      manifest,
      instantiateDSP: () => {
        let wasmInstance: WebAssembly.Instance | null = null;
        const api: PluginAPI = {
          initialize: (_sampleRate: number) => {},
          process: (_input, _output, _params) => {
            if (wasmInstance) {
              const processFn = (wasmInstance.exports.process_block ||
                wasmInstance.exports.process) as CallableFunction | undefined;
              processFn?.();
            }
          },
          dispose: () => {
            wasmInstance = null;
          },
        };

        if (manifest.wasmUrl) {
          this._loadWasmPlugin(manifest.wasmUrl, api);
        }

        return api;
      },
    };

    this.register(def);
    return def;
  }

  private static async _loadWasmPlugin(
    wasmUrl: string,
    api: PluginAPI
  ): Promise<void> {
    try {
      const response = await fetch(wasmUrl);
      const bytes = await response.arrayBuffer();
      const module = await WebAssembly.compile(bytes);
      const memory = new WebAssembly.Memory({ initial: 256 });
      const instance = await WebAssembly.instantiate(module, {
        env: { memory, abort: () => console.error('[WasmPlugin] abort') },
      });

      const initFn = instance.exports.initialize as CallableFunction | undefined;
      const processBlock = instance.exports.process_block as CallableFunction | undefined;
      const processFn = instance.exports.process as CallableFunction | undefined;
      const disposeFn = instance.exports.dispose as CallableFunction | undefined;

      const origInit = api.initialize.bind(api);
      const origProcess = api.process.bind(api);
      const origDispose = api.dispose.bind(api);

      api.initialize = (sampleRate: number) => {
        initFn?.(sampleRate);
        origInit(sampleRate);
      };

      api.process = (input, output, params) => {
        if (processBlock) {
          processBlock();
        } else if (processFn) {
          processFn();
        }
        origProcess(input, output, params);
      };

      api.dispose = () => {
        disposeFn?.();
        origDispose();
      };
    } catch (err) {
      console.error(`[PluginRegistry] Failed to load WASM plugin from ${wasmUrl}:`, err);
    }
  }

  public static registerDescriptor(id: string, desc: PluginDescriptor): void {
    this.descriptors.set(id, desc);
    this.plugins.set(id, {
      id: desc.manifest.id,
      name: desc.manifest.name,
      type: desc.manifest.type,
      category: desc.manifest.category,
      manifest: desc.manifest,
      instantiateDSP: () => {
        if (desc.factory) {
          return new desc.factory(globalThis as any);
        }
        let wasmInstance: WebAssembly.Instance | null = null;
        return {
          initialize: () => {},
          process: (_i, _o, _p) => {
            const fn = wasmInstance?.exports.process_block as CallableFunction | undefined;
            fn?.();
          },
          dispose: () => { wasmInstance = null; },
        };
      },
    });
  }

  public static getDescriptor(id: string): PluginDescriptor | undefined {
    return this.descriptors.get(id);
  }

  public static getAllDescriptors(): PluginDescriptor[] {
    return Array.from(this.descriptors.values());
  }
}
