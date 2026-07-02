import type { PluginAPI } from './PluginAPI';
import type { PluginManifest } from './manifest';

export enum PluginState {
  Unloaded,
  Loading,
  Ready,
  Error,
  Disposed,
}

export interface PluginSandboxConfig {
  manifest: PluginManifest;
  wasmUrl?: string;
  sampleRate: number;
}

export class PluginSandbox {
  private _state: PluginState = PluginState.Unloaded;
  private _manifest: PluginManifest;
  private _wasmUrl?: string;
  private _sampleRate: number;
  private _wasmModule?: WebAssembly.Module;
  private _wasmInstance?: WebAssembly.Instance;
  private _pluginAPI?: PluginAPI;
  private _audioContext?: AudioContext;
  private _workletNode?: AudioWorkletNode;

  constructor(config: PluginSandboxConfig) {
    this._manifest = config.manifest;
    this._wasmUrl = config.wasmUrl || config.manifest.wasmUrl;
    this._sampleRate = config.sampleRate;
  }

  get state(): PluginState {
    return this._state;
  }

  get manifest(): PluginManifest {
    return this._manifest;
  }

  get pluginAPI(): PluginAPI | undefined {
    return this._pluginAPI;
  }

  get workletNode(): AudioWorkletNode | undefined {
    return this._workletNode;
  }

  async load(): Promise<void> {
    if (this._state !== PluginState.Unloaded) return;
    this._state = PluginState.Loading;

    try {
      if (this._wasmUrl) {
        const response = await fetch(this._wasmUrl);
        const wasmBytes = await response.arrayBuffer();
        this._wasmModule = await WebAssembly.compile(wasmBytes);
        const importObj = {
          env: {
            memory: new WebAssembly.Memory({ initial: 256 }),
            abort: () => console.error('[PluginSandbox] WASM abort'),
          },
        };
        this._wasmInstance = await WebAssembly.instantiate(this._wasmModule, importObj);
      }

      this._state = PluginState.Ready;
    } catch (err) {
      console.error(`[PluginSandbox] Failed to load plugin ${this._manifest.id}:`, err);
      this._state = PluginState.Error;
      throw err;
    }
  }

  async connectWorklet(audioContext: AudioContext): Promise<AudioWorkletNode> {
    if (this._state !== PluginState.Ready) {
      throw new Error('Plugin not ready');
    }

    this._audioContext = audioContext;

    try {
      const blob = new Blob(
        [
          `class PluginWorklet extends AudioWorkletProcessor {
  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length || !output || !output.length) return true;
    for (let ch = 0; ch < Math.min(input.length, output.length); ch++) {
      for (let s = 0; s < input[ch].length; s++) {
        output[ch][s] = input[ch][s];
      }
    }
    return true;
  }
}
registerProcessor('plugin-worklet-${this._manifest.id}', PluginWorklet);`,
        ],
        { type: 'application/javascript' }
      );
      const url = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      this._workletNode = new AudioWorkletNode(audioContext, `plugin-worklet-${this._manifest.id}`);
      return this._workletNode;
    } catch (err) {
      console.error(`[PluginSandbox] Failed to create worklet for ${this._manifest.id}:`, err);
      throw err;
    }
  }

  setPluginAPI(api: PluginAPI): void {
    this._pluginAPI = api;
  }

  processBlock(inputs: Float32Array[], outputs: Float32Array[], params: Record<string, number>): void {
    if (this._pluginAPI) {
      this._pluginAPI.process(inputs, outputs, params);
    }
  }

  dispose(): void {
    if (this._pluginAPI) {
      this._pluginAPI.dispose();
    }
    this._workletNode?.disconnect();
    this._workletNode = undefined;
    this._wasmInstance = undefined;
    this._wasmModule = undefined;
    this._audioContext = undefined;
    this._state = PluginState.Disposed;
  }
}

export class IFramePluginSandbox {
  private _iframe: HTMLIFrameElement | null = null;
  private _messagePort?: MessagePort;
  private _manifest: PluginManifest;
  private _ready = false;

  constructor(manifest: PluginManifest) {
    this._manifest = manifest;
  }

  get manifest(): PluginManifest {
    return this._manifest;
  }

  get ready(): boolean {
    return this._ready;
  }

  mount(container: HTMLElement): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts', 'allow-same-origin');
    iframe.src = this._manifest.ui?.url || 'about:blank';
    iframe.style.width = `${this._manifest.ui?.width || 400}px`;
    iframe.style.height = `${this._manifest.ui?.height || 300}px`;
    iframe.style.border = 'none';
    iframe.style.background = 'transparent';

    iframe.onload = () => {
      this._ready = true;
    };

    container.appendChild(iframe);
    this._iframe = iframe;
    return iframe;
  }

  postMessage(msg: unknown): void {
    this._iframe?.contentWindow?.postMessage(msg, '*');
  }

  unmount(): void {
    this._iframe?.remove();
    this._iframe = null;
    this._ready = false;
  }
}
