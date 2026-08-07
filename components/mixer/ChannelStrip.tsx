'use client';

/**
 * ChannelStrip Component - Professional Logic Pro style mixer channel strip UI
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Meter } from './Meter';
import { SendControls } from './SendControls';

// =============================================================================
// Types
// =============================================================================

export interface ChannelStripProps {
  channelId: string;
  name: string;
  color?: string;
  volume?: number;       // dB (-60 to +6)
  pan?: number;        // -1 (L) to +1 (R)
  meterData?: {
    peak: number;
    rms: number;
    peakHold: number;
    clipCount: number;
  };
  sends?: SendInfo[];
  isMuted?: boolean;
  isSolo?: boolean;
  onVolumeChange?: (channelId: string, db: number) => void;
  onPanChange?: (channelId: string, pan: number) => void;
  onMuteToggle?: (channelId: string) => void;
  onSoloToggle?: (channelId: string) => void;
  onSendChange?: (channelId: string, sendId: string, level: number) => void;
  className?: string;
}

export interface SendInfo {
  id: string;
  busName: string;
  level: number;
  preFader: boolean;
  active: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const MIN_VOLUME = -60;
const MAX_VOLUME = 6;
const DEFAULT_COLOR = '#4a5568';

// =============================================================================
// Utility Functions
// =============================================================================

function formatDb(db: number): string {
  if (db <= MIN_VOLUME) return '-∞';
  return db.toFixed(1);
}

function sliderToDb(value: number): number {
  const normalized = Math.max(0, Math.min(1, value));
  if (normalized === 0) return MIN_VOLUME;
  // Non-linear mapping for fader
  const db = (Math.pow(normalized, 2) * (MAX_VOLUME - MIN_VOLUME)) + MIN_VOLUME;
  return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, db));
}

function dbToSlider(db: number): number {
  if (db <= MIN_VOLUME) return 0;
  const normalized = Math.sqrt((db - MIN_VOLUME) / (MAX_VOLUME - MIN_VOLUME));
  return Math.max(0, Math.min(1, normalized));
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Logic-style Fader Component
 */
const LogicFader: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = memo(({ value, onChange }) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  
  const sliderValue = dbToSlider(value);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    e.preventDefault();
    
    const updateFromEvent = (clientY: number) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const percent = 1 - (clientY - rect.top) / rect.height;
      onChange(sliderToDb(percent));
    };
    
    updateFromEvent(e.clientY);
    
    const handleMouseMove = (e: MouseEvent) => {
      updateFromEvent(e.clientY);
    };
    
    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onChange]);
  
  return (
    <div
      ref={sliderRef}
      onMouseDown={handleMouseDown}
      className="relative cursor-pointer flex justify-center w-6"
      style={{ height: '220px' }}
    >
      {/* Fader Track Slot */}
      <div 
        className="absolute top-0 bottom-0 w-[4px] bg-[#111] rounded-[1px] shadow-inner" 
        style={{ left: '50%', transform: 'translateX(-50%)' }} 
      />
      
      {/* Fader Handle */}
      <div
        className="absolute w-[24px] h-[34px] rounded-[3px] shadow-[0_4px_6px_rgba(0,0,0,0.8)] border border-[#222]"
        style={{
          left: '50%',
          top: `${(1 - sliderValue) * 100}%`,
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(to right, #999 0%, #e0e0e0 20%, #888 50%, #e0e0e0 80%, #999 100%)',
          zIndex: 10,
        }}
      >
        <div className="absolute top-1/2 left-1/2 w-[85%] h-[2px] bg-white -translate-x-1/2 -translate-y-1/2 shadow-sm rounded-sm opacity-90" />
      </div>
    </div>
  );
});
LogicFader.displayName = 'LogicFader';

/**
 * Logic-style Pan Knob Component
 */
