/**
 * MTC Sync - MIDI Time Code Synchronization
 *
 * Features:
 * - Generate and receive MTC quarter-frame messages
 * - Generate and receive MTC full-frame messages
 * - Auto-detect frame rate from received MTC
 * - Drift compensation and sync offset
 * - Master/Slave modes
 * - Integration with transport timeline
 */

import {
  MTCFrameRate,
  MTCTimecode,
  MTCQuarterFrame,
  MTCFullFrame,
  MTCMessage,
  MTCNibbleType,
  MTCSyncMode,
  MTCSyncStatus,
  MTCSyncState,
  MTCSyncConfig,
  MTC_FRAME_RATES,
  createTimecode,
  timecodeToString,
  timecodeToSeconds,
  secondsToTimecode,
  createTimecodeFromBytes,
  timecodeToBytes,
  createTimecodeFromQuarterFrames,
} from './syncTypes';

// =============================================================================
// MTC Sync Engine
// =============================================================================

export class MTCSyncEngine {
  private state: MTCSyncState;
  private config: MTCSyncConfig;
  private midiOutput: any | null = null;
  private midiInput: any | null = null;
  private quarterFrameBuffer: number[] = [];
  private listeners: Array<(event: MTCSyncEvent) => void> = [];
  private syncCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<MTCSyncConfig> = {}) {
    this.config = {
      mode: config.mode ?? 'internal',
      frameRate: config.frameRate ?? 30,
      syncOffset: config.syncOffset ?? 0,
      autoDetectFrameRate: config.autoDetectFrameRate ?? true,
      sendMTC: config.sendMTC ?? true,
      receiveMTC: config.receiveMTC ?? true,
      syncTimeout: config.syncTimeout ?? 2000,
      driftCompensation: config.driftCompensation ?? true,
      midiChannel: config.midiChannel ?? 0,
    };

    this.state = {
      mode: this.config.mode,
      status: 'unsynced',
      currentTimecode: createTimecode(0, 0, 0, 0, this.config.frameRate),
      receivedTimecode: null,
      frameRate: this.config.frameRate,
      syncOffset: this.config.syncOffset,
      drift: 0,
      lastSyncTime: 0,
      quarterFrameCount: 0,
      fullFrameCount: 0,
    };
  }

  // ===========================================================================
  // MIDI Connection
  // ===========================================================================

  public async connectToMidi(
    midiAccess: any,
    outputId?: string,
    inputId?: string
  ): Promise<void> {
    // Connect output
    if (outputId) {
      this.midiOutput = midiAccess.outputs.get(outputId) ?? null;
    } else {
      const outputs = Array.from(midiAccess.outputs.values());
      this.midiOutput = outputs[0] ?? null;
    }

    // Connect input
    if (inputId) {
      this.midiInput = midiAccess.inputs.get(inputId) ?? null;
    } else {
      const inputs = Array.from(midiAccess.inputs.values());
      this.midiInput = inputs[0] ?? null;
    }

    // Setup input listener
    if (this.midiInput && this.config.receiveMTC) {
      this.midiInput.onmidimessage = this.handleMidiMessage.bind(this);
    }

    this.notifyListeners({ type: 'connected' });
  }

  public disconnect(): void {
    if (this.midiInput) {
      this.midiInput.onmidimessage = null;
      this.midiInput = null;
    }
    this.midiOutput = null;

    if (this.syncCheckInterval) {
      clearInterval(this.syncCheckInterval);
      this.syncCheckInterval = null;
    }

    this.notifyListeners({ type: 'disconnected' });
  }

  // ===========================================================================
  // MTC Sending (Master Mode)
  // ===========================================================================

  public sendQuarterFrame(nibbleType: MTCNibbleType, value: number): void {
    if (!this.midiOutput || !this.config.sendMTC) return;

    // Quarter-frame message: 0xF1, nibble type (3 bits) + value (4 bits)
    const nibbleTypes: MTCNibbleType[] = [
      'frame-lsb', 'frame-msb', 'second-lsb', 'second-msb',
      'minute-lsb', 'minute-msb', 'hour-lsb', 'hour-msb',
    ];
    const typeIndex = nibbleTypes.indexOf(nibbleType);
    if (typeIndex < 0) return;

    const status = 0xF1;
    const data = (typeIndex << 4) | (value & 0x0F);

    this.midiOutput.send([status, data]);
  }

  public sendFullFrame(timecode: MTCTimecode): void {
    if (!this.midiOutput || !this.config.sendMTC) return;

    const bytes = timecodeToBytes(timecode);
    const status = 0xF1;
    const typeByte = 0x7F; // Full-frame type

    this.midiOutput.send([status, typeByte, bytes[0], bytes[1], bytes[2], bytes[3]]);
  }

  public sendTimecode(timecode: MTCTimecode): void {
    // Send full frame for immediate sync
    this.sendFullFrame(timecode);

    // Also send quarter frames for continuous sync
    this.sendQuarterFrames(timecode);
  }

  public sendQuarterFrames(timecode: MTCTimecode): void {
    const bytes = timecodeToBytes(timecode);

    // Send all 8 quarter frames
    for (let i = 0; i < 8; i++) {
      const nibbleTypes: MTCNibbleType[] = [
        'frame-lsb', 'frame-msb', 'second-lsb', 'second-msb',
        'minute-lsb', 'minute-msb', 'hour-lsb', 'hour-msb',
      ];

      const value = i % 2 === 0 ? bytes[i / 2] & 0x0F : (bytes[Math.floor(i / 2)] >> 4) & 0x0F;
      this.sendQuarterFrame(nibbleTypes[i], value);
    }
  }

  // ===========================================================================
  // MTC Receiving (Slave Mode)
  // ===========================================================================

  private handleMidiMessage(event: any): void {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0];

    // Check for MTC quarter-frame (0xF1)
    if (status === 0xF1) {
      const byte = data[1];

      if (byte === 0x7F) {
        // Full-frame message
        this.handleFullFrame(data);
      } else {
        // Quarter-frame message
        this.handleQuarterFrame(byte);
      }
    }
  }

  private handleQuarterFrame(byte: number): void {
    const nibbleType = (byte >> 4) & 0x07;
    const value = byte & 0x0F;

    this.quarterFrameBuffer[nibbleType] = value;
    this.state.quarterFrameCount++;

    // Check if we have all 8 nibbles
    if (this.quarterFrameBuffer.length === 8) {
      try {
        const timecode = createTimecodeFromQuarterFrames(this.quarterFrameBuffer);
        this.processReceivedTimecode(timecode);
      } catch (e) {
        // Invalid timecode, ignore
      }
    }
  }

  private handleFullFrame(data: Uint8Array): void {
    if (data.length < 6) return;

    const bytes = Array.from(data.slice(2, 6));
    const frameRate = this.config.autoDetectFrameRate
      ? this.detectFrameRateFromBytes(bytes)
      : this.config.frameRate;

    const timecode = createTimecodeFromBytes(bytes, frameRate);
    this.processReceivedTimecode(timecode);
    this.state.fullFrameCount++;
  }

  private detectFrameRateFromBytes(bytes: number[]): MTCFrameRate {
    const rateBits = (bytes[3] >> 6) & 0x03;
    switch (rateBits) {
      case 0: return 24;
      case 1: return 25;
      case 2: return 29.97;
      case 3: return 30;
      default: return 30;
    }
  }

  private processReceivedTimecode(timecode: MTCTimecode): void {
    this.state.receivedTimecode = timecode;
    this.state.lastSyncTime = performance.now();

    // Auto-detect frame rate if enabled
    if (this.config.autoDetectFrameRate) {
      this.state.frameRate = timecode.frameRate;
    }

    // Calculate drift
    const expectedSeconds = timecodeToSeconds(this.state.currentTimecode);
    const receivedSeconds = timecodeToSeconds(timecode);
    this.state.drift = (receivedSeconds - expectedSeconds) * 1000; // Convert to ms

    // Apply drift compensation if enabled
    if (this.config.driftCompensation && Math.abs(this.state.drift) > 1) {
      this.state.currentTimecode = timecode;
      this.notifyListeners({ type: 'drift-corrected', drift: this.state.drift });
    }

    // Update status
    this.state.status = 'synced';
    this.notifyListeners({ type: 'timecode-received', timecode, drift: this.state.drift });
  }

  // ===========================================================================
  // Transport Control
  // ===========================================================================

  public setCurrentTimecode(timecode: MTCTimecode): void {
    this.state.currentTimecode = timecode;

    if (this.config.mode === 'mtc-master') {
      this.sendFullFrame(timecode);
    }

    this.notifyListeners({ type: 'timecode-set', timecode });
  }

  public getCurrentTimecode(): MTCTimecode {
    return { ...this.state.currentTimecode };
  }

  public updatePlaybackPosition(seconds: number): void {
    const timecode = secondsToTimecode(seconds, this.state.frameRate);
    this.state.currentTimecode = timecode;

    if (this.config.mode === 'mtc-master' && this.config.sendMTC) {
      this.sendQuarterFrames(timecode);
    }
  }

  // ===========================================================================
  // Sync Management
  // ===========================================================================

  public startSyncCheck(): void {
    if (this.syncCheckInterval) return;

    this.syncCheckInterval = setInterval(() => {
      this.checkSyncStatus();
    }, 100);
  }

  public stopSyncCheck(): void {
    if (this.syncCheckInterval) {
      clearInterval(this.syncCheckInterval);
      this.syncCheckInterval = null;
    }
  }

  private checkSyncStatus(): void {
    if (this.config.mode === 'internal') {
      this.state.status = 'synced';
      return;
    }

    if (this.config.mode === 'mtc-slave') {
      const timeSinceLastSync = performance.now() - this.state.lastSyncTime;

      if (timeSinceLastSync > this.config.syncTimeout) {
        this.state.status = 'error';
        this.notifyListeners({ type: 'sync-timeout' });
      } else if (timeSinceLastSync > this.config.syncTimeout / 2) {
        this.state.status = 'unsynced';
      } else {
        this.state.status = 'synced';
      }
    }
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setMode(mode: MTCSyncMode): void {
    this.state.mode = mode;
    this.config.mode = mode;
    this.notifyListeners({ type: 'mode-changed', mode });
  }

  public setFrameRate(frameRate: MTCFrameRate): void {
    this.config.frameRate = frameRate;
    this.state.frameRate = frameRate;
    this.notifyListeners({ type: 'frame-rate-changed', frameRate });
  }

  public setSyncOffset(offsetMs: number): void {
    this.config.syncOffset = offsetMs;
    this.state.syncOffset = offsetMs;
    this.notifyListeners({ type: 'sync-offset-changed', offset: offsetMs });
  }

  public getState(): Readonly<MTCSyncState> {
    return this.state;
  }

  public getConfig(): Readonly<MTCSyncConfig> {
    return this.config;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (event: MTCSyncEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(event: MTCSyncEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.disconnect();
    this.quarterFrameBuffer = [];
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): { config: MTCSyncConfig; state: MTCSyncState } {
    return {
      config: { ...this.config },
      state: { ...this.state },
    };
  }

  public deserialize(data: { config?: Partial<MTCSyncConfig>; state?: Partial<MTCSyncState> }): void {
    if (data.config) {
      Object.assign(this.config, data.config);
    }
    if (data.state) {
      Object.assign(this.state, data.state);
    }
  }
}

// =============================================================================
// MTC Sync Events
// =============================================================================

export type MTCSyncEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'timecode-received'; timecode: MTCTimecode; drift: number }
  | { type: 'timecode-set'; timecode: MTCTimecode }
  | { type: 'drift-corrected'; drift: number }
  | { type: 'mode-changed'; mode: MTCSyncMode }
  | { type: 'frame-rate-changed'; frameRate: MTCFrameRate }
  | { type: 'sync-offset-changed'; offset: number }
  | { type: 'sync-timeout' };

// =============================================================================
// Factory
// =============================================================================

export function createMTCSyncEngine(config?: Partial<MTCSyncConfig>): MTCSyncEngine {
  return new MTCSyncEngine(config);
}

export default MTCSyncEngine;
