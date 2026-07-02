'use client';

import React from 'react';
import type { PluginUIContract } from '@/engine/plugins/manifest';

export function WasmEQUI({ params, onParamChange }: PluginUIContract) {
  const freq = params.freq ?? 1000;
  const q = params.q ?? 1;
  const gain = params.gain ?? 0;

  return (
    <div className="bg-[#222] p-4 rounded border border-gray-700 shadow-xl select-none w-80 text-white">
      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
        <h3 className="text-xs font-black tracking-widest text-gray-400">MAGIC EQ</h3>
        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Gain</span>
            <span className="font-mono text-amber-500">{gain.toFixed(1)} dB</span>
          </div>
          <input type="range" min="-24" max="24" step="0.1" value={gain}
            onChange={(e) => onParamChange('gain', parseFloat(e.target.value))}
            className="w-full accent-amber-500 bg-gray-900 appearance-none h-2 rounded cursor-pointer" />
        </div>

        <div className="flex flex-col">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Frequency</span>
            <span className="font-mono text-amber-500">{freq.toFixed(0)} Hz</span>
          </div>
          <input type="range" min="20" max="20000" step="1" value={freq}
            onChange={(e) => onParamChange('freq', parseFloat(e.target.value))}
            className="w-full accent-amber-500 bg-gray-900 appearance-none h-2 rounded cursor-pointer" />
        </div>

        <div className="flex flex-col">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Q (Resonance)</span>
            <span className="font-mono text-amber-500">{q.toFixed(2)}</span>
          </div>
          <input type="range" min="0.1" max="10.0" step="0.1" value={q}
            onChange={(e) => onParamChange('q', parseFloat(e.target.value))}
            className="w-full accent-amber-500 bg-gray-900 appearance-none h-2 rounded cursor-pointer" />
        </div>
      </div>
    </div>
  );
}
