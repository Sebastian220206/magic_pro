"use client"

/**
 * React Hook for Instrument Management
 * Integrates instrument system with React components and Zustand store
 */

import { useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { getInstrumentService } from '@/engine/instruments/instrumentService';
import { audioContextManager } from '@/engine/audioEngine/audioContext';

export function useInstruments() {
  const { tracks, updateTrack } = useProjectStore();
  const initialized = useRef(false);

  // Initialize instrument service on mount
  useEffect(() => {
    if (initialized.current) return;

    const init = async () => {
      // Ensure audio context is initialized
      const ctx = audioContextManager.getContext();
      if (!ctx) {
        await audioContextManager.initialize();
      }

      // Initialize instrument service
      const service = getInstrumentService();
      await service.initialize();

      // Assign instruments to tracks that have them configured
      tracks.forEach((track) => {
        if (track.instrument && !service.hasInstrument(track.id)) {
          const success = service.assignInstrument(track.id, track.instrument);
          if (success) {
            updateTrack(track.id, { instrumentLoaded: true });
          }
        }
      });

      initialized.current = true;
    };

    init();

    // Cleanup on unmount
    return () => {
      const service = getInstrumentService();
      service.dispose();
      initialized.current = false;
    };
  }, []); // Run once on mount

  // Assign instrument to track
  const assignInstrument = useCallback((trackId: string, instrumentName: string): boolean => {
    const service = getInstrumentService();
    const success = service.assignInstrument(trackId, instrumentName);

    if (success) {
      updateTrack(trackId, {
        instrument: instrumentName,
        instrumentLoaded: true,
      });
    }

    return success;
  }, [updateTrack]);

  // Remove instrument from track
  const removeInstrument = useCallback((trackId: string): void => {
    const service = getInstrumentService();
    service.removeInstrument(trackId);

    updateTrack(trackId, {
      instrument: undefined,
      instrumentLoaded: false,
    });
  }, [updateTrack]);

  // Play a test note (for previewing instruments)
  const playTestNote = useCallback((trackId: string, note: number = 60, velocity: number = 100): void => {
    const service = getInstrumentService();
    const ctx = audioContextManager.getContext();

    if (ctx) {
      service.noteOn(trackId, note, velocity, ctx.currentTime);

      // Auto-release after 500ms
      setTimeout(() => {
        service.noteOff(trackId, note, ctx.currentTime);
      }, 500);
    }
  }, []);

  // Handle note on from MIDI input
  const handleNoteOn = useCallback((trackId: string, note: number, velocity: number, time?: number): void => {
    const service = getInstrumentService();
    service.noteOn(trackId, note, velocity, time);
  }, []);

  // Handle note off from MIDI input
  const handleNoteOff = useCallback((trackId: string, note: number, time?: number): void => {
    const service = getInstrumentService();
    service.noteOff(trackId, note, time);
  }, []);

  // Get instrument name for track
  const getInstrumentName = useCallback((trackId: string): string | undefined => {
    const service = getInstrumentService();
    return service.getInstrumentName(trackId);
  }, []);

  // Check if track has instrument
  const hasInstrument = useCallback((trackId: string): boolean => {
    const service = getInstrumentService();
    return service.hasInstrument(trackId);
  }, []);

  return {
    assignInstrument,
    removeInstrument,
    playTestNote,
    handleNoteOn,
    handleNoteOff,
    getInstrumentName,
    hasInstrument,
  };
}

export default useInstruments;
