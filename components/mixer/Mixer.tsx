'use client';

/**
 * Mixer Component - Main mixing console interface
 * 
 * Features:
 * - Multiple channel strips
 * - Master bus section
 * - Bus send/return management
 * - Real-time metering across all channels
 * - Responsive horizontal scroll layout
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { ChannelStrip, ChannelStripProps } from './ChannelStrip';
import { Meter } from './Meter';

// =============================================================================
// Types
// =============================================================================

export interface MixerChannelState {
  id: string;
  name: string;
  color?: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  meterData: {
    peak: number;
    rms: number;
    peakHold: number;
    clipCount: number;
  };
  sends: SendConfig[];
}

export interface SendConfig {
  id: string;
  busName: string;
  level: number;
  preFader: boolean;
  active: boolean;
}

export interface BusState {
  id: string;
  name: string;
  color: string;
  volume: number;
  mute: boolean;
  inputCount: number;
  meterData: {
    peak: number;
    rms: number;
    peakHold: number;
    clipCount: number;
  };
}

export interface MixerProps {
  channels: MixerChannelState[];
  buses: BusState[];
  master: BusState;
  onChannelVolumeChange: (channelId: string, volume: number) => void;
  onChannelPanChange: (channelId: string, pan: number) => void;
  onChannelMuteToggle: (channelId: string) => void;
  onChannelSoloToggle: (channelId: string) => void;
  onSendLevelChange: (channelId: string, sendId: string, level: number) => void;
  onBusVolumeChange: (busId: string, volume: number) => void;
  onBusMuteToggle: (busId: string) => void;
  onMasterVolumeChange: (volume: number) => void;
  onMasterMuteToggle: () => void;
  className?: string;
}

// =============================================================================
// Master Section Component
// =============================================================================

interface MasterSectionProps {
  master: BusState;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
}

const MasterSection: React.FC<MasterSectionProps> = memo(({
  master,
  onVolumeChange,
  onMuteToggle,
}) => {
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const db = parseFloat(e.target.value);
    onVolumeChange(db);
  }, [onVolumeChange]);
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '80px',
        padding: '12px 8px',
        background: 'linear-gradient(135deg, #1a1a2e, #0f0f23)',
        borderRadius: '4px',
        border: '2px solid #ffd700',
        gap: '8px',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#ffd700',
          textAlign: 'center',
        }}
      >
        MASTER
      </div>
      
      <Meter
        peak={master.meterData.peak}
        rms={master.meterData.rms}
        peakHold={master.meterData.peakHold}
        clipCount={master.meterData.clipCount}
        width={16}
        height={140}
        showScale={false}
      />
      
      <input
        type="range"
        min="-60"
        max="12"
        step="0.1"
        value={master.volume}
        onChange={handleVolumeChange}
        style={{
          width: '60px',
          height: '4px',
          writingMode: 'bt-lr' as any,
          WebkitAppearance: 'slider-vertical',
        }}
      />
      
      <div
        style={{
          fontSize: '11px',
          color: master.volume > 0 ? '#ffd700' : '#fff',
          fontFamily: 'monospace',
        }}
      >
        {master.volume <= -60 ? '-∞' : `${master.volume.toFixed(1)} dB`}
      </div>
      
      <button
        onClick={onMuteToggle}
        style={{
          width: '40px',
          height: '24px',
          fontSize: '10px',
          background: master.mute ? '#e94560' : '#2a2a4e',
          color: '#fff',
          border: 'none',
          borderRadius: '2px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        {master.mute ? 'UNMUTE' : 'MUTE'}
      </button>
      
      <div
        style={{
          fontSize: '9px',
          color: '#666',
          textAlign: 'center',
        }}
      >
        {master.inputCount} input{master.inputCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
});

MasterSection.displayName = 'MasterSection';

// =============================================================================
// Bus Section Component
// =============================================================================

interface BusSectionProps {
  buses: BusState[];
  onVolumeChange: (busId: string, volume: number) => void;
  onMuteToggle: (busId: string) => void;
}

const BusSection: React.FC<BusSectionProps> = memo(({
  buses,
  onVolumeChange,
  onMuteToggle,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        padding: '8px',
        background: '#0a0a1a',
        borderRadius: '4px',
      }}
    >
      {buses.map((bus) => (
        <div
          key={bus.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '50px',
            padding: '8px 4px',
            background: '#1a1a2e',
            borderRadius: '4px',
            borderTop: `3px solid ${bus.color}`,
            gap: '6px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: bus.color,
              textAlign: 'center',
            }}
          >
            {bus.name}
          </div>
          
          <Meter
            peak={bus.meterData.peak}
            rms={bus.meterData.rms}
            peakHold={bus.meterData.peakHold}
            clipCount={bus.meterData.clipCount}
            width={10}
            height={80}
            showScale={false}
          />
          
          <input
            type="range"
            min="-60"
            max="12"
            step="0.1"
            value={bus.volume}
            onChange={(e) => onVolumeChange(bus.id, parseFloat(e.target.value))}
            style={{
              width: '40px',
              height: '4px',
              writingMode: 'bt-lr' as any,
            }}
          />
          
          <button
            onClick={() => onMuteToggle(bus.id)}
            style={{
              width: '36px',
              height: '18px',
              fontSize: '8px',
              background: bus.mute ? '#e94560' : '#2a2a4e',
              color: '#fff',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
            }}
          >
            {bus.mute ? 'M' : 'ON'}
          </button>
        </div>
      ))}
    </div>
  );
});

BusSection.displayName = 'BusSection';

// =============================================================================
// Main Mixer Component
// =============================================================================

export const Mixer: React.FC<MixerProps> = memo(({
  channels,
  buses,
  master,
  onChannelVolumeChange,
  onChannelPanChange,
  onChannelMuteToggle,
  onChannelSoloToggle,
  onSendLevelChange,
  onBusVolumeChange,
  onBusMuteToggle,
  onMasterVolumeChange,
  onMasterMuteToggle,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Handle channel strip callbacks
  const handleChannelVolume = useCallback((channelId: string, volume: number) => {
    onChannelVolumeChange(channelId, volume);
  }, [onChannelVolumeChange]);
  
  const handleChannelPan = useCallback((channelId: string, pan: number) => {
    onChannelPanChange(channelId, pan);
  }, [onChannelPanChange]);
  
  const handleChannelMute = useCallback((channelId: string) => {
    onChannelMuteToggle(channelId);
  }, [onChannelMuteToggle]);
  
  const handleChannelSolo = useCallback((channelId: string) => {
    onChannelSoloToggle(channelId);
  }, [onChannelSoloToggle]);
  
  const handleSendChange = useCallback((channelId: string, sendId: string, level: number) => {
    onSendLevelChange(channelId, sendId, level);
  }, [onSendLevelChange]);
  
  return (
    <div
      className={`mixer ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#050510',
        borderRadius: '8px',
        padding: '12px',
        gap: '12px',
        minHeight: '400px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 8px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#fff',
          }}
        >
          Mixer
        </h2>
        
        <div
          style={{
            fontSize: '12px',
            color: '#666',
          }}
        >
          {channels.length} channels • {buses.length} buses
        </div>
      </div>
      
      {/* Bus Section */}
      {buses.length > 0 && (
        <BusSection
          buses={buses}
          onVolumeChange={onBusVolumeChange}
          onMuteToggle={onBusMuteToggle}
        />
      )}
      
      {/* Main Mixer Area */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          padding: '8px 0',
          scrollbarWidth: 'thin',
          scrollbarColor: '#333 #1a1a2e',
        }}
      >
        {/* Channel Strips */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: '4px',
            flex: 1,
          }}
        >
          {channels.map((channel) => (
            <ChannelStrip
              key={channel.id}
              channelId={channel.id}
              name={channel.name}
              color={channel.color}
              volume={channel.volume}
              pan={channel.pan}
              meterData={channel.meterData}
              sends={channel.sends}
              isMuted={channel.mute}
              isSolo={channel.solo}
              onVolumeChange={handleChannelVolume}
              onPanChange={handleChannelPan}
              onMuteToggle={handleChannelMute}
              onSoloToggle={handleChannelSolo}
              onSendChange={handleSendChange}
            />
          ))}
        </div>
        
        {/* Master Section */}
        <MasterSection
          master={master}
          onVolumeChange={onMasterVolumeChange}
          onMuteToggle={onMasterMuteToggle}
        />
      </div>
    </div>
  );
});

Mixer.displayName = 'Mixer';

export default Mixer;
