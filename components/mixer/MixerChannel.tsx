'use client';

/**
 * Mixer Channel - Complete channel strip UI
 * 
 * Features:
 * - Volume fader
 * - Pan knob
 * - Mute/Solo buttons
 * - Meter display
 * - Send knobs (A-D)
 * - Insert slots (8 slots)
 * - Track name input
 */

import React, { memo, useCallback } from 'react';
import { Volume2, VolumeX, Headphones, Mic, Power } from 'lucide-react';
import { MixerFader } from './MixerFader';
import { MixerMeter } from './MixerMeter';
import { ChannelStripState } from '../../engine/audioEngine/channelStrip';
import { MeterData } from '../../engine/audioEngine/audioMeter';

interface MixerChannelProps {
  channel: ChannelStripState;
  meterData: MeterData;
  onVolumeChange: (channelId: string, db: number) => void;
  onPanChange: (channelId: string, pan: number) => void;
  onMuteToggle: (channelId: string) => void;
  onSoloToggle: (channelId: string) => void;
  onSendChange: (channelId: string, sendId: string, db: number) => void;
  onNameChange: (channelId: string, name: string) => void;
  isSelected?: boolean;
  onSelect?: (channelId: string) => void;
  color?: string;
}

export const MixerChannel = memo(function MixerChannel({
  channel,
  meterData,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onSendChange,
  onNameChange,
  isSelected = false,
  onSelect,
  color = '#3B82F6',
}: MixerChannelProps) {
  const handleVolumeChange = useCallback((db: number) => {
    onVolumeChange(channel.id, db);
  }, [channel.id, onVolumeChange]);

  const handlePanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const pan = parseFloat(e.target.value);
    onPanChange(channel.id, pan);
  }, [channel.id, onPanChange]);

  const handleMuteToggle = useCallback(() => {
    onMuteToggle(channel.id);
  }, [channel.id, onMuteToggle]);

  const handleSoloToggle = useCallback(() => {
    onSoloToggle(channel.id);
  }, [channel.id, onSoloToggle]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onNameChange(channel.id, e.target.value);
  }, [channel.id, onNameChange]);

  const handleSelect = useCallback(() => {
    onSelect?.(channel.id);
  }, [channel.id, onSelect]);

  return (
    <div
      className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
        isSelected ? 'bg-gray-800 ring-2 ring-blue-500' : 'bg-gray-900 hover:bg-gray-800'
      }`}
      style={{ width: 80 }}
      onClick={handleSelect}
    >
      {/* Track Name */}
      <input
        type="text"
        value={channel.name}
        onChange={handleNameChange}
        className="w-full text-center text-xs bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 outline-none text-gray-300 mb-2"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Mute/Solo Buttons */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={handleMuteToggle}
          className={`p-1.5 rounded ${
            channel.mute ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
          title="Mute (M)"
        >
          {channel.mute ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
        </button>
        <button
          onClick={handleSoloToggle}
          className={`p-1.5 rounded ${
            channel.solo ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
          title="Solo (S)"
        >
          <Headphones className="w-3 h-3" />
        </button>
      </div>

      {/* Meter */}
      <MixerMeter
        data={meterData}
        width={12}
        height={120}
        showPeakHold
        showRMS
      />

      {/* Fader */}
      <MixerFader
        valueDb={channel.volumeDb}
        onChange={handleVolumeChange}
        width={50}
        height={140}
        color={color}
        showMeter={false}
      />

      {/* Pan Knob */}
      <div className="mt-2 w-full">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>L</span>
          <span>C</span>
          <span>R</span>
        </div>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={channel.pan}
          onChange={handlePanChange}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color}40 0%, ${color} ${(channel.pan + 1) * 50}%, ${color}40 100%)`,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Sends (A-D) */}
      <div className="mt-3 w-full space-y-1">
        {Array.from(channel.sends.entries()).slice(0, 4).map(([sendId, send]) => (
          <div key={sendId} className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500 w-4">{sendId.slice(-1)}</span>
            <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, (send.levelDb + 60) / 72 * 100))}%`,
                  backgroundColor: send.enabled ? color : '#4b5563',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Record Arm */}
      <button
        className={`mt-2 p-1 rounded ${
          channel.arm ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'
        }`}
        title="Record Arm"
      >
        <Mic className="w-3 h-3" />
      </button>
    </div>
  );
});

export default MixerChannel;
