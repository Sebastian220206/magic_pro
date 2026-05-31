'use client';

/**
 * ChannelStrip Component - Professional mixer channel strip UI
 * 
 * Features:
 * - Volume fader with dB readout
 * - Pan knob/slider
 * - Real-time meter display
 * - Mute/Solo buttons
 * - Send level controls
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
  volume?: number;       // dB (-60 to +12)
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
const MAX_VOLUME = 12;
const DEFAULT_COLOR = '#4a5568';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format dB value for display
 */
function formatDb(db: number): string {
  if (db <= MIN_VOLUME) return '-∞';
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

/**
 * Convert slider value (0-1) to dB
 */
function sliderToDb(value: number): number {
  // Logarithmic curve for better control
  const normalized = Math.max(0, Math.min(1, value));
  
  if (normalized === 0) return MIN_VOLUME;
  
  // Use exponential curve for natural volume feel
  // 0.7 maps to unity gain (0 dB)
  const db = Math.log10(normalized / 0.7) * 20;
  
  return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, db));
}

/**
 * Convert dB to slider value
 */
function dbToSlider(db: number): number {
  if (db <= MIN_VOLUME) return 0;
  
  // Inverse of sliderToDb
  const normalized = Math.pow(10, db / 20) * 0.7;
  return Math.max(0, Math.min(1, normalized));
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Fader Component - Vertical volume slider
 */
const Fader: React.FC<{
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
      const db = sliderToDb(Math.max(0, Math.min(1, percent)));
      onChange(db);
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
      style={{
        width: '30px',
        height: '160px',
        background: 'linear-gradient(to top, #1a1a2e, #16213e)',
        borderRadius: '4px',
        position: 'relative',
        cursor: 'pointer',
        border: '1px solid #333',
      }}
    >
      {/* Unity gain marker */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${(1 - dbToSlider(0)) * 100}%`,
          height: '2px',
          background: '#666',
          zIndex: 1,
        }}
      />
      
      {/* Fader handle */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: `${(1 - sliderValue) * 100}%`,
          transform: 'translate(-50%, -50%)',
          width: '24px',
          height: '12px',
          background: '#e94560',
          borderRadius: '2px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          zIndex: 2,
        }}
      />
      
      {/* Tick marks */}
      {[-60, -36, -18, -12, -6, 0, 6].map((db) => (
        <div
          key={db}
          style={{
            position: 'absolute',
            left: '2px',
            right: '2px',
            top: `${(1 - dbToSlider(db)) * 100}%`,
            height: '1px',
            background: '#333',
          }}
        />
      ))}
    </div>
  );
});

Fader.displayName = 'Fader';

/**
 * Pan Knob Component
 */
const PanKnob: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = memo(({ value, onChange }) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  
  const angle = value * 45; // -45 to +45 degrees
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    e.preventDefault();
    
    const startX = e.clientX;
    const startValue = value;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = (e.clientX - startX) / 100;
      const newValue = Math.max(-1, Math.min(1, startValue + delta));
      onChange(newValue);
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2a2a4e, #1a1a2e)',
          border: '2px solid #4a5568',
          cursor: 'pointer',
          position: 'relative',
          transform: `rotate(${angle}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: '50%',
            width: '2px',
            height: '8px',
            background: '#e94560',
            transform: 'translateX(-50%)',
            borderRadius: '1px',
          }}
        />
      </div>
      <span style={{ fontSize: '10px', color: '#888', minWidth: '30px', textAlign: 'center' }}>
        {value === 0 ? 'C' : value > 0 ? `${Math.round(value * 100)}R` : `${Math.round(Math.abs(value) * 100)}L`}
      </span>
    </div>
  );
});

PanKnob.displayName = 'PanKnob';

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
  
  const handleSendChange = useCallback((sendId: string, level: number) => {
    onSendChange?.(channelId, sendId, level);
  }, [channelId, onSendChange]);
  
  return (
    <div
      className={`channel-strip ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '60px',
        padding: '8px 4px',
        background: '#0f0f23',
        borderRadius: '4px',
        borderLeft: `3px solid ${color}`,
        gap: '8px',
      }}
    >
      {/* Channel Name */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#fff',
          textAlign: 'center',
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </div>
      
      {/* Mute/Solo Buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={handleMuteToggle}
          style={{
            width: '24px',
            height: '20px',
            fontSize: '9px',
            background: isMuted ? '#e94560' : '#2a2a4e',
            color: '#fff',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          M
        </button>
        <button
          onClick={handleSoloToggle}
          style={{
            width: '24px',
            height: '20px',
            fontSize: '9px',
            background: isSolo ? '#ffd700' : '#2a2a4e',
            color: isSolo ? '#000' : '#fff',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          S
        </button>
      </div>
      
      {/* Pan */}
      <PanKnob value={pan} onChange={handlePanChange} />
      
      {/* Meter */}
      <Meter
        peak={meterData.peak}
        rms={meterData.rms}
        peakHold={meterData.peakHold}
        clipCount={meterData.clipCount}
        width={12}
        height={120}
        showScale={false}
      />
      
      {/* Fader */}
      <Fader value={volume} onChange={handleVolumeChange} />
      
      {/* Volume Readout */}
      <div
        style={{
          fontSize: '10px',
          color: volume > 0 ? '#e94560' : '#fff',
          fontFamily: 'monospace',
          minWidth: '50px',
          textAlign: 'center',
        }}
      >
        {formatDb(volume)}
      </div>
      
      {/* Send Controls */}
      {sends.length > 0 && (
        <SendControls
          sends={sends}
          onSendChange={handleSendChange}
        />
      )}
    </div>
  );
});

ChannelStrip.displayName = 'ChannelStrip';

export default ChannelStrip;
