"use client";

import { useEffect, useState } from "react";
import { checkSharedArrayBuffer, getRuntimeSummary, type RuntimeDiagnostics } from "@/lib/runtime/checkSharedArrayBuffer";

export default function RuntimeDebugPage() {
  const [diag, setDiag] = useState<RuntimeDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    try {
      setDiag(checkSharedArrayBuffer());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refreshKey]);

  return (
    <div className="min-h-screen bg-black text-gray-200 font-mono p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white tracking-tight">
            Magic Pro — Runtime Diagnostics
          </h1>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-lg p-4 text-sm text-red-300">
            Diagnostics error: {error}
          </div>
        )}

        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800 text-xs text-gray-500 font-bold uppercase tracking-wider">
            Summary
          </div>
          <div className="px-4 py-3 text-sm text-gray-300">
            {diag ? getRuntimeSummary(diag) : 'Running diagnostics...'}
          </div>
        </div>

        {diag && (
          <>
            {/* Cross-Origin Isolation */}
            <Section title="Cross-Origin Isolation">
              <Row label="crossOriginIsolated" value={diag.crossOriginIsolated} />
            </Section>

            {/* SharedArrayBuffer */}
            <Section title="SharedArrayBuffer">
              <Row label="Available" value={diag.sharedArrayBuffer.available} />
              <Row label="Allocation test" value={diag.sharedArrayBuffer.allocationSuccess} />
              {diag.sharedArrayBuffer.error && (
                <Row label="Error" value={false} text={diag.sharedArrayBuffer.error} />
              )}
            </Section>

            {/* AudioWorklet */}
            <Section title="AudioWorklet">
              <Row label="Supported" value={diag.audioWorklet.supported} />
              {diag.audioWorklet.loadedWorklets.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Loaded: {diag.audioWorklet.loadedWorklets.join(', ')}
                </div>
              )}
            </Section>

            {/* WebAssembly */}
            <Section title="WebAssembly">
              <Row label="Supported" value={diag.webAssembly.supported} />
              <Row label="SIMD" value={diag.webAssembly.simd} />
            </Section>

            {/* WebGL / WebGPU */}
            <Section title="Graphics">
              <Row label="WebGL" value={diag.webGL.available} />
              {diag.webGL.renderer && (
                <div className="text-xs text-gray-500 mt-1 truncate">
                  Renderer: {diag.webGL.renderer}
                </div>
              )}
              <Row label="WebGPU" value={diag.webGPU.available} />
              {diag.webGPU.adapter && (
                <div className="text-xs text-gray-500 mt-1">
                  Adapter: {diag.webGPU.adapter}
                </div>
              )}
            </Section>

            {/* AudioContext */}
            <Section title="AudioContext">
              <Row label="State" value={true} text={diag.audioContext.state ?? 'N/A'} />
              <Row label="Sample Rate" value={true} text={String(diag.audioContext.sampleRate ?? 'N/A')} />
              <Row label="Base Latency" value={true} text={String(diag.audioContext.baseLatency ?? 'N/A')} />
            </Section>

            {/* Environment */}
            <Section title="Environment">
              <div className="text-xs text-gray-500 space-y-1">
                <div>User Agent: {navigator.userAgent}</div>
                <div>Platform: {navigator.platform}</div>
                <div>Vendor: {navigator.vendor}</div>
                <div>Cookies enabled: {navigator.cookieEnabled ? 'Yes' : 'No'}</div>
              </div>
            </Section>
          </>
        )}

        {/* Headers check — only works if page served with COOP/COEP */}
        {diag?.crossOriginIsolated === false && (
          <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg p-4 text-sm text-yellow-300">
            <strong>Warning:</strong> Page is not cross-origin isolated.
            SharedArrayBuffer will not be available for audio transport.
            Ensure COOP and COEP headers are set on the server.
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800 text-xs text-gray-500 font-bold uppercase tracking-wider">
        {title}
      </div>
      <div className="px-4 py-3 space-y-2">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, text }: { label: string; value: boolean; text?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={value ? 'text-emerald-400' : 'text-red-400'}>
        {text ?? (value ? 'Yes' : 'No')}
      </span>
    </div>
  );
}
