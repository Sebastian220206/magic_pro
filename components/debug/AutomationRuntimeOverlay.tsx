"use client";

import React, { useEffect, useState } from 'react';
import { globalProfiler } from '@/engine/rendering/profiler/FrameProfiler';
import { RenderMetrics, createEmptyMetrics } from '@/engine/rendering/profiler/RenderMetrics';

export function AutomationRuntimeOverlay() {
  const [metrics, setMetrics] = useState<RenderMetrics>(createEmptyMetrics());

  useEffect(() => {
    let lastUpdate = 0;
    const unsubscribe = globalProfiler.subscribe((latestMetrics) => {
      const now = performance.now();
      if (now - lastUpdate > 100) {
        setMetrics(latestMetrics);
        lastUpdate = now;
      }
    });

    return unsubscribe;
  }, []);

  return (
    <div className="fixed top-64 right-4 z-[9999] w-64 bg-black/80 backdrop-blur-md border border-amber-500/30 rounded-md shadow-2xl p-3 select-none pointer-events-none">
      <div className="flex justify-between items-center mb-2 pb-1 border-b border-amber-500/20">
        <span className="text-[11px] font-black tracking-widest text-amber-500 uppercase">Automation DSP Engine</span>
      </div>

      <div className="space-y-1 mb-3">
        <div className="flex justify-between items-center text-[10px] border-b border-white/10 py-0.5">
          <span className="text-gray-400">Points Rendered</span>
          <span className="font-mono font-bold text-amber-400">{metrics.automationPointsRendered}</span>
        </div>
        <div className="flex justify-between items-center text-[10px] border-b border-white/10 py-0.5">
          <span className="text-gray-400">Curves Interpolated</span>
          <span className="font-mono font-bold text-amber-400">{metrics.automationCurvesRendered}</span>
        </div>
        <div className="flex justify-between items-center text-[10px] border-b border-white/10 py-0.5">
          <span className="text-gray-400">Dirty Regions</span>
          <span className="font-mono font-bold text-amber-400">{metrics.automationDirtyRegions}</span>
        </div>
        <div className="flex justify-between items-center text-[10px] border-b border-white/10 py-0.5">
          <span className="text-gray-400">Math Latency</span>
          <span className="font-mono font-bold text-amber-400">{metrics.interpolationTimeMs.toFixed(2)}ms</span>
        </div>
      </div>
    </div>
  );
}
