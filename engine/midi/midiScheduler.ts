import { MidiNote, MidiRegion, MidiInstrument } from './types';
import { MidiNoteIndex } from './MidiNoteIndex';
import { TransportTimeline, TempoEvent } from './TransportTimeline';
import { MidiStateResolver } from './MidiStateResolver';

export interface ScheduledVoice {
  id: string;
  noteId: string;
  regionId: string;
  triggerTimeDsp: number;
  releaseTimeDsp: number;
  pitch: number;
}

export class MidiScheduler {
  private activeVoices = new Map<string, ScheduledVoice>();
  private scheduledRegions = new Map<string, MidiRegion>();
  private instruments = new Map<string, MidiInstrument>();

  // Playback State
  private isPlaying = false;
  private currentBeat = 0;
  private startTimeDsp = 0;
  
  // Dependencies
  private timeline: TransportTimeline;

  constructor(private audioContext: AudioContext, timeline: TransportTimeline) {
    this.timeline = timeline;
  }

  public setTimeline(timeline: TransportTimeline) {
    this.timeline = timeline;
  }

  public setInstrument(trackId: string, instrument: MidiInstrument) {
    this.instruments.set(trackId, instrument);
  }

  public scheduleRegion(region: MidiRegion) {
    this.scheduledRegions.set(region.id, region);
  }

  public unscheduleRegion(regionId: string) {
    this.scheduledRegions.delete(regionId);
  }

  public start(startBeat: number) {
    this.isPlaying = true;
    this.currentBeat = startBeat;
    
    // Convert the startBeat to absolute DSP time
    const startSeconds = this.timeline.beatToSeconds(startBeat);
    this.startTimeDsp = this.audioContext.currentTime - startSeconds;
    
    // Resolve active held notes and immediately trigger them
    this.resolveAndTriggerImmediateState(startBeat);
  }

  public stop() {
    this.isPlaying = false;
    this.panicAllNotes(this.audioContext.currentTime);
  }

  public seek(beat: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.stop();
    
    this.currentBeat = beat;
    const seekSeconds = this.timeline.beatToSeconds(beat);
    this.startTimeDsp = this.audioContext.currentTime - seekSeconds;
    
    if (wasPlaying) this.start(beat);
  }

  private resolveAndTriggerImmediateState(beat: number) {
    for (const region of Array.from(this.scheduledRegions.values())) {
      const instrument = this.instruments.get(region.trackId);
      if (!instrument) continue;

      const allNotes = region.chunks.flatMap(c => c.notes);
      const heldNotes = MidiStateResolver.resolveActiveNotesAtBeat(allNotes, beat);

      for (const note of heldNotes) {
        // Note is currently sounding. Start it immediately.
        const durationBeatsLeft = (note.startBeat + note.duration) - beat;
        const releaseTimeDsp = this.audioContext.currentTime + this.timeline.beatToSeconds(durationBeatsLeft); 
        
        instrument.trigger(note.pitch, this.audioContext.currentTime, durationBeatsLeft, note.velocity);
        
        const voiceId = `${region.id}-${note.id}`;
        this.activeVoices.set(voiceId, {
          id: voiceId,
          noteId: note.id,
          regionId: region.id,
          triggerTimeDsp: this.audioContext.currentTime,
          releaseTimeDsp,
          pitch: note.pitch
        });
      }
    }
  }

  public scheduleLookahead(fromBeat: number, endBeat: number, dspTimeNow: number) {
    if (!this.isPlaying) return;

    for (const region of Array.from(this.scheduledRegions.values())) {
      const instrument = this.instruments.get(region.trackId);
      if (!instrument) continue;

      for (const chunk of region.chunks) {
        // Chunk Culling
        if (chunk.endBeat < fromBeat || chunk.startBeat > endBeat) continue;

        const index = new MidiNoteIndex(chunk.notes);
        const incomingNotes = index.getNotesStartingInRange(fromBeat, endBeat);

        for (const note of incomingNotes) {
          const voiceId = `${region.id}-${note.id}`;
          if (note.muted || this.activeVoices.has(voiceId)) continue;

          // Tempo-aware exact absolute DSP time mapping
          const triggerTimeDsp = this.startTimeDsp + this.timeline.beatToSeconds(note.startBeat);
          const releaseTimeDsp = this.startTimeDsp + this.timeline.beatToSeconds(note.startBeat + note.duration);

          if (triggerTimeDsp >= dspTimeNow) {
            instrument.trigger(note.pitch, triggerTimeDsp, note.duration, note.velocity);

            this.activeVoices.set(voiceId, {
              id: voiceId,
              noteId: note.id,
              regionId: region.id,
              triggerTimeDsp,
              releaseTimeDsp,
              pitch: note.pitch
            });
          }
        }
      }
    }

    // Purge finished voices from tracking
    for (const [id, voice] of this.activeVoices.entries()) {
      if (voice.releaseTimeDsp < dspTimeNow) {
        this.activeVoices.delete(id);
      }
    }
  }

  public getScheduledVoicesInRange(regionId: string, fromBeat: number, toBeat: number): ScheduledVoice[] {
    const affected: ScheduledVoice[] = [];
    const fromTime = this.startTimeDsp + this.timeline.beatToSeconds(fromBeat);
    const toTime = this.startTimeDsp + this.timeline.beatToSeconds(toBeat);

    for (const voice of Array.from(this.activeVoices.values())) {
      if (voice.regionId === regionId) {
        // Does the voice duration overlap the invalidated window?
        if (voice.triggerTimeDsp <= toTime && voice.releaseTimeDsp >= fromTime) {
          affected.push(voice);
        }
      }
    }
    return affected;
  }

  public cancelVoice(voiceId: string, dspTimeNow: number) {
    const voice = this.activeVoices.get(voiceId);
    if (voice && voice.triggerTimeDsp > dspTimeNow) {
      // Future event dropped before it triggers
      this.activeVoices.delete(voiceId);
    }
  }

  public panicVoice(voiceId: string, dspTimeNow: number) {
    const voice = this.activeVoices.get(voiceId);
    if (!voice) return;

    const region = this.scheduledRegions.get(voice.regionId);
    const instrument = region ? this.instruments.get(region.trackId) : null;
    
    if (instrument) {
      instrument.release(voice.pitch);
    }
    this.activeVoices.delete(voiceId);
  }

  public panicAllNotes(dspTimeNow: number) {
    for (const voice of Array.from(this.activeVoices.values())) {
      this.panicVoice(voice.id, dspTimeNow);
    }
    this.activeVoices.clear();
  }

  public rescheduleWindow(fromBeat: number, toBeat: number) {
    this.scheduleLookahead(fromBeat, toBeat, this.audioContext.currentTime);
  }

  public dispose() {
    this.stop();
    this.activeVoices.clear();
    this.scheduledRegions.clear();
    this.instruments.clear();
  }
}
