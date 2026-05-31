export interface IsolationStatus {
  crossOriginIsolated: boolean;
  sharedArrayBufferAvailable: boolean;
  sabAllocation: boolean;
  audioWorkletSupported: boolean;
  wasmSupported: boolean;
  warnings: string[];
}

export function checkCrossOriginIsolation(): IsolationStatus {
  const status: IsolationStatus = {
    crossOriginIsolated: false,
    sharedArrayBufferAvailable: false,
    sabAllocation: false,
    audioWorkletSupported: false,
    wasmSupported: false,
    warnings: [],
  };

  if (typeof window === 'undefined') return status;

  // 1. Cross-Origin Isolation
  status.crossOriginIsolated = !!self.crossOriginIsolated;
  if (!status.crossOriginIsolated) {
    status.warnings.push(
      'Page is not cross-origin isolated (crossOriginIsolated = false). ' +
      'SharedArrayBuffer will be undefined. ' +
      'Ensure COOP: same-origin and COEP: require-corp headers are set.'
    );
  }

  // 2. SharedArrayBuffer availability
  status.sharedArrayBufferAvailable = typeof SharedArrayBuffer === 'function';
  if (!status.sharedArrayBufferAvailable) {
    status.warnings.push(
      'SharedArrayBuffer is not available. AudioWorklet shared memory transport will not function.'
    );
  }

  // 3. SAB allocation test
  if (status.sharedArrayBufferAvailable) {
    try {
      const sab = new SharedArrayBuffer(1024);
      if (sab.byteLength === 1024) {
        status.sabAllocation = true;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      status.warnings.push(`SharedArrayBuffer allocation failed: ${msg}`);
    }
  }

  // 4. AudioWorklet support
  status.audioWorkletSupported = !!(self.AudioContext && self.AudioContext.prototype.audioWorklet);
  if (!status.audioWorkletSupported) {
    status.warnings.push('AudioWorklet is not supported in this browser.');
  }

  // 5. WASM support
  status.wasmSupported = !!(self.WebAssembly && self.WebAssembly.instantiate);
  if (!status.wasmSupported) {
    status.warnings.push('WebAssembly is not supported in this browser.');
  }

  return status;
}

export function getIsolationSummary(status?: IsolationStatus): string {
  const s = status || checkCrossOriginIsolation();
  const parts: string[] = [];

  parts.push(`crossOriginIsolated: ${s.crossOriginIsolated ? 'YES' : 'NO'}`);
  parts.push(`SharedArrayBuffer: ${s.sharedArrayBufferAvailable && s.sabAllocation ? 'YES' : 'NO'}`);
  parts.push(`AudioWorklet: ${s.audioWorkletSupported ? 'YES' : 'NO'}`);
  parts.push(`WASM: ${s.wasmSupported ? 'YES' : 'NO'}`);

  return parts.join(' | ');
}
