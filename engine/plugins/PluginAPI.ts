export interface MidiEvent {
  noteOn: boolean;
  pitch: number;
  velocity: number;
  sampleOffset: number;
}

export interface MagicPlugin {
  /**
   * Called exactly once before processAudio.
   * Can be used to allocate internal WASM buffers.
   */
  initialize(sampleRate: number): void;

  /**
   * Main DSP callback.
   * STRICTLY NO ALLOCATIONS, CLOSURES, OR LOCKS ALLOWED.
   * @param inputs Array of input channels
   * @param outputs Array of output channels
   */
  processAudio(inputs: Float32Array[], outputs: Float32Array[]): void;

  /**
   * Process incoming MIDI. Called right before processAudio for the given block.
   */
  processMidi(events: MidiEvent[]): void;
}
