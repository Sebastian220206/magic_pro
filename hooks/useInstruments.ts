"use client"

/**
 * React Hook for Instrument Management
 * Integrates instrument system with React components and Zustand store
 */

import { useEffect, useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { getInstrumentService } from '@/engine/instruments/instrumentService';
import { audioContextManager } from '@/engine/audioEngine/audioContext';
import { loadSoundFontForTrack, releaseTrackFont } from '@/engine/instruments/soundfont/loadSoundFontForTrack';
import { initializeInstruments } from '@/engine/instruments/instrumentBootstrap';

export function useInstruments() {
  const { tracks, updateTrack } = useProjectStore();

  // Make sure the service is ready. `initializeInstruments` is idempotent and
  // is also called at app boot, so this only matters if a consumer mounts
  // before boot has finished.
  //
  // This deliberately does NOT dispose on unmount. It used to, which meant the
  // instrument graph's lifetime was tied to the Library panel's: closing the
  // panel destroyed every loaded instrument, and under React StrictMode the
  // mount/unmount/mount cycle tore it down immediately after loading. Playback
  // then fell back to the built-in synth. A UI panel must not own the audio
  // graph — `AudioEngineAdapter.dispose()` owns teardown.
  useEffect(() => {
    void initializeInstruments(tracks, updateTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load a SoundFont for a track and select a specific preset.
  // The real work lives in the engine so it does not depend on this component.
  const loadSoundFont = useCallback(async (
    trackId: string,
    fileUrl: string,
    presetIndex: number,
    fontId?: string,
  ): Promise<boolean> => {
    const result = await loadSoundFontForTrack(trackId, fileUrl, presetIndex);
    if (!result.ok) {
      console.error('[SoundFont] Load failed:', result.error);
      return false;
    }
    // Record the bank and preset, not just the display name, so opening the
    // project again can rebuild this instrument.
    updateTrack(trackId, {
      instrument: result.label,
      instrumentLoaded: true,
      soundFont: { id: fontId, url: fileUrl, presetIndex, presetName: result.label },
    });
    return true;
  }, [updateTrack]);

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

    releaseTrackFont(trackId);
    updateTrack(trackId, {
      instrument: undefined,
      instrumentLoaded: false,
      soundFont: undefined,
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
    loadSoundFont,
    playTestNote,
    handleNoteOn,
    handleNoteOff,
    getInstrumentName,
    hasInstrument,
  };
}

export default useInstruments;