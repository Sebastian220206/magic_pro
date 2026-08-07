/**
 * External Sync Manager - Combined MTC/MMC Synchronization
 *
 * Features:
 * - Unified interface for MTC and MMC sync
 * - Combined master/slave modes
 * - MIDI Clock support
 * - Transport integration
 * - Status monitoring
 */

import {
  MTCFrameRate,
  MTCTimecode,
  MTCSyncMode,
  MMCCommand,
  MMCMode_,
  SyncMode,
  ExternalSyncConfig,
  ExternalSyncState,
  MIDIClockState,
  MIDIClockConfig,
  createTimecode,
  timecodeToSeconds,
  secondsToTimecode,
} from './syncTypes';

import { MTCSyncEngine, MTCSyncEvent } from './mtcSync';
import { MMCSyncEngine, MMCSyncEvent } from './mmcSync';

// =============================================================================
// External Sync Manager
// =============================================================================

export class ExternalSyncManager {
  private mtcEngine: MTCSyncEngine;
  private mmcEngine: MMCSyncEngine;
  private config: ExternalSyncConfig;
  private state: ExternalSyncState;
  private clockState: MIDIClockState;
  private clockConfig: MIDIClockConfig;
  private listeners: Array<(event: ExternalSyncEvent) => void> = [];
  private transportCallback: ((command: string) => void) | null = null;

  constructor(config: Partial<ExternalSyncConfig> = {}) {
    this.config = {
      mtc: config.mtc ?? {
        mode: 'internal',
        frameRate: 30,
        syncOffset: 0,
        autoDetectFrameRate: true,
        sendMTC: true,
        receiveMTC: true,
        syncTimeout: 2000,
        driftCompensation: true,
        midiChannel: 0,
      },
      mmc: config.mmc ?? {
        mode: 'internal',
        deviceId: 0,
        sendMMC: true,
        receiveMMC: true,
        respondToAllDevices: true,
        commandHistorySize: 50,
      },
      mode: config.mode ?? 'internal',
      enabled: config.enabled ?? true,
    };

    this.state = {
      mtc: {
        mode: this.config.mtc.mode ?? 'internal',
        status: 'unsynced',
        currentTimecode: createTimecode(0, 0, 0, 0, this.config.mtc.frameRate ?? 30),
        receivedTimecode: null,
        frameRate: this.config.mtc.frameRate ?? 30,
        syncOffset: this.config.mtc.syncOffset ?? 0,
        drift: 0,
        lastSyncTime: 0,
        quarterFrameCount: 0,
        fullFrameCount: 0,
      },
      mmc: {
        mode: this.config.mmc.mode ?? 'internal',
        deviceId: this.config.mmc.deviceId ?? 0,
        lastCommand: null,
        lastCommandTime: 0,
        commandHistory: [],
        isPlaying: false,
        isRecording: false,
        isPaused: false,
      },
      mode: this.config.mode,
      enabled: this.config.enabled,
      connected: false,
    };

    this.clockState = {
      bpm: 120,
      ticksPerBeat: 24,
      tickCount: 0,
      lastTickTime: 0,
      songPosition: 0,
      songPositionHigh: 0,
      songPositionLow: 0,
    };

    this.clockConfig = {
      sendClock: true,
      receiveClock: true,
      sendSongPosition: true,
      receiveSongPosition: true,
      sendStart: true,
      receiveStart: true,
      sendContinue: true,
      receiveContinue: true,
      sendStop: true,
      receiveStop: true,
    };

    this.mtcEngine = new MTCSyncEngine(this.config.mtc);
    this.mmcEngine = new MMCSyncEngine(this.config.mmc);

    // Forward events
    this.mtcEngine.subscribe(this.handleMTCEvent.bind(this));
    this.mmcEngine.subscribe(this.handleMMCEvent.bind(this));
  }

  // ===========================================================================
  // MIDI Connection
  // ===========================================================================

  public async connectToMidi(
    midiAccess: any,
    outputId?: string,
    inputId?: string
  ): Promise<void> {
    await this.mtcEngine.connectToMidi(midiAccess, outputId, inputId);
    await this.mmcEngine.connectToMidi(midiAccess, outputId, inputId);

    this.state.connected = true;
    this.notifyListeners({ type: 'connected' });
  }

  public disconnect(): void {
    this.mtcEngine.disconnect();
    this.mmcEngine.disconnect();

    this.state.connected = false;
    this.notifyListeners({ type: 'disconnected' });
  }

  // ===========================================================================
  // Transport Control
  // ===========================================================================

  public setTransportCallback(callback: (command: string) => void): void {
    this.transportCallback = callback;
  }

