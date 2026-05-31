"use client";

import { useEffect, useState } from "react";
import { checkCrossOriginIsolation, getIsolationSummary, type IsolationStatus } from "@/engine/runtime/checkCrossOriginIsolation";

interface Props {
  engineReady: boolean;
  engineError: string | null;
}

export function CrossOriginIsolationOverlay({ engineReady, engineError }: Props) {
  const [status, setStatus] = useState<IsolationStatus | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setStatus(checkCrossOriginIsolation());
  }, []);

  if (!status) return null;

  const isFatal = !status.crossOriginIsolated && status.warnings.length > 0 && !engineReady;

  if (!engineError && !isFatal) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-daw-panel border border-red-800/40 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="bg-red-900/30 px-6 py-4 border-b border-red-800/30">
          <h2 className="text-red-400 font-bold text-lg flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            Audio Engine Error
          </h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          {engineError && (
            <div>
              <p className="text-gray-300 text-sm font-medium">Engine Error:</p>
              <p className="text-red-300 text-sm mt-1 font-mono bg-black/40 rounded p-2">{engineError}</p>
            </div>
          )}

          {isFatal && (
            <div>
              <p className="text-gray-300 text-sm font-medium">Cross-Origin Isolation Required</p>
              <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                This application requires cross-origin isolation for real-time audio processing.
                The browser must have <code className="text-yellow-400 bg-black/40 px-1 rounded">crossOriginIsolated = true</code>.
              </p>
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-gray-300 transition w-full text-left"
          >
            {expanded ? 'Hide' : 'Show'} diagnostics
          </button>

          {expanded && (
            <div className="bg-black/40 rounded-lg p-3 space-y-1.5 text-xs font-mono">
              <Row label="crossOriginIsolated" value={status.crossOriginIsolated} />
              <Row label="SharedArrayBuffer" value={status.sharedArrayBufferAvailable && status.sabAllocation} />
              <Row label="AudioWorklet" value={status.audioWorkletSupported} />
              <Row label="WASM" value={status.wasmSupported} />
              <div className="border-t border-white/5 pt-1.5 mt-1.5">
                <span className="text-gray-500">{getIsolationSummary(status)}</span>
              </div>
            </div>
          )}

          {status.warnings.length > 0 && (
            <div className="space-y-1.5">
              {status.warnings.map((w, i) => (
                <p key={i} className="text-yellow-500/80 text-xs">{w}</p>
              ))}
            </div>
          )}

          {!isFatal && engineError && (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-lg bg-daw-primary text-white font-medium hover:bg-blue-600 transition text-sm"
            >
              Reload Application
            </button>
          )}
        </div>

        <div className="px-6 py-3 bg-black/20 border-t border-white/5">
          <p className="text-[10px] text-gray-600">
            Magic Pro Audio Engine &mdash; Cross-Origin Isolation v1
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={value ? 'text-emerald-400' : 'text-red-400'}>
        {value ? 'YES' : 'NO'}
      </span>
    </div>
  );
}
