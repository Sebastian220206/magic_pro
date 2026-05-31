export interface RuntimeDiagnostics {
  crossOriginIsolated: boolean;
  sharedArrayBuffer: {
    available: boolean;
    allocationSuccess: boolean;
    error: string | null;
  };
  audioWorklet: {
    supported: boolean;
    loadedWorklets: string[];
  };
  webAssembly: {
    supported: boolean;
    simd: boolean;
  };
  webGL: {
    available: boolean;
    renderer: string | null;
  };
  webGPU: {
    available: boolean;
    adapter: string | null;
  };
  audioContext: {
    state: AudioContextState | null;
    sampleRate: number | null;
    baseLatency: number | null;
  };
}

export function checkSharedArrayBuffer(): RuntimeDiagnostics {
  const diag: RuntimeDiagnostics = {
    crossOriginIsolated: false,
    sharedArrayBuffer: { available: false, allocationSuccess: false, error: null },
    audioWorklet: { supported: false, loadedWorklets: [] },
    webAssembly: { supported: false, simd: false },
    webGL: { available: false, renderer: null },
    webGPU: { available: false, adapter: null },
    audioContext: { state: null, sampleRate: null, baseLatency: null },
  };

  if (typeof window === 'undefined') return diag;

  // Cross-Origin Isolation
  diag.crossOriginIsolated = !!self.crossOriginIsolated;

  // SharedArrayBuffer
  diag.sharedArrayBuffer.available = typeof SharedArrayBuffer === 'function';
  if (diag.sharedArrayBuffer.available) {
    try {
      const sab = new SharedArrayBuffer(1024);
      diag.sharedArrayBuffer.allocationSuccess = sab.byteLength === 1024;
    } catch (e: unknown) {
      diag.sharedArrayBuffer.allocationSuccess = false;
      diag.sharedArrayBuffer.error = e instanceof Error ? e.message : String(e);
    }
  }

  // AudioWorklet
  diag.audioWorklet.supported = !!(
    self.AudioContext &&
    self.AudioContext.prototype &&
    'audioWorklet' in AudioContext.prototype
  );

  // WebAssembly
  diag.webAssembly.supported = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  diag.webAssembly.simd =
    diag.webAssembly.supported &&
    typeof WebAssembly.validate === 'function' &&
    (self as any).WebAssembly?.SIMD === true;

  // WebGL
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      diag.webGL.available = true;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        diag.webGL.renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
    }
  } catch {
    // WebGL unavailable
  }

  // WebGPU
  const navAny = navigator as any;
  if (typeof navAny.gpu !== 'undefined' && typeof navAny.gpu.requestAdapter === 'function') {
    diag.webGPU.available = true;
    navAny.gpu.requestAdapter().then((adapter: any) => {
      if (adapter) {
        diag.webGPU.adapter = adapter.name || 'unknown';
      }
    }).catch(() => {});
  }

  // AudioContext
  try {
    const ctx = new AudioContext();
    diag.audioContext.state = ctx.state;
    diag.audioContext.sampleRate = ctx.sampleRate;
    diag.audioContext.baseLatency = ctx.baseLatency;
    ctx.close();
  } catch {
    // AudioContext unavailable
  }

  return diag;
}

export function getRuntimeSummary(diag?: RuntimeDiagnostics): string {
  const d = diag || checkSharedArrayBuffer();
  const parts: string[] = [];
  parts.push(`COI: ${d.crossOriginIsolated ? 'YES' : 'NO'}`);
  parts.push(`SAB: ${d.sharedArrayBuffer.available && d.sharedArrayBuffer.allocationSuccess ? 'OK' : 'FAIL'}`);
  parts.push(`Worklet: ${d.audioWorklet.supported ? 'YES' : 'NO'}`);
  parts.push(`WASM: ${d.webAssembly.supported ? 'YES' : 'NO'}`);
  parts.push(`WebGL: ${d.webGL.available ? 'YES' : 'NO'}`);
  return parts.join(' | ');
}