  public play(): void {
    if (this.config.mode.includes('master')) {
      this.mmcEngine.play();
    }
    this.state.mmc.isPlaying = true;
    this.state.mmc.isPaused = false;
    this.notifyListeners({ type: 'transport-changed', isPlaying: true, isPaused: false });
  }

  public stop(): void {
    if (this.config.mode.includes('master')) {
      this.mmcEngine.stop();
    }
    this.state.mmc.isPlaying = false;
    this.state.mmc.isRecording = false;
    this.state.mmc.isPaused = false;
    this.notifyListeners({ type: 'transport-changed', isPlaying: false, isPaused: false });
  }

  public record(): void {
    if (this.config.mode.includes('master')) {
      this.mmcEngine.record();
    }
    this.state.mmc.isRecording = true;
    this.state.mmc.isPlaying = true;
    this.notifyListeners({ type: 'transport-changed', isPlaying: true, isRecording: true });
  }

  public pause(): void {
    if (this.config.mode.includes('master')) {
      this.mmcEngine.pause();
    }
    this.state.mmc.isPaused = true;
    this.notifyListeners({ type: 'transport-changed', isPlaying: false, isPaused: true });
  }

  public gotoZero(): void {
    if (this.config.mode.includes('master')) {
      this.mmcEngine.gotoZero();
    }
    this.setCurrentTimecode(createTimecode(0, 0, 0, 0, this.state.mtc.frameRate));
  }

  // ===========================================================================
  // Timecode Control
  // ===========================================================================

  public setCurrentTimecode(timecode: MTCTimecode): void {
    this.mtcEngine.setCurrentTimecode(timecode);
    this.state.mtc.currentTimecode = timecode;
    this.notifyListeners({ type: 'timecode-changed', timecode });
  }

  public getCurrentTimecode(): MTCTimecode {
    return this.mtcEngine.getCurrentTimecode();
  }

  public updatePlaybackPosition(seconds: number): void {
    this.mtcEngine.updatePlaybackPosition(seconds);
    const timecode = secondsToTimecode(seconds, this.state.mtc.frameRate);
    this.state.mtc.currentTimecode = timecode;
  }

  // ===========================================================================
  // MIDI Clock
  // ===========================================================================

  public sendMIDIClock(): void {
    // 24 ticks per quarter note
    this.clockState.tickCount++;
    this.clockState.lastTickTime = performance.now();
    this.notifyListeners({ type: 'midi-clock-tick', tickCount: this.clockState.tickCount });
  }

  public sendSongPosition(position: number): void {
    this.clockState.songPosition = position;
    this.clockState.songPositionLow = position & 0x7F;
    this.clockState.songPositionHigh = (position >> 7) & 0x7F;
    this.notifyListeners({ type: 'song-position-changed', position });
  }

  public setBPM(bpm: number): void {
    this.clockState.bpm = Math.max(20, Math.min(300, bpm));
    this.notifyListeners({ type: 'bpm-changed', bpm: this.clockState.bpm });
  }

  public getBPM(): number {
    return this.clockState.bpm;
  }

  // ===========================================================================
  // Sync Management
  // ===========================================================================

  public startSync(): void {
    this.mtcEngine.startSyncCheck();
    this.notifyListeners({ type: 'sync-started' });
  }

