/**
 * MidiRecorder - Real-time MIDI recording from Web MIDI API
 *
 * Captures MIDI note-on/note-off events and converts them into
 * clip notes with accurate timing via a getCurrentBeat callback.
 * Also captures sustain pedal (CC64) events and stores their state.
 */

import { midiDeviceService } from './midiDeviceService';

type NoteRecordedCallback = (note: { pitch: number; startBeat: number; duration: number; velocity: number }) => void;
type SustainPedalCallback = (active: boolean, beat: number) => void;
type GetCurrentBeat = () => number;

export class MidiRecorder {
  private unsubscribe: (() => void) | null = null;
  private activeNotes = new Map<number, { startBeat: number; velocity: number }>();
  private isRunning = false;
  private onNoteRecorded: NoteRecordedCallback;
  private onSustainPedal?: SustainPedalCallback;
  private getCurrentBeat: GetCurrentBeat;
  private clipLength = 0;
  private sustainPedalActive = false;

  constructor(
    onNoteRecorded: NoteRecordedCallback,
    getCurrentBeat: GetCurrentBeat,
    onSustainPedal?: SustainPedalCallback,
  ) {
    this.onNoteRecorded = onNoteRecorded;
    this.getCurrentBeat = getCurrentBeat;
    this.onSustainPedal = onSustainPedal;
  }

  async start(clipLength: number): Promise<void> {
    this.clipLength = clipLength;
    this.activeNotes.clear();
    this.isRunning = true;

    // Subscribing, not binding. This used to assign `input.onmidimessage` on
    // every port, which stole the keyboard from the note router that feeds
    // recording — and `stop()` set those ports to null, leaving the keyboard
    // completely dead until it was replugged. Opening the piano roll and
    // pressing R was enough to do it.
    await midiDeviceService.initialize();
    this.unsubscribe?.();
    this.unsubscribe = midiDeviceService.subscribeToMessages(({ data }) => {
      this.handleMessage({ data } as MIDIMessageEvent);
    });
  }

  stop(): void {
    this.isRunning = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.activeNotes.clear();
  }

  private handleMessage(event: MIDIMessageEvent): void {
    if (!event.data || !this.isRunning) return;
    const [status, data1, data2] = event.data;
    const command = status & 0xf0;
    if (command === 0x90 && data2 > 0) {
      // Note on
      this.activeNotes.set(data1, { startBeat: this.getCurrentBeat(), velocity: data2 });
    } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
      // Note off
      const active = this.activeNotes.get(data1);
      if (active) {
        const endBeat = this.getCurrentBeat();
        let duration = Math.max(0.125, endBeat - active.startBeat);
        // If sustain pedal is active, extend note duration to end of clip or pedal release
        if (this.sustainPedalActive && duration < 1) {
          duration = Math.max(duration, 1);
        }
        if (active.startBeat < this.clipLength) {
          this.onNoteRecorded({
            pitch: data1,
            startBeat: active.startBeat,
            duration: Math.min(duration, this.clipLength - active.startBeat),
            velocity: active.velocity,
          });
        }
        this.activeNotes.delete(data1);
      }
    } else if (command === 0xb0 && data1 === 64) {
      // Sustain pedal (CC64)
      const pedalActive = data2 >= 64;
      this.sustainPedalActive = pedalActive;
      this.onSustainPedal?.(pedalActive, this.getCurrentBeat());
    }
  }

  dispose(): void {
    this.stop();
  }
}
