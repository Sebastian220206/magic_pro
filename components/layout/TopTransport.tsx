'use client';

import React, { useState } from 'react';
import { EngineBootstrap } from '../../engine/bootstrap/EngineBootstrap';
import { useProjectStore } from '../../store/projectStore';

export function TopTransport() {
  const isPlaying = useProjectStore(state => state.playing);
  const rawBeat = useProjectStore(state => state.playhead);
  const [isBooted, setIsBooted] = useState(false);

  // Simple musical format (Bars.Beats.Subbeats) assuming 4/4
  const bars = Math.floor(rawBeat / 4) + 1;
  const beats = Math.floor(rawBeat % 4) + 1;
  const sub = Math.floor((rawBeat % 1) * 4) + 1;
  const beatStr = `${bars}.${beats}.${sub}`;

  const handlePlay = async () => {
    if (!isBooted) {
      await EngineBootstrap.boot();
      setIsBooted(true);
    }
    
    if (isPlaying) {
      useProjectStore.getState().stop();
    } else {
      useProjectStore.getState().play();
    }
  };

  const handleStop = () => {
    useProjectStore.getState().stop();
  };

  return (
    <div className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-between select-none">
      <div className="flex gap-2">
        <button onClick={handleStop} className="p-2 bg-gray-800 hover:bg-gray-700 rounded shadow-md text-white">
          ⏹
        </button>
        <button onClick={handlePlay} className={`p-2 rounded shadow-md text-white font-bold w-12 ${isPlaying ? 'bg-amber-600' : 'bg-emerald-600'}`}>
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      <div className="bg-black border border-gray-800 px-6 py-1 rounded font-mono text-amber-500 text-xl tracking-widest shadow-inner">
        {beatStr}
      </div>

      <div className="flex gap-4 text-xs text-gray-400 font-medium">
        <div className="flex flex-col items-center">
          <span>TEMPO</span>
          <span className="text-white text-sm">120.0</span>
        </div>
        <div className="flex flex-col items-center">
          <span>SIGNATURE</span>
          <span className="text-white text-sm">4/4</span>
        </div>
      </div>
    </div>
  );
}
