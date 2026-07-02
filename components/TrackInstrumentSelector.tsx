"use client"

/**
 * Track Instrument Selector Component
 * UI for selecting and assigning instruments to MIDI tracks
 */

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { getAllInstrumentNames, getInstrumentsByCategory, hasInstrument } from '@/engine/instruments/instrumentRegistry';
import { soundLibraryCategories, getSoundInfo } from '@/engine/soundLibrary/instruments';
import { Music, ChevronDown, Layers, Piano, Drum, Zap } from 'lucide-react';

interface TrackInstrumentSelectorProps {
  trackId: string;
  compact?: boolean;
}

export function TrackInstrumentSelector({ trackId, compact = false }: TrackInstrumentSelectorProps) {
  const { tracks, updateTrack } = useProjectStore();
  const track = tracks.find((t) => t.id === trackId);
  const [isOpen, setIsOpen] = useState(false);

  if (!track) return null;

  const currentInstrument = track.instrument ?? 'No Instrument';
  const currentInfo = track.instrument ? getSoundInfo(track.instrument) : null;

  const handleSelect = (instrumentName: string) => {
    if (hasInstrument(instrumentName)) {
      updateTrack(trackId, {
        instrument: instrumentName,
        instrumentLoaded: false,
      });
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    updateTrack(trackId, {
      instrument: undefined,
      instrumentLoaded: false,
    });
    setIsOpen(false);
  };

  // Get icon based on engine type
  const getInstrumentIcon = (name: string) => {
    const info = getSoundInfo(name);
    switch (info?.engine) {
      case 'sampler':
        return <Piano className="w-4 h-4" />;
      case 'drumkit':
        return <Drum className="w-4 h-4" />;
      case 'synth':
        return <Zap className="w-4 h-4" />;
      case 'soundfont':
        return <Music className="w-4 h-4" />;
      default:
        return <Music className="w-4 h-4" />;
    }
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 bg-[#252525] hover:bg-[#333] rounded text-[11px] font-medium text-gray-300 transition-colors"
        >
          {currentInfo && (
            <span style={{ color: currentInfo.color }}>
              {getInstrumentIcon(currentInstrument)}
            </span>
          )}
          <span className="truncate max-w-[80px]">
            {currentInstrument}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute bottom-full left-0 mb-1 w-48 bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl z-50 py-1 max-h-64 overflow-y-auto">
              <div
                onClick={handleClear}
                className="px-3 py-2 text-[11px] text-gray-500 hover:bg-[#333] hover:text-white cursor-pointer flex items-center gap-2"
              >
                <span className="opacity-50">No Instrument</span>
              </div>
              {soundLibraryCategories.map((category) => (
                <div key={category.id}>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#1a1a1a]">
                    {category.name}
                  </div>
                  {category.instruments.map((instrument) => (
                    <div
                      key={instrument}
                      onClick={() => handleSelect(instrument)}
                      className={`px-3 py-2 text-[11px] hover:bg-[#333] cursor-pointer flex items-center gap-2 ${
                        currentInstrument === instrument ? 'bg-[#3a3a3a] text-white' : 'text-gray-300'
                      }`}
                    >
                      <span style={{ color: getSoundInfo(instrument)?.color }}>
                        {getInstrumentIcon(instrument)}
                      </span>
                      {instrument}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#1e1e1e] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-400" />
          <span className="text-[12px] font-bold text-gray-200">Instrument</span>
        </div>
        {track.instrument && (
          <button
            onClick={handleClear}
            className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {track.instrument ? (
        <div className="bg-[#252525] rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${currentInfo?.color}20`, color: currentInfo?.color }}
            >
              {getInstrumentIcon(track.instrument)}
            </div>
            <div>
              <div className="text-[13px] font-bold text-white">{track.instrument}</div>
              <div className="text-[11px] text-gray-500">{currentInfo?.description}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#333]">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Engine</span>
            <span className="text-[11px] font-medium text-sky-400">
              {currentInfo?.engine === 'synth' && 'Synthesizer'}
              {currentInfo?.engine === 'sampler' && 'Sampler'}
              {currentInfo?.engine === 'drumkit' && 'Drum Machine'}
              {currentInfo?.engine === 'soundfont' && 'SoundFont'}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500">
          <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="text-[12px]">No instrument assigned</div>
          <div className="text-[10px] mt-1">Select an instrument to hear sound</div>
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-[#252525] hover:bg-[#333] border border-[#333] rounded-lg text-[12px] text-gray-300 transition-all"
        >
          <span>{track.instrument ? 'Change Instrument' : 'Select Instrument'}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl z-50 py-1 max-h-72 overflow-y-auto">
              {soundLibraryCategories.map((category) => (
                <div key={category.id}>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#1a1a1a] sticky top-0">
                    {category.name}
                  </div>
                  {category.instruments.map((instrument) => (
                    <div
                      key={instrument}
                      onClick={() => handleSelect(instrument)}
                      className={`px-3 py-2.5 text-[12px] hover:bg-[#333] cursor-pointer flex items-center gap-2 ${
                        track.instrument === instrument ? 'bg-[#3a3a3a] text-white' : 'text-gray-300'
                      }`}
                    >
                      <span style={{ color: getSoundInfo(instrument)?.color }}>
                        {getInstrumentIcon(instrument)}
                      </span>
                      <span className="flex-1">{instrument}</span>
                      {track.instrument === instrument && (
                        <span className="text-[10px] text-sky-400 font-medium">Selected</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TrackInstrumentSelector;
