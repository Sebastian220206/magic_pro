/**
 * MMC Sync - MIDI Machine Control
 *
 * Features:
 * - Send and receive MMC transport commands
 * - Basic and extended MMC modes
 * - Device ID filtering
 * - Command history
 * - Master/Slave modes
 * - Integration with transport control
 */

import {
  MMCCommand,
  MMCMode,
  MMCMessage,
  MMCControlMessage,
  MMCMode_,
  MMCState,
  MMCConfig,
  MMC_SYSEX_HEADER,
  MMC_SYSEX_END,
  MMC_COMMAND_BYTES,
  MMC_DEVICE_ALL,
} from './syncTypes';

// =============================================================================
// MMC Sync Engine
// =============================================================================

export class MMCSyncEngine {
  private state: MMCState;
  private config: MMCConfig;
  private midiOutput: any | null = null;
  private midiInput: any | null = null;
  private listeners: Array<(event: MMCSyncEvent) => void> = [];

  constructor(config: Partial<MMCConfig> = {}) {
    this.config = {
      mode: config.mode ?? 'internal',
      deviceId: config.deviceId ?? 0,
      sendMMC: config.sendMMC ?? true,
      receiveMMC: config.receiveMMC ?? true,
      respondToAllDevices: config.respondToAllDevices ?? true,
      commandHistorySize: config.commandHistorySize ?? 50,
    };

    this.state = {
      mode: this.config.mode,
      deviceId: this.config.deviceId,
      lastCommand: null,
      lastCommandTime: 0,
      commandHistory: [],
      isPlaying: false,
      isRecording: false,
      isPaused: false,
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
    if (this.midiInput && this.config.receiveMMC) {
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

    this.notifyListeners({ type: 'disconnected' });
  }

  // ===========================================================================
  // MMC Sending (Master Mode)
  // ===========================================================================

  public sendCommand(command: MMCCommand, deviceId?: number, data?: number): void {
    if (!this.midiOutput || !this.config.sendMMC) return;

    const id = deviceId ?? this.state.deviceId;
    const bytes = this.encodeCommand(command, id, data);

    this.midiOutput.send(bytes);
    this.notifyListeners({ type: 'command-sent', command, deviceId: id, data });
  }

  private encodeCommand(command: MMCCommand, deviceId: number, data?: number): number[] {
    const commandByte = MMC_COMMAND_BYTES[command];
    const bytes: number[] = [...MMC_SYSEX_HEADER, deviceId & 0x7F, commandByte];

    // Add data byte for shuttle command
    if (command === 'shuttle' && data !== undefined) {
      bytes.push(data & 0x7F);
    }

    bytes.push(MMC_SYSEX_END);
    return bytes;
  }

  // Transport commands
  public stop(deviceId?: number): void {
    this.sendCommand('stop', deviceId);
  }

  public play(deviceId?: number): void {
    this.sendCommand('play', deviceId);
  }

  public record(deviceId?: number): void {
    this.sendCommand('record', deviceId);
  }

  public pause(deviceId?: number): void {
    this.sendCommand('pause', deviceId);
  }

  public fastForward(deviceId?: number): void {
    this.sendCommand('fast-forward', deviceId);
  }

  public rewind(deviceId?: number): void {
    this.sendCommand('rewind', deviceId);
  }

  public loopOn(deviceId?: number): void {
    this.sendCommand('loop-on', deviceId);
  }

  public loopOff(deviceId?: number): void {
    this.sendCommand('loop-off', deviceId);
  }

  public gotoZero(deviceId?: number): void {
    this.sendCommand('goto-zero', deviceId);
  }

  public gotoStart(deviceId?: number): void {
    this.sendCommand('goto-start', deviceId);
  }

  public gotoEnd(deviceId?: number): void {
    this.sendCommand('goto-end', deviceId);
  }

  public shuttle(speed: number, deviceId?: number): void {
    // Speed: 0 = full reverse, 64 = stop, 127 = full forward
    this.sendCommand('shuttle', deviceId, Math.max(0, Math.min(127, speed)));
  }

  // ===========================================================================
  // MMC Receiving (Slave Mode)
  // ===========================================================================

  private handleMidiMessage(event: any): void {
    const data = event.data;
    if (!data || data.length < 5) return;

    // Check for MMC SysEx header
    if (data[0] !== 0xF0 || data[1] !== 0x7F) return;

    const deviceId = data[2];
    const commandByte = data[3];

    // Check if this message is for us
    if (!this.isMessageForUs(deviceId)) return;

    // Decode command
    const command = this.decodeCommand(commandByte);
    if (!command) return;

    // Extract data byte if present
    let dataValue: number | undefined;
    if (command === 'shuttle' && data.length > 4 && data[4] !== 0xF7) {
      dataValue = data[4];
    }

    // Process command
    this.processReceivedCommand(command, deviceId, dataValue);
  }

  private isMessageForUs(deviceId: number): boolean {
    if (this.config.respondToAllDevices) return true;
    return deviceId === this.state.deviceId || deviceId === MMC_DEVICE_ALL;
  }

  private decodeCommand(byte: number): MMCCommand | null {
    for (const [command, commandByte] of Object.entries(MMC_COMMAND_BYTES)) {
      if (commandByte === byte) {
        return command as MMCCommand;
      }
    }
    return null;
  }

  private processReceivedCommand(command: MMCCommand, deviceId: number, data?: number): void {
    // Update state based on command
    switch (command) {
      case 'play':
        this.state.isPlaying = true;
        this.state.isPaused = false;
        break;
      case 'stop':
        this.state.isPlaying = false;
        this.state.isPaused = false;
        break;
      case 'record':
        this.state.isRecording = true;
        this.state.isPlaying = true;
        break;
      case 'pause':
        this.state.isPaused = true;
        break;
    }

    // Add to history
    this.addToHistory(command, deviceId);

    this.state.lastCommand = command;
    this.state.lastCommandTime = performance.now();

    this.notifyListeners({ type: 'command-received', command, deviceId, data });
  }

  private addToHistory(command: MMCCommand, deviceId: number): void {
    this.state.commandHistory.unshift({
      command,
      timestamp: performance.now(),
      fromDevice: deviceId,
    });

    // Trim history to max size
    if (this.state.commandHistory.length > this.config.commandHistorySize) {
      this.state.commandHistory.pop();
    }
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  public setPlaying(isPlaying: boolean): void {
    this.state.isPlaying = isPlaying;
    if (isPlaying) {
      this.state.isPaused = false;
    }
  }

  public setRecording(isRecording: boolean): void {
    this.state.isRecording = isRecording;
    if (isRecording) {
      this.state.isPlaying = true;
    }
  }

  public setPaused(isPaused: boolean): void {
    this.state.isPaused = isPaused;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  public setMode(mode: MMCMode_): void {
    this.state.mode = mode;
    this.config.mode = mode;
    this.notifyListeners({ type: 'mode-changed', mode });
  }

  public setDeviceId(deviceId: number): void {
    this.state.deviceId = deviceId;
    this.config.deviceId = deviceId;
    this.notifyListeners({ type: 'device-id-changed', deviceId });
  }

  public getState(): Readonly<MMCState> {
    return this.state;
  }

  public getConfig(): Readonly<MMCConfig> {
    return this.config;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (event: MMCSyncEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(event: MMCSyncEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.disconnect();
    this.state.commandHistory = [];
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  public serialize(): { config: MMCConfig; state: MMCState } {
    return {
      config: { ...this.config },
      state: {
        ...this.state,
        commandHistory: [...this.state.commandHistory],
      },
    };
  }

  public deserialize(data: { config?: Partial<MMCConfig>; state?: Partial<MMCState> }): void {
    if (data.config) {
      Object.assign(this.config, data.config);
    }
    if (data.state) {
      Object.assign(this.state, data.state);
    }
  }
}

// =============================================================================
// MMC Sync Events
// =============================================================================

export type MMCSyncEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'command-sent'; command: MMCCommand; deviceId: number; data?: number }
  | { type: 'command-received'; command: MMCCommand; deviceId: number; data?: number }
  | { type: 'mode-changed'; mode: MMCMode_ }
  | { type: 'device-id-changed'; deviceId: number };

// =============================================================================
// Factory
// =============================================================================

export function createMMCSyncEngine(config?: Partial<MMCConfig>): MMCSyncEngine {
  return new MMCSyncEngine(config);
}

export default MMCSyncEngine;
