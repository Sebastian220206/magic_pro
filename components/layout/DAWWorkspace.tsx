'use client';

import React, { useState } from 'react';
import { TopTransport } from './TopTransport';
import { TimelineCanvas } from '../TimelineCanvas';
import PianoRoll from '../PianoRoll';
import { AutomationRuntimeOverlay } from '../debug/AutomationRuntimeOverlay';
import { NavigationDebugOverlay } from '../NavigationDebugOverlay';
import { AIAssistant } from '../AIAssistant';
import { Sparkles } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';

export function DAWWorkspace() {
  // Global view state (whether the piano roll is open)
  const showPianoRoll = true; // Hardcoded for structural view
  const [showAI, setShowAI] = useState(false);

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black tracking-widest text-gray-500">INSPECTOR</h2>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`p-1 rounded transition-colors ${showAI ? 'text-purple-400 bg-purple-500/10' : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]'}`}
              title="Toggle AI Assistant"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 bg-gray-800/50 rounded border border-gray-700/50 flex items-center justify-center text-xs text-gray-600">
            Select a track to view properties
          </div>
        </aside>

        {/* 3. Main Editor Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#111111]">
          
          {/* Top Half: Timeline Viewport */}
          <div className="flex-1 relative border-b border-gray-800 shadow-inner">
             <TimelineCanvas />
          </div>

          {/* Bottom Half: Piano Roll Viewport */}
          {showPianoRoll && (
            <div className="h-96 relative shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-10">
               <PianoRoll />
            </div>
          )}

        </main>

        {/* 4. Right Sidebar: AI Assistant */}
        {showAI && (
          <aside className="w-72 bg-[#1a1a1a] border-l border-black/40 flex flex-col shrink-0 overflow-y-auto custom-scrollbar-v z-20">
            <AIAssistant />
          </aside>
        )}

      </div>
    </div>
  );
}
