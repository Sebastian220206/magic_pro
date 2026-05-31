// engine/audioEngine/workletSynth.ts
import { audioContextManager } from './audioContext';

export class WorkletSynth {
  private node: AudioWorkletNode | null = null;

  static async register() {
    const ctx = audioContextManager.getContext();
    if (!ctx) {
        await audioContextManager.initialize();
    }
    
    // only register once
    try {
      await audioContextManager.loadWorklet('synth-processor', '/worklets/synth-processor.js');
    } catch {
      // already registered — safe to ignore
    }
  }

  async init(destination: AudioNode) {
    const ctx = audioContextManager.getContext();
    if (!ctx) throw new Error('AudioContext not initialized');

    await WorkletSynth.register();

    this.node = new AudioWorkletNode(ctx, 'synth-processor');
    this.node.connect(destination);
  }

  setFrequency(hz: number, time = 0) {
    this.node?.parameters.get('frequency')?.setValueAtTime(hz, time);
  }

  setGain(value: number, time = 0) {
    this.node?.parameters.get('gain')?.setValueAtTime(value, time);
  }

  dispose() {
    this.node?.disconnect();
    this.node = null;
  }
}
