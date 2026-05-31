'use client';

import React, { useState } from 'react';

export function WasmCompressorUI() {
  const [threshold, setThreshold] = useState(-20);
  const [ratio, setRatio] = useState(4);
  const [attack, setAttack] = useState(10);
  const [release, setRelease] = useState(100);

  return (
    <div className="bg-[#222] p-4 rounded border border-gray-700 shadow-xl select-none w-80 text-white flex flex-col">
      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
        <h3 className="text-xs font-black tracking-widest text-gray-400">MAGIC COMPRESSOR</h3>
        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Threshold */}
        <div className="flex flex-col items-center bg-gray-900 p-2 rounded border border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Threshold</span>
          <span className="font-mono text-amber-500 text-lg">{threshold.toFixed(1)}</span>
          <span className="text-[10px] text-gray-600 mt-1">dB</span>
        </div>

        {/* Ratio */}
        <div className="flex flex-col items-center bg-gray-900 p-2 rounded border border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Ratio</span>
          <span className="font-mono text-amber-500 text-lg">{ratio.toFixed(1)}:1</span>
        </div>

        {/* Attack */}
        <div className="flex flex-col items-center bg-gray-900 p-2 rounded border border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Attack</span>
          <span className="font-mono text-amber-500 text-lg">{attack.toFixed(0)}</span>
          <span className="text-[10px] text-gray-600 mt-1">ms</span>
        </div>

        {/* Release */}
        <div className="flex flex-col items-center bg-gray-900 p-2 rounded border border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Release</span>
          <span className="font-mono text-amber-500 text-lg">{release.toFixed(0)}</span>
          <span className="text-[10px] text-gray-600 mt-1">ms</span>
        </div>
      </div>
    </div>
  );
}
