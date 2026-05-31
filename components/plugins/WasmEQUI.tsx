'use client';

import React, { useState, useEffect, useRef } from 'react';
// import { EngineBootstrap } from '@/engine/bootstrap/EngineBootstrap'; // For direct parameter pushing
import { useProjectStore } from '@/store/projectStore';

interface WasmEQUIProps {
  trackId: string;
  pluginId: string;
  initialFreq?: number;
  initialQ?: number;
  initialGain?: number;
}

export function WasmEQUI({ trackId, pluginId, initialFreq = 1000, initialQ = 1.0, initialGain = 0 }: WasmEQUIProps) {
  const [freq, setFreq] = useState(initialFreq);
  const [q, setQ] = useState(initialQ);
  const [gain, setGain] = useState(initialGain);

  const handleGainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setGain(val);
    
    // 1. FAST PATH: Push directly to Worklet via MessagePort or SharedBuffer
    // e.g. EngineBootstrap.pushParameter(trackId, pluginId, 'gain', val);

    // 2. SLOW PATH: Persist to project state for saving
    // useProjectStore.getState().updatePluginParameter(trackId, pluginId, 'gain', val);
  };

  return (
    <div className="bg-[#222] p-4 rounded border border-gray-700 shadow-xl select-none w-80 text-white">
      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
        <h3 className="text-xs font-black tracking-widest text-gray-400">MAGIC EQ</h3>
        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
      </div>

      <div className="space-y-4">
        {/* Gain Slider */}
        <div className="flex flex-col">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Gain</span>
            <span className="font-mono text-amber-500">{gain.toFixed(1)} dB</span>
          </div>
          <input 
            type="range" 
            min="-24" max="24" step="0.1" 
            value={gain} 
            onChange={handleGainChange}
            className="w-full accent-amber-500 bg-gray-900 appearance-none h-2 rounded cursor-pointer"
          />
        </div>

        {/* Freq Slider */}
        <div className="flex flex-col">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Frequency</span>
            <span className="font-mono text-amber-500">{freq.toFixed(0)} Hz</span>
          </div>
          <input 
            type="range" 
            min="20" max="20000" step="1" 
            value={freq} 
            onChange={(e) => setFreq(parseFloat(e.target.value))}
            className="w-full accent-amber-500 bg-gray-900 appearance-none h-2 rounded cursor-pointer"
          />
        </div>

        {/* Q Slider */}
        <div className="flex flex-col">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Q (Resonance)</span>
            <span className="font-mono text-amber-500">{q.toFixed(2)}</span>
          </div>
          <input 
            type="range" 
            min="0.1" max="10.0" step="0.1" 
            value={q} 
            onChange={(e) => setQ(parseFloat(e.target.value))}
            className="w-full accent-amber-500 bg-gray-900 appearance-none h-2 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
