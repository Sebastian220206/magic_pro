import { globalDSP } from '../dsp/runtime/global';
import { globalGraphSync } from '../dsp/orchestration/ProjectToGraphSync';
import { SharedTransportBuffer } from '../dsp/memory/SharedTransportBuffer';
import { ENABLE_PHASE3_TRANSPORT } from '../config/runtimeFlags';

export class EngineBootstrap {
  private static isInitialized = false;
  private static isInitializing = false;
  
  public static sharedTransport = new SharedTransportBuffer();

  /**
   * Main entry point for starting the DAW engine.
   * MUST be called from a user interaction (e.g., a "Start" or "Play" button)
   * to satisfy browser Autoplay policies.
   */
  public static async boot(): Promise<void> {
    if (this.isInitialized || this.isInitializing) return;
    this.isInitializing = true;

    try {
      console.log('[EngineBootstrap] Booting Magic Pro Engine...');

      // 1. Initialize Audio Context
      const ctx = await globalDSP.initializeContext();
      console.log(`[EngineBootstrap] AudioContext running at ${ctx.sampleRate}Hz`);

      if (ENABLE_PHASE3_TRANSPORT) {
        // 2. Fetch and initialize WASM DSP Core
        console.log('[EngineBootstrap] Loading WASM SIMD Core...');
        await globalDSP.wasmRuntime.initialize('/wasm/dsp-core/magic_dsp_core_bg.wasm');

        // 3. Load AudioWorklet Processor
        console.log('[EngineBootstrap] Registering AudioWorklet...');
        await ctx.audioWorklet.addModule('/engine/dsp/worklets/DSPWorkletProcessor.js');

        // 4. Instantiate Master Worklet Node
        const workletNode = new AudioWorkletNode(ctx, 'dsp-worklet', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2]
        });
        globalDSP.masterWorkletNode = workletNode;

        // 5. Connect to hardware output
        workletNode.connect(ctx.destination);

        // 6. Push SharedMemory buffers to the Worklet
        workletNode.port.postMessage({
          type: 'INIT_TRANSPORT',
          sharedBuffer: this.sharedTransport.buffer
        });

        // 7. Initialize Graph Orchestration
        // This links the Zustand UI state to the Worklet via postMessage
        globalGraphSync.setWorkletPort(workletNode.port);
        globalGraphSync.initialize();
      }

      this.isInitialized = true;
      console.log('[EngineBootstrap] Magic Pro Engine Successfully Booted!');

    } catch (e) {
      console.error('[EngineBootstrap] CRITICAL BOOT FAILURE:', e);
      this.isInitializing = false;
      throw e;
    }
  }
}
