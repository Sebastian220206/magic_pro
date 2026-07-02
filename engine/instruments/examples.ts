/**
 * Instrument System - Example Usage
 * Demonstrates how to use the instrument system in the DAW
 */

// =============================================================================
// EXAMPLE 1: Creating and Playing Instruments Directly
// =============================================================================

import {
  createInstrument,
  createInstrumentFactory,
  getInstrumentService,
  instrumentRegistry,
  getAllInstrumentNames,
} from '@/engine/instruments';
import { useInstruments } from '@/hooks/useInstruments';
import { PolyphonicSynth } from '@/engine/instruments/synthEngine';
import { useProjectStore } from '@/store/projectStore';
import { MidiScheduler } from '@/engine/midi/midiScheduler';
import { createInstrumentAdapter } from '@/engine/instruments/instrumentAdapter';

// Example: Creating a Grand Piano and playing a note
async function playPianoExample() {
  const ctx = new AudioContext();

  // Create a Grand Piano instrument
  const piano = createInstrument(ctx, 'Grand Piano');
  if (!piano) {
    console.error('Failed to create piano');
    return;
  }

  // Connect to output
  piano.getOutput().connect(ctx.destination);

  // Play middle C (MIDI note 60) with velocity 100
  piano.noteOn(60, 100);

  // Release after 1 second
  setTimeout(() => {
    piano.noteOff(60);
  }, 1000);
}

// =============================================================================
// EXAMPLE 2: Assigning Instruments to Tracks
// =============================================================================

// In a React component:
function TrackInstrumentExample() {
  const {
    assignInstrument,
    removeInstrument,
    playTestNote,
    hasInstrument,
  } = useInstruments();

  // Assign instrument to track
  const setupTrack = (trackId: string) => {
    // Assign Grand Piano to a track
    assignInstrument(trackId, 'Grand Piano');
  };

  // Play test note to preview
  const previewTrack = (trackId: string) => {
    playTestNote(trackId, 60, 100); // Play C4
  };

  // Remove instrument from track
  const clearTrack = (trackId: string) => {
    removeInstrument(trackId);
  };

  return { setupTrack, previewTrack, clearTrack };
}

// =============================================================================
// EXAMPLE 3: Playing MIDI Notes Through Instruments
// =============================================================================

// Direct service usage for MIDI playback
function playMidiNote(trackId: string, note: number, velocity: number) {
  const service = getInstrumentService();

  // Note on
  service.noteOn(trackId, note, velocity);

  // Auto note off after duration
  setTimeout(() => {
    service.noteOff(trackId, note);
  }, 500);
}

// =============================================================================
// EXAMPLE 4: Drum Machine Usage
// =============================================================================

async function drumMachineExample() {
  const ctx = new AudioContext();

  // Create a drum kit
  const drums = createInstrument(ctx, '808 Classic');
  if (!drums) return;

  drums.getOutput().connect(ctx.destination);

  // Play a basic beat
  const playBeat = () => {
    const now = ctx.currentTime;

    // Kick on beats 1 and 3
    drums.noteOn(36, 127, now);       // Kick
    drums.noteOn(36, 127, now + 1.0); // Kick

    // Snare on beats 2 and 4
    drums.noteOn(38, 100, now + 0.5); // Snare
    drums.noteOn(38, 100, now + 1.5); // Snare

    // Hi-hats every 8th note
    for (let i = 0; i < 8; i++) {
      drums.noteOn(42, 80, now + i * 0.25);
    }
  };

  playBeat();
}

// =============================================================================
// EXAMPLE 5: Synth Engine Configuration
// =============================================================================

function synthExample() {
  const ctx = new AudioContext();

  // Create a lead synth
  const synth = new PolyphonicSynth(ctx, 'lead_synth');
  synth.getOutput().connect(ctx.destination);

  // Play a chord
  synth.noteOn(60, 100); // C4
  synth.noteOn(64, 100); // E4
  synth.noteOn(67, 100); // G4

  // Release chord
  setTimeout(() => {
    synth.noteOff(60);
    synth.noteOff(64);
    synth.noteOff(67);
  }, 1000);
}

