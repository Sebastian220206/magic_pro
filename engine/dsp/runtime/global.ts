import { globalSharedTransport } from '../memory/SharedTransportBuffer';

class WasmRuntime {
  private _initialized = false;

  async initialize(_path: string): Promise<void> {
    if (this._initialized) return;
    console.warn('[WasmRuntime] WASM SIMD core not bundled in this build. Initialize is a no-op.');
    this._initialized = true;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }
}

class DSPRuntime {
  private _context: AudioContext | null = null;
  public masterWorkletNode: AudioWorkletNode | null = null;
  public wasmRuntime = new WasmRuntime();

  async initializeContext(): Promise<AudioContext> {
    if (this._context && this._context.state !== 'closed') {
      return this._context;
    }

    const ctx = new AudioContext({ sampleRate: 48000 });

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this._context = ctx;

    const sab = globalSharedTransport.buffer || globalSharedTransport.initialize() || null;

    console.log('[DSPRuntime] AudioContext initialized', {
      sampleRate: ctx.sampleRate,
      baseLatency: ctx.baseLatency,
      state: ctx.state,
      crossOriginIsolated: self.crossOriginIsolated,
      sharedArrayBufferAvailable: typeof SharedArrayBuffer !== 'undefined',
      transportBufferReady: !!sab,
    });

    return ctx;
  }

  get context(): AudioContext | null {
    return this._context;
  }
}

export const globalDSP = new DSPRuntime();
