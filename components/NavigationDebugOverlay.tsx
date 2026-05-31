"use client";

import React, { useEffect, useState } from 'react';
import { globalProfiler } from '@/engine/rendering/profiler/FrameProfiler';
import { RenderMetrics, createEmptyMetrics } from '@/engine/rendering/profiler/RenderMetrics';

export function NavigationDebugOverlay() {
  const [metrics, setMetrics] = useState<RenderMetrics>(createEmptyMetrics());
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // We throttle the React state update so we don't cause React to render 60 times a second
    // The profiler is internal and fast, but the React UI overlay should only update 4-10 times a second.
    let lastUpdate = 0;
    const unsubscribe = globalProfiler.subscribe((latestMetrics) => {
      const now = performance.now();
      if (now - lastUpdate > 100) { // 10fps UI updates for the debugger
        setMetrics(latestMetrics);
        lastUpdate = now;
      }
    });

    return unsubscribe;
  }, []);

  if (!visible) return null;

  const MetricRow = ({ label, value, unit, alertThreshold }: { label: string, value: number | string, unit?: string, alertThreshold?: number }) => {
    const isAlert = alertThreshold !== undefined && typeof value === 'number' && value > alertThreshold;
    return (
      <div className="flex justify-between items-center text-[10px] border-b border-white/10 py-0.5">
        <span className="text-gray-400">{label}</span>
        <span className={`font-mono font-bold ${isAlert ? 'text-red-400' : 'text-green-400'}`}>
          {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}{unit}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] w-64 bg-black/80 backdrop-blur-md border border-white/20 rounded-md shadow-2xl p-3 select-none pointer-events-none">
      <div className="flex justify-between items-center mb-2 pb-1 border-b border-white/20">
        <span className="text-[11px] font-black tracking-widest text-white uppercase">Engine Profiler</span>
        <span className={`text-[12px] font-black ${metrics.fps < 50 ? 'text-red-500' : 'text-green-500'}`}>
          {metrics.fps} FPS
        </span>
      </div>

      <div className="space-y-1 mb-3">
        <div className="text-[9px] font-bold text-sky-400 uppercase tracking-wider mb-1">Renderer Timing</div>
        <MetricRow label="Timeline" value={metrics.timelineRenderMs} unit="ms" alertThreshold={8} />
        <MetricRow label="Piano Roll" value={metrics.pianoRollRenderMs} unit="ms" alertThreshold={8} />
        <MetricRow label="Overlays" value={metrics.overlayRenderMs} unit="ms" />
        <MetricRow label="Total Frame" value={metrics.timelineRenderMs + metrics.pianoRollRenderMs + metrics.overlayRenderMs} unit="ms" alertThreshold={16.6} />
      </div>

      <div className="space-y-1 mb-3">
        <div className="text-[9px] font-bold text-purple-400 uppercase tracking-wider mb-1">Stability & Drift</div>
        <MetricRow label="ΔT Variance" value={metrics.deltaTimeVariance} unit="ms²" alertThreshold={2} />
        <MetricRow label="Dropped Frames" value={metrics.droppedFrames} alertThreshold={0} />
        <MetricRow label="Long Tasks" value={metrics.longTasks} alertThreshold={0} />
        <MetricRow label="RAF Latency" value={metrics.rafLatency} unit="ms" alertThreshold={17} />
        <MetricRow label="Audio Drift" value={metrics.audioContextDriftMs} unit="ms" alertThreshold={5} />
      </div>

      <div className="space-y-1">
        <div className="text-[9px] font-bold text-yellow-400 uppercase tracking-wider mb-1">Viewport & Memory</div>
        <MetricRow label="Transactions" value={metrics.viewportTransactionCount} />
        <MetricRow label="Dirty Rects" value={metrics.dirtyRegionCount} />
        <MetricRow label="Overlays Active" value={metrics.overlayCount} />
        <MetricRow label="Memory" value={metrics.estimatedMemoryMB} unit="MB" alertThreshold={500} />
      </div>
    </div>
  );
}
