'use client';

import React from 'react';
import { TopTransport } from './TopTransport';
import { TimelineCanvas } from '../TimelineCanvas';
import PianoRoll from '../midi/PianoRoll';
import { AutomationRuntimeOverlay } from '../debug/AutomationRuntimeOverlay';
import { NavigationDebugOverlay } from '../NavigationDebugOverlay';
import { useProjectStore } from '../../store/projectStore';

export function DAWWorkspace() {
  // Global view state (whether the piano roll is open)
  const showPianoRoll = true; // Hardcoded for structural view

  return (
    <div className="flex flex-col h-screen w-full bg-black overflow-hidden text-white font-sans">
      
      {/* Absolute Overlays */}
      <AutomationRuntimeOverlay />
      <NavigationDebugOverlay />

      {/* 1. Global Transport Bar */}
      <TopTransport />

      <div className="flex flex-1 overflow-hidden">
        
        {/* 2. Left Inspector Panel */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-4 shadow-xl z-20">
          <h2 className="text-xs font-black tracking-widest text-gray-500 mb-4">INSPECTOR</h2>
          {/* Plugin Chain UI would go here */}
          <div className="flex-1 bg-gray-800/50 rounded border border-gray-700/50 flex items-center justify-center text-xs text-gray-600">
            Select a track to view properties
          </div>
        </aside>

        {/* 3. Main Editor Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#111111]">
          
          {/* Top Half: Timeline Viewport */}
          <div className="flex-1 relative border-b border-gray-800 shadow-inner">
             {/* The React UI mounts the canvas, but the Spatial Engine takes over rendering */}
             <TimelineCanvas />
          </div>

          {/* Bottom Half: Piano Roll Viewport */}
          {showPianoRoll && (
            <div className="h-96 relative shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-10">
               {/* 
                 Notice that NO clipId or scroll position is passed as props!
                 The Piano Roll is fully driven by the ViewportChannels natively.
               */}
               <PianoRoll clipId="active_clip" />
            </div>
          )}

        </main>

      </div>
    </div>
  );
}