  public stopSync(): void {
    this.mtcEngine.stopSyncCheck();
    this.notifyListeners({ type: 'sync-stopped' });
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setMode(mode: SyncMode): void {
    this.config.mode = mode;
    this.state.mode = mode;

    // Set MTC mode based on sync mode
    let mtcMode: MTCSyncMode = 'internal';
    let mmcMode: MMCMode_ = 'internal';

    if (mode.includes('mtc-master') || mode.includes('combined-master')) {
      mtcMode = 'mtc-master';
      mmcMode = 'mmc-master';
    } else if (mode.includes('mtc-slave') || mode.includes('combined-slave')) {
      mtcMode = 'mtc-slave';
      mmcMode = 'mmc-slave';
    }

    this.mtcEngine.setMode(mtcMode);
    this.mmcEngine.setMode(mmcMode);

    this.notifyListeners({ type: 'mode-changed', mode });
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.state.enabled = enabled;
    this.notifyListeners({ type: 'enabled-changed', enabled });
  }

  public setFrameRate(frameRate: MTCFrameRate): void {
    this.mtcEngine.setFrameRate(frameRate);
    this.state.mtc.frameRate = frameRate;
    this.notifyListeners({ type: 'frame-rate-changed', frameRate });
  }

  public setSyncOffset(offsetMs: number): void {
    this.mtcEngine.setSyncOffset(offsetMs);
    this.state.mtc.syncOffset = offsetMs;
    this.notifyListeners({ type: 'sync-offset-changed', offset: offsetMs });
  }

  public getState(): Readonly<ExternalSyncState> {
    return this.state;
  }

  public getClockState(): Readonly<MIDIClockState> {
    return this.clockState;
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  private handleMTCEvent(event: MTCSyncEvent): void {
    switch (event.type) {
      case 'timecode-received':
        this.state.mtc.receivedTimecode = event.timecode;
        this.state.mtc.drift = event.drift;
        this.state.mtc.status = 'synced';
        this.notifyListeners({ type: 'timecode-received', timecode: event.timecode, drift: event.drift });
        break;
      case 'timecode-set':
        this.state.mtc.currentTimecode = event.timecode;
        this.notifyListeners({ type: 'timecode-changed', timecode: event.timecode });
        break;
      case 'drift-corrected':
        this.notifyListeners({ type: 'drift-corrected', drift: event.drift });
        break;
      case 'sync-timeout':
        this.state.mtc.status = 'error';
        this.notifyListeners({ type: 'sync-timeout' });
        break;
    }
  }

  private handleMMCEvent(event: MMCSyncEvent): void {
    switch (event.type) {
      case 'command-received':
        this.processMMCCommand(event.command);
        break;
      case 'command-sent':
        this.notifyListeners({ type: 'mmc-command-sent', command: event.command });
        break;
    }
  }

  private processMMCCommand(command: MMCCommand): void {
    // Update transport state
    switch (command) {
      case 'play':
        this.state.mmc.isPlaying = true;
        this.state.mmc.isPaused = false;
        this.notifyListeners({ type: 'transport-changed', isPlaying: true, isPaused: false });
        break;
      case 'stop':
        this.state.mmc.isPlaying = false;
        this.state.mmc.isRecording = false;
        this.state.mmc.isPaused = false;
        this.notifyListeners({ type: 'transport-changed', isPlaying: false, isPaused: false });
        break;
      case 'record':
        this.state.mmc.isRecording = true;
        this.state.mmc.isPlaying = true;
        this.notifyListeners({ type: 'transport-changed', isPlaying: true, isRecording: true });
        break;
      case 'pause':
        this.state.mmc.isPaused = true;
        this.notifyListeners({ type: 'transport-changed', isPlaying: false, isPaused: true });
        break;
      case 'goto-zero':
        this.gotoZero();
        break;
    }

    // Invoke transport callback if set
    if (this.transportCallback) {
      this.transportCallback(command);
    }

    this.notifyListeners({ type: 'mmc-command-received', command });
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (event: ExternalSyncEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(event: ExternalSyncEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.disconnect();
    this.mtcEngine.dispose();
    this.mmcEngine.dispose();
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): {
    config: ExternalSyncConfig;
    state: ExternalSyncState;
    clockState: MIDIClockState;
  } {
    return {
      config: { ...this.config },
      state: { ...this.state },
      clockState: { ...this.clockState },
    };
  }

  public deserialize(data: {
    config?: Partial<ExternalSyncConfig>;
    state?: Partial<ExternalSyncState>;
    clockState?: Partial<MIDIClockState>;
  }): void {
    if (data.config) {
      Object.assign(this.config, data.config);
    }
    if (data.state) {
      Object.assign(this.state, data.state);
    }
    if (data.clockState) {
      Object.assign(this.clockState, data.clockState);
    }
  }
}

// =============================================================================
// External Sync Events
// =============================================================================

export type ExternalSyncEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'mode-changed'; mode: SyncMode }
  | { type: 'enabled-changed'; enabled: boolean }
  | { type: 'timecode-changed'; timecode: MTCTimecode }
  | { type: 'timecode-received'; timecode: MTCTimecode; drift: number }
  | { type: 'drift-corrected'; drift: number }
  | { type: 'frame-rate-changed'; frameRate: MTCFrameRate }
  | { type: 'sync-offset-changed'; offset: number }
  | { type: 'sync-started' }
  | { type: 'sync-stopped' }
  | { type: 'sync-timeout' }
  | { type: 'transport-changed'; isPlaying?: boolean; isRecording?: boolean; isPaused?: boolean }
  | { type: 'mmc-command-sent'; command: MMCCommand }
  | { type: 'mmc-command-received'; command: MMCCommand }
  | { type: 'midi-clock-tick'; tickCount: number }
  | { type: 'song-position-changed'; position: number }
  | { type: 'bpm-changed'; bpm: number };

// =============================================================================
// Factory
// =============================================================================

export function createExternalSyncManager(config?: Partial<ExternalSyncConfig>): ExternalSyncManager {
  return new ExternalSyncManager(config);
}

export default ExternalSyncManager;