const LogicPanKnob: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = memo(({ value, onChange }) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  
  // -1 to +1 -> -135deg to +135deg
  const angle = value * 135; 
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    e.preventDefault();
    
    const startY = e.clientY;
    const startValue = value;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = (startY - e.clientY) / 100;
      onChange(Math.max(-1, Math.min(1, startValue + delta)));
    };
    
    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [value, onChange]);
  
  return (
    <div className="flex flex-col items-center">
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        className="relative w-7 h-7 rounded-full bg-[#3a3a3a] border border-[#111] cursor-pointer shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),_0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center"
      >
        {/* Knob face gradient */}
        <div className="absolute inset-[2px] rounded-full bg-gradient-to-b from-[#555] to-[#333]" />
        {/* Indicator */}
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="absolute top-[3px] left-1/2 w-[2px] h-[8px] bg-[#a8e6cf] -translate-x-1/2 rounded-full shadow-[0_0_3px_#a8e6cf]" />
        </div>
      </div>
    </div>
  );
});
LogicPanKnob.displayName = 'LogicPanKnob';

/**
 * Empty dark slot
 */
const Slot = ({ children, className = "", active = false }: { children?: React.ReactNode, className?: string, active?: boolean }) => (
  <div className={`w-[60px] min-h-[18px] rounded-[2px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] flex items-center justify-center text-[10px] border border-[#222] my-[2px] cursor-pointer
    ${active ? 'bg-[#2a72d4] text-white shadow-none border-[#1e5eb3]' : 'bg-[#3a3a3a] text-[#aaa] hover:bg-[#444]'} 
    ${className}`}>
    {children}
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

export const ChannelStrip: React.FC<ChannelStripProps> = memo(({
  channelId,
  name,
  color = DEFAULT_COLOR,
  volume = 0,
  pan = 0,
  meterData = { peak: -Infinity, rms: -Infinity, peakHold: -Infinity, clipCount: 0 },
  sends = [],
  isMuted = false,
  isSolo = false,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onSendChange,
  className = '',
}) => {
  const handleVolumeChange = useCallback((db: number) => {
    onVolumeChange?.(channelId, db);
  }, [channelId, onVolumeChange]);
  
  const handlePanChange = useCallback((newPan: number) => {
    onPanChange?.(channelId, newPan);
  }, [channelId, onPanChange]);
  
  const handleMuteToggle = useCallback(() => {
    onMuteToggle?.(channelId);
  }, [channelId, onMuteToggle]);
  
  const handleSoloToggle = useCallback(() => {
    onSoloToggle?.(channelId);
  }, [channelId, onSoloToggle]);

  return (
    <div
      className={`flex flex-col items-center bg-[#4a4a4a] border-r border-[#222] pb-2 select-none ${className}`}
      style={{ width: '74px' }}
    >
      {/* Top spacer */}
      <div className="h-4 w-full" />

      {/* Setting */}
      <Slot className="mt-1 h-[18px]">Setting</Slot>

      {/* GR Meter */}
      <div className="w-[60px] h-[6px] bg-[#222] border border-[#111] rounded-[1px] mt-2 mb-2 shadow-inner overflow-hidden">
        {/* Placeholder for actual GR logic */}
      </div>

      {/* EQ */}
      <Slot className="h-[36px]" />

      {/* MIDI FX */}
      <Slot className="mt-4" />

      {/* Input */}
      <div className="w-[60px] h-[18px] bg-[#454545] border border-[#2a2a2a] rounded-[2px] mt-4 flex items-center px-1 cursor-pointer hover:bg-[#555]">
        <div className="w-[8px] h-[8px] rounded-full border border-[#aaa] mr-1.5 flex-shrink-0" />
        <span className="text-[10px] text-[#ddd]">In 1</span>
      </div>

      {/* Audio FX */}
      <div className="mt-4 flex flex-col gap-[1px]">
        <Slot active>Comp</Slot>
        <Slot />
        <Slot />
      </div>

      {/* Sends */}
      <div className="mt-4 flex flex-col gap-[1px]">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-1 w-[60px]">
            <div className="w-[44px] h-[16px] bg-[#3a3a3a] border border-[#222] rounded-[2px] shadow-inner" />
            <div className="w-[12px] h-[12px] rounded-full bg-[#3a3a3a] border border-[#222] shadow-inner" />
          </div>
        ))}
      </div>

      {/* Output */}
      <div className="w-[60px] h-[18px] bg-[#666] border border-[#444] rounded-[2px] mt-4 flex items-center justify-center cursor-pointer hover:bg-[#777]">
        <span className="text-[10px] text-[#eee]">St Out</span>
      </div>

      {/* Automation */}
      <div className="w-[60px] h-[18px] bg-[#4a4a4a] border border-[#333] rounded-[2px] mt-1 flex items-center justify-center cursor-pointer hover:bg-[#555]">
        <span className="text-[10px] text-[#4ade80]">Read</span>
      </div>

      {/* Group */}
      <div className="w-[24px] h-[20px] bg-[#2a72d4] border border-[#1e5eb3] rounded-[3px] mt-4 flex items-center justify-center shadow-sm cursor-pointer">
        {/* Soundwave icon simplified */}
        <div className="flex gap-[1px] items-center h-[10px]">
          <div className="w-[2px] h-[4px] bg-white opacity-80" />
          <div className="w-[2px] h-[8px] bg-white" />
          <div className="w-[2px] h-[10px] bg-white" />
          <div className="w-[2px] h-[6px] bg-white opacity-90" />
        </div>
      </div>

      {/* Pan Knob */}
      <div className="mt-4">
        <LogicPanKnob value={pan} onChange={handlePanChange} />
      </div>

      {/* dB Readout */}
      <div className="w-[40px] h-[16px] bg-[#222] border border-[#111] rounded-[2px] mt-3 flex items-center justify-center">
        <span className="text-[10px] text-white font-mono">{formatDb(volume)}</span>
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-[2px] mt-2">
        <div
          onClick={handleMuteToggle}
          className={`w-[26px] h-[18px] flex items-center justify-center rounded-[2px] text-[10px] font-bold cursor-pointer border ${
            isMuted 
              ? 'bg-[#2a72d4] text-white border-[#1e5eb3] shadow-[0_0_4px_rgba(42,114,212,0.6)]' 
              : 'bg-[#444] text-[#888] border-[#222] hover:bg-[#555]'
          }`}
        >
          M
        </div>
        <div
          onClick={handleSoloToggle}
          className={`w-[26px] h-[18px] flex items-center justify-center rounded-[2px] text-[10px] font-bold cursor-pointer border ${
            isSolo 
              ? 'bg-[#fbbf24] text-[#000] border-[#d97706] shadow-[0_0_4px_rgba(251,191,36,0.6)]' 
              : 'bg-[#444] text-[#888] border-[#222] hover:bg-[#555]'
          }`}
        >
          S
        </div>
      </div>

      {/* Fader & Meter Container */}
      <div className="relative flex justify-center mt-3 h-[220px] w-full">
        {/* Tick marks left */}
        <div className="absolute left-[4px] top-[10px] bottom-[10px] flex flex-col justify-between items-end w-[10px] text-[8px] text-[#aaa]">
          <span>6</span>
          <span>3</span>
          <span>0</span>
          <span>-3</span>
          <span>-6</span>
          <span>-10</span>
          <span>-15</span>
          <span>-20</span>
          <span>-30</span>
          <span>-40</span>
        </div>

        {/* Fader */}
        <div className="absolute left-[20px]">
          <LogicFader value={volume} onChange={handleVolumeChange} />
        </div>

        {/* Meter */}
        <div className="absolute right-[8px] top-[5px]">
          <Meter
            peak={meterData.peak}
            rms={meterData.rms}
            peakHold={meterData.peakHold}
            clipCount={meterData.clipCount}
            width={10}
            height={210}
            showScale={false}
          />
        </div>
      </div>

      {/* Track Name */}
      <div className="mt-4 text-[10px] text-white font-medium truncate w-full px-2 text-center pb-2">
        {name}
      </div>
    </div>
  );
});

ChannelStrip.displayName = 'ChannelStrip';

export default ChannelStrip;