// =============================================================================
// EXAMPLE 6: Track Integration with Zustand Store
// =============================================================================

// Complete track setup with instrument
function useTrackWithInstrument(trackId: string) {
  const { tracks, updateTrack } = useProjectStore();
  const { assignInstrument, playTestNote } = useInstruments();

  const track = tracks.find((t) => t.id === trackId);

  const setInstrument = (instrumentName: string) => {
    // Update store
    updateTrack(trackId, {
      instrument: instrumentName,
      instrumentLoaded: false,
    });

    // Create and assign instrument
    const success = assignInstrument(trackId, instrumentName);

    if (success) {
      updateTrack(trackId, { instrumentLoaded: true });

      // Play test note to preview
      setTimeout(() => {
        playTestNote(trackId);
      }, 100);
    }
  };

  return {
    instrument: track?.instrument,
    isLoaded: track?.instrumentLoaded,
    setInstrument,
  };
}

// =============================================================================
// EXAMPLE 7: Testing All Available Instruments
// =============================================================================

function testAllInstruments() {
  const instruments = getAllInstrumentNames();

  console.log('Available Instruments:');
  instruments.forEach((name, index) => {
    const info = instrumentRegistry[name];
    console.log(
      `${index + 1}. ${name} (${info.engine}) - ${info.category}`
    );
  });

  return instruments;
}

// =============================================================================
// EXAMPLE 8: MIDI Clip Playback with Instruments
// =============================================================================

async function setupMidiPlayback(trackId: string, instrumentName: string) {
  const ctx = new AudioContext();

  // Create instrument
  const instrument = createInstrument(ctx, instrumentName);
  if (!instrument) return null;

  // Create adapter for MIDI scheduler
  const adapter = createInstrumentAdapter(instrument);

  // Create scheduler
  const scheduler = new MidiScheduler(ctx, null as any);

  // Register instrument with scheduler
  scheduler.setInstrument(trackId, adapter as any);

  // Connect to output
  instrument.getOutput().connect(ctx.destination);

  return { scheduler, adapter };
}

// =============================================================================
// EXAMPLE 9: Volume and Mute Control
// =============================================================================

function trackControls(trackId: string) {
  const service = getInstrumentService();

  return {
    setVolume: (volume: number) => {
      service.setVolume(trackId, volume);
    },

    mute: () => {
      service.setVolume(trackId, 0);
    },

    unmute: (previousVolume: number) => {
      service.setVolume(trackId, previousVolume);
    },

    allNotesOff: () => {
      service.allNotesOff(trackId);
    },
  };
}

// =============================================================================
// EXAMPLE 10: Instrument Factory Advanced Usage
// =============================================================================

async function factoryExample() {
  const ctx = new AudioContext();

  // Create factory
  const factory = createInstrumentFactory(ctx);

  // Create multiple instruments
  const piano = factory.createInstrument('Grand Piano');
  const bass = factory.createInstrument('Deep Bass');
  const drums = factory.createInstrument('Trap Drum Kit');

  // Connect all to output
  [piano, bass, drums].forEach((inst) => {
    if (inst) inst.getOutput().connect(ctx.destination);
  });

  // Play them together
  if (piano) piano.noteOn(60, 100);
  if (bass) bass.noteOn(36, 120);
  if (drums) drums.noteOn(36, 127);

  // Cleanup
  setTimeout(() => {
    factory.disposeAll();
  }, 2000);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  playPianoExample,
  drumMachineExample,
  synthExample,
  testAllInstruments,
  setupMidiPlayback,
  trackControls,
  factoryExample,
};

// Default export with all examples
export default {
  playPianoExample,
  drumMachineExample,
  synthExample,
  testAllInstruments,
  setupMidiPlayback,
  trackControls,
  factoryExample,
};
