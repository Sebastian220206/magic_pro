import { MidiScheduler } from './midiScheduler';

export class MidiPlaybackInvalidation {
  constructor(private scheduler: MidiScheduler) {}

  /**
   * Called when a command mutates notes in a specific beat range.
   */
  public invalidateRange(regionId: string, fromBeat: number, toBeat: number, dspTimeNow: number) {
    // 1. Identify all active/queued voices within this affected range
    const affectedVoices = this.scheduler.getScheduledVoicesInRange(regionId, fromBeat, toBeat);

    // 2. Cancel future Web Audio API events for these voices
    for (const voice of affectedVoices) {
      this.scheduler.cancelVoice(voice.id, dspTimeNow);
    }

    // 3. Immediately trigger NoteOff for anything currently sounding
    for (const voice of affectedVoices) {
      const isSounding = voice.triggerTimeDsp <= dspTimeNow && voice.releaseTimeDsp > dspTimeNow;
      if (isSounding) {
        this.scheduler.panicVoice(voice.id, dspTimeNow);
      }
    }

    // 4. Force the scheduler to re-evaluate this window from the mutated store
    this.scheduler.rescheduleWindow(fromBeat, toBeat);
  }
}
