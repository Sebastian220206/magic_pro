/**
 * Control Surface Manager - Unified MCU/HUI Support
 *
 * Features:
 * - Auto-detect MCU or HUI protocol
 * - Unified interface for both protocols
 * - Channel strip mapping
 * - Transport control
 * - LCD/Scribble strip updates
 * - Metering
 * - Banking and assignment modes
 */

import {
  MCUState,
  MCUConfig,
  MCUChannelStrip,
  MCUButton,
  MCUCC,
  MCU_FADER_CHANNELS,
  createMCUState,
  encodeFaderPosition,
  decodeFaderPosition,
  createLCDUpdateSysex,
  createTimecodeDisplay,
  createChannelStrip,
} from './mcuProtocol';

import {
  HUIState,
  HUIConfig,
  HUIChannelStrip,
  HUIButton,
  HUICC,
  HUI_FADER_CHANNELS,
  createHUIState,
  encodeHUIFaderPosition,
  decodeHUIFaderPosition,
  createScribbleStripUpdate,
  createMeterUpdate,
  createHUIChannelStrip,
} from './huiProtocol';

// =============================================================================
// Control Surface Types
// =============================================================================

export type ControlSurfaceProtocol = 'mcu' | 'hui' | 'auto';

export interface ControlSurfaceConfig {
  protocol: ControlSurfaceProtocol;
  deviceId: number;
  channel: number;
  numChannels: number;
  autoDetect: boolean;
  syncTransport: boolean;
  syncDisplay: boolean;
  syncMetering: boolean;
}

export interface ControlSurfaceState {
  protocol: 'mcu' | 'hui' | null;
  config: ControlSurfaceConfig;
  mcu: MCUState | null;
  hui: HUIState | null;
  connected: boolean;
  lastActivity: number;
}

// =============================================================================
// Control Surface Manager
// =============================================================================

export class ControlSurfaceManager {
  private state: ControlSurfaceState;
  private midiOutput: any | null = null;
  private midiInput: any | null = null;
  private listeners: Array<(event: ControlSurfaceEvent) => void> = [];
  private faderCallbacks: Map<number, (value: number) => void> = new Map();
  private buttonCallbacks: Map<string, (pressed: boolean) => void> = new Map();
  private encoderCallbacks: Map<number, (delta: number) => void> = new Map();

  constructor(config: Partial<ControlSurfaceConfig> = {}) {
    const fullConfig: ControlSurfaceConfig = {
      protocol: config.protocol ?? 'auto',
      deviceId: config.deviceId ?? 0,
      channel: config.channel ?? 0,
      numChannels: config.numChannels ?? 8,
      autoDetect: config.autoDetect ?? true,
      syncTransport: config.syncTransport ?? true,
      syncDisplay: config.syncDisplay ?? true,
      syncMetering: config.syncMetering ?? true,
    };

    const mcuConfig: MCUConfig = {
      mode: 'mcu',
      deviceId: fullConfig.deviceId,
      channel: fullConfig.channel,
      numChannels: fullConfig.numChannels,
      faderTouchSensitivity: 10,
      vPotAcceleration: true,
      displayEnabled: fullConfig.syncDisplay,
      meterEnabled: fullConfig.syncMetering,
    };

    const huiConfig: HUIConfig = {
      mode: 'hui',
      deviceId: fullConfig.deviceId,
      channel: fullConfig.channel,
      numChannels: fullConfig.numChannels,
      faderTouchSensitivity: 10,
      displayEnabled: fullConfig.syncDisplay,
      meterEnabled: fullConfig.syncMetering,
    };

    this.state = {
      protocol: fullConfig.protocol === 'auto' ? null : fullConfig.protocol,
      config: fullConfig,
      mcu: fullConfig.protocol !== 'hui' ? createMCUState(mcuConfig) : null,
      hui: fullConfig.protocol !== 'mcu' ? createHUIState(huiConfig) : null,
      connected: false,
      lastActivity: 0,
    };
  }

  // ===========================================================================
  // MIDI Connection
  // ===========================================================================

  public async connectToMidi(
    midiAccess: any,
    outputId?: string,
    inputId?: string
  ): Promise<boolean> {
    try {
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

      if (!this.midiInput || !this.midiOutput) {
        console.error('[ControlSurface] No MIDI devices found');
        return false;
      }

      // Setup input listener
      this.midiInput.onmidimessage = this.handleMidiMessage.bind(this);

      // Auto-detect protocol if enabled
      if (this.state.config.autoDetect && !this.state.protocol) {
        await this.detectProtocol();
      }

      this.state.connected = true;
      this.notifyListeners({ type: 'connected', protocol: this.state.protocol ?? 'mcu' });
      return true;

    } catch (error) {
      console.error('[ControlSurface] Connection failed:', error);
      return false;
    }
  }

  public disconnect(): void {
    if (this.midiInput) {
      this.midiInput.onmidimessage = null;
      this.midiInput = null;
    }
    this.midiOutput = null;

    this.state.connected = false;
    if (this.state.mcu) this.state.mcu.connected = false;
    if (this.state.hui) this.state.hui.connected = false;

    this.notifyListeners({ type: 'disconnected' });
  }

  // ===========================================================================
  // Protocol Detection
  // ===========================================================================

  private async detectProtocol(): Promise<void> {
    // Send a test message and see what comes back
    // MCU typically responds to LCD update, HUI to scribble strip
    // For now, default to MCU
    this.state.protocol = 'mcu';
    console.log('[ControlSurface] Auto-detected protocol: MCU');
  }

  // ===========================================================================
  // MIDI Message Handling
  // ===========================================================================

  private handleMidiMessage(event: any): void {
    const data = event.data;
    if (!data || data.length < 2) return;

    this.state.lastActivity = performance.now();

    const status = data[0] & 0xF0;
    const channel = data[0] & 0x0F;

    // Route to appropriate protocol handler
    if (this.state.protocol === 'mcu' || this.state.protocol === null) {
      this.handleMCUMessage(data);
    } else if (this.state.protocol === 'hui') {
      this.handleHUIMessage(data);
    }
  }

  private handleMCUMessage(data: Uint8Array): void {
    if (!this.state.mcu) return;

    const status = data[0] & 0xF0;

    switch (status) {
      case 0x90: // Note On
        this.processMCUNoteOn(data[1], data[2]);
        break;
      case 0x80: // Note Off
        this.processMCUNoteOff(data[1]);
        break;
      case 0xB0: // Control Change
        this.processMCUCC(data[1], data[2]);
        break;
      case 0xE0: // Pitch Bend (Fader)
        this.processMCUFader(data[1], data[2]);
        break;
    }

    this.notifyListeners({ type: 'message', protocol: 'mcu', data: Array.from(data) });
  }

  private handleHUIMessage(data: Uint8Array): void {
    if (!this.state.hui) return;

    const status = data[0] & 0xF0;

    switch (status) {
      case 0x90: // Note On
        this.processHUINoteOn(data[1], data[2]);
        break;
      case 0x80: // Note Off
        this.processHUINoteOff(data[1]);
        break;
      case 0xB0: // Control Change
        this.processHUICC(data[1], data[2]);
        break;
      case 0xE0: // Pitch Bend (Fader)
        this.processHUIFader(data[1], data[2]);
        break;
    }

    this.notifyListeners({ type: 'message', protocol: 'hui', data: Array.from(data) });
  }

  // ===========================================================================
  // MCU Message Processing
  // ===========================================================================

  private processMCUNoteOn(note: number, velocity: number): void {
    const mcu = this.state.mcu!;
    const pressed = velocity > 0;

    // Channel strip buttons
    if (note >= MCUButton.REC_ARM && note < MCUButton.SOLO) {
      const channel = note - MCUButton.REC_ARM;
      if (channel < mcu.channels.length) {
        mcu.channels[channel].recArm = pressed;
        this.notifyListeners({ type: 'button', channel, button: 'recArm', pressed });
      }
    } else if (note >= MCUButton.SOLO && note < MCUButton.MUTE) {
      const channel = note - MCUButton.SOLO;
      if (channel < mcu.channels.length) {
        mcu.channels[channel].solo = pressed;
        this.notifyListeners({ type: 'button', channel, button: 'solo', pressed });
      }
    } else if (note >= MCUButton.MUTE && note < MCUButton.SELECT) {
      const channel = note - MCUButton.MUTE;
      if (channel < mcu.channels.length) {
        mcu.channels[channel].mute = pressed;
        this.notifyListeners({ type: 'button', channel, button: 'mute', pressed });
      }
    } else if (note >= MCUButton.SELECT && note < MCUButton.V_POT_PUSH) {
      const channel = note - MCUButton.SELECT;
      if (channel < mcu.channels.length) {
        mcu.channels[channel].selected = pressed;
        this.notifyListeners({ type: 'button', channel, button: 'select', pressed });
      }
    }

    // Transport buttons
    else if (note === MCUButton.TRANSPORT_STOP) {
      mcu.transport.stopped = pressed;
      mcu.transport.playing = false;
      this.notifyListeners({ type: 'transport', control: 'stop', pressed });
    } else if (note === MCUButton.TRANSPORT_PLAY) {
      mcu.transport.playing = pressed;
      mcu.transport.stopped = false;
      this.notifyListeners({ type: 'transport', control: 'play', pressed });
    } else if (note === MCUButton.TRANSPORT_RECORD) {
      mcu.transport.recording = pressed;
      this.notifyListeners({ type: 'transport', control: 'record', pressed });
    } else if (note === MCUButton.TRANSPORT_LOOP) {
      mcu.transport.looping = pressed;
      this.notifyListeners({ type: 'transport', control: 'loop', pressed });
    }

    // Modifier keys
    else if (note === MCUButton.SHIFT) {
      mcu.modifiers.shift = pressed;
    } else if (note === MCUButton.OPTION) {
      mcu.modifiers.option = pressed;
    } else if (note === MCUButton.CONTROL) {
      mcu.modifiers.control = pressed;
    } else if (note === MCUButton.ALT) {
      mcu.modifiers.alt = pressed;
    }

    // Banking
    else if (note === MCUButton.BANK_LEFT) {
      this.bankLeft();
    } else if (note === MCUButton.BANK_RIGHT) {
      this.bankRight();
    } else if (note === MCUButton.CHANNEL_LEFT) {
      this.channelLeft();
    } else if (note === MCUButton.CHANNEL_RIGHT) {
      this.channelRight();
    }

    // Assignment modes
    else if (note === MCUButton.ASSIGN_FADER) {
      mcu.assignmentMode = 'fader';
    } else if (note === MCUButton.ASSIGN_PAN) {
      mcu.assignmentMode = 'pan';
    } else if (note === MCUButton.ASSIGN_EQ) {
      mcu.assignmentMode = 'eq';
    } else if (note === MCUButton.ASSIGN_SEND) {
      mcu.assignmentMode = 'send';
    }

    // Fader touch
    if (note >= MCUButton.FADER_TOUCH && note < MCUButton.FADER_TOUCH + 8) {
      const channel = note - MCUButton.FADER_TOUCH;
      if (channel < mcu.channels.length) {
        mcu.channels[channel].faderTouched = pressed;
        this.notifyListeners({ type: 'faderTouch', channel, touched: pressed });
      }
    }
  }

  private processMCUNoteOff(note: number): void {
    this.processMCUNoteOn(note, 0);
  }

  private processMCUCC(cc: number, value: number): void {
    const mcu = this.state.mcu!;

    // V-Pot encoders
    if (cc >= MCUCC.VPOT_1 && cc <= MCUCC.VPOT_8) {
      const channel = cc - MCUCC.VPOT_1;
      if (channel < mcu.channels.length) {
        mcu.channels[channel].vPot = value;
        this.notifyListeners({ type: 'encoder', channel, value });
      }
    }

    // Jog wheel
    else if (cc === MCUCC.JOG_WHEEL) {
      const delta = value > 64 ? value - 128 : value;
      this.notifyListeners({ type: 'jogWheel', delta });
    }
  }

  private processMCUFader(lsb: number, msb: number): void {
    const mcu = this.state.mcu!;
    const channel = lsb; // Channel is encoded in pitch bend channel

    if (channel < mcu.channels.length) {
      const position = decodeFaderPosition(lsb, msb);
      mcu.channels[channel].faderPosition = position;

      // Normalize to 0-1 for callback
      const normalized = position / 16383;
      const callback = this.faderCallbacks.get(channel);
      if (callback) callback(normalized);

      this.notifyListeners({ type: 'fader', channel, position, normalized });
    }
  }

  // ===========================================================================
  // HUI Message Processing
  // ===========================================================================

  private processHUINoteOn(note: number, velocity: number): void {
    const hui = this.state.hui!;
    const pressed = velocity > 0;

    // Channel strip buttons
    if (note >= HUIButton.REC_ARM && note < HUIButton.SOLO) {
      const channel = note - HUIButton.REC_ARM;
      if (channel < hui.channels.length) {
        hui.channels[channel].recArm = pressed;
        this.notifyListeners({ type: 'button', channel, button: 'recArm', pressed });
      }
    } else if (note >= HUIButton.SOLO && note < HUIButton.MUTE) {
      const channel = note - HUIButton.SOLO;
      if (channel < hui.channels.length) {
        hui.channels[channel].solo = pressed;
        this.notifyListeners({ type: 'button', channel, button: 'solo', pressed });
      }
    } else if (note >= HUIButton.MUTE && note < HUIButton.SELECT) {
      const channel = note - HUIButton.MUTE;
      if (channel < hui.channels.length) {
        hui.channels[channel].mute = pressed;
        this.notifyListeners({ type: 'button', channel, button: 'mute', pressed });
      }
    } else if (note >= HUIButton.SELECT && note < HUIButton.TRANSPORT_STOP) {
      const channel = note - HUIButton.SELECT;
      if (channel < hui.channels.length) {
        hui.channels[channel].selected = pressed;
        this.notifyListeners({ type: 'button', channel, button: 'select', pressed });
      }
    }

    // Transport buttons
    else if (note === HUIButton.TRANSPORT_STOP) {
      hui.transport.stopped = pressed;
      hui.transport.playing = false;
      this.notifyListeners({ type: 'transport', control: 'stop', pressed });
    } else if (note === HUIButton.TRANSPORT_PLAY) {
      hui.transport.playing = pressed;
      hui.transport.stopped = false;
      this.notifyListeners({ type: 'transport', control: 'play', pressed });
    } else if (note === HUIButton.TRANSPORT_RECORD) {
      hui.transport.recording = pressed;
      this.notifyListeners({ type: 'transport', control: 'record', pressed });
    } else if (note === HUIButton.TRANSPORT_LOOP) {
      hui.transport.looping = pressed;
      this.notifyListeners({ type: 'transport', control: 'loop', pressed });
    }

    // Modifier keys
    else if (note === HUIButton.SHIFT) {
      hui.modifiers.shift = pressed;
    } else if (note === HUIButton.OPTION) {
      hui.modifiers.option = pressed;
    } else if (note === HUIButton.CONTROL) {
      hui.modifiers.control = pressed;
    }

    // Banking
    else if (note === HUIButton.BANK_LEFT) {
      this.bankLeft();
    } else if (note === HUIButton.BANK_RIGHT) {
      this.bankRight();
    }
  }

  private processHUINoteOff(note: number): void {
    this.processHUINoteOn(note, 0);
  }

  private processHUICC(cc: number, value: number): void {
    const hui = this.state.hui!;

    // V-Pot encoders
    if (cc >= HUICC.VPOT_1 && cc <= HUICC.VPOT_8) {
      const channel = cc - HUICC.VPOT_1;
      if (channel < hui.channels.length) {
        hui.channels[channel].vPot = value;
        this.notifyListeners({ type: 'encoder', channel, value });
      }
    }

    // Jog wheel
    else if (cc === HUICC.JOG_WHEEL) {
      const delta = value > 64 ? value - 128 : value;
      this.notifyListeners({ type: 'jogWheel', delta });
    }
  }

  private processHUIFader(lsb: number, msb: number): void {
    const hui = this.state.hui!;
    const channel = lsb;

    if (channel < hui.channels.length) {
      const position = decodeHUIFaderPosition(lsb, msb);
      hui.channels[channel].faderPosition = position;

      const normalized = position / 16383;
      const callback = this.faderCallbacks.get(channel);
      if (callback) callback(normalized);

      this.notifyListeners({ type: 'fader', channel, position, normalized });
    }
  }

  // ===========================================================================
  // Output Functions (Send to Control Surface)
  // ===========================================================================

  public setFaderPosition(channel: number, position: number): void {
    if (!this.midiOutput) return;

    const clamped = Math.max(0, Math.min(1, position));
    const midiValue = Math.round(clamped * 16383);
    const [lsb, msb] = encodeFaderPosition(midiValue);

    if (this.state.protocol === 'mcu') {
      this.midiOutput.send([0xE0 + channel, lsb, msb]);
    } else if (this.state.protocol === 'hui') {
      this.midiOutput.send([0xE0 + channel, lsb, msb]);
    }
  }

  public setChannelName(channel: number, name: string): void {
    if (!this.midiOutput) return;

    if (this.state.protocol === 'mcu') {
      // MCU uses LCD update - pad to 6 chars per channel
      const topRow = this.buildMCULCDTopRow();
      const bottomRow = this.buildMCULCDBottomRow();
      const sysex = createLCDUpdateSysex(topRow, bottomRow, this.state.config.deviceId);
      this.midiOutput.send(sysex);
    } else if (this.state.protocol === 'hui') {
      const sysex = createScribbleStripUpdate(channel, name, this.state.config.deviceId);
      this.midiOutput.send(sysex);
    }
  }

  private buildMCULCDTopRow(): string {
    if (!this.state.mcu) return '';
    return this.state.mcu.channels.map(ch => ch.name.padEnd(7)).join('');
  }

  private buildMCULCDBottomRow(): string {
    if (!this.state.mcu) return '';
    return this.state.mcu.channels.map(ch =>
      `${String(ch.faderPosition).padStart(5)} `
    ).join('');
  }

  public setMeterLevel(channel: number, level: number): void {
    if (!this.midiOutput) return;

    const clampedLevel = Math.max(0, Math.min(15, Math.round(level * 15)));

    if (this.state.protocol === 'hui') {
      const sysex = createMeterUpdate(channel, clampedLevel, level >= 1);
      this.midiOutput.send(sysex);
    }
    // MCU uses different metering approach
  }

  public updateTimecode(timecode: { hours: number; minutes: number; seconds: number; frames: number }): void {
    if (!this.midiOutput || !this.state.config.syncDisplay) return;

    if (this.state.protocol === 'mcu' && this.state.mcu) {
      this.state.mcu.timecode = { ...timecode, display: '' };
      const sysex = createTimecodeDisplay(this.state.mcu.timecode, this.state.config.deviceId);
      this.midiOutput.send(sysex);
    }
  }

  // ===========================================================================
  // Banking
  // ===========================================================================

  public bankLeft(): void {
    const mcu = this.state.mcu || this.state.hui;
    if (!mcu) return;

    const newState = this.state.mcu || this.state.hui!;
    newState.bankPosition = Math.max(0, newState.bankPosition - 8);
    this.notifyListeners({ type: 'bank', position: newState.bankPosition });
  }

  public bankRight(): void {
    const mcu = this.state.mcu || this.state.hui;
    if (!mcu) return;

    const newState = this.state.mcu || this.state.hui!;
    newState.bankPosition += 8;
    this.notifyListeners({ type: 'bank', position: newState.bankPosition });
  }

  public channelLeft(): void {
    const mcu = this.state.mcu || this.state.hui;
    if (!mcu) return;

    const newState = this.state.mcu || this.state.hui!;
    newState.bankPosition = Math.max(0, newState.bankPosition - 1);
    this.notifyListeners({ type: 'bank', position: newState.bankPosition });
  }

  public channelRight(): void {
    const mcu = this.state.mcu || this.state.hui;
    if (!mcu) return;

    const newState = this.state.mcu || this.state.hui!;
    newState.bankPosition += 1;
    this.notifyListeners({ type: 'bank', position: newState.bankPosition });
  }

  // ===========================================================================
  // Callback Registration
  // ===========================================================================

  public onFaderChange(channel: number, callback: (value: number) => void): void {
    this.faderCallbacks.set(channel, callback);
  }

  public onButtonPress(button: string, callback: (pressed: boolean) => void): void {
    this.buttonCallbacks.set(button, callback);
  }

  public onEncoderTurn(channel: number, callback: (delta: number) => void): void {
    this.encoderCallbacks.set(channel, callback);
  }

  // ===========================================================================
  // State
  // ===========================================================================

  public getState(): Readonly<ControlSurfaceState> {
    return this.state;
  }

  public getProtocol(): 'mcu' | 'hui' | null {
    return this.state.protocol;
  }

  public isConnected(): boolean {
    return this.state.connected;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public subscribe(listener: (event: ControlSurfaceEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(event: ControlSurfaceEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  public dispose(): void {
    this.disconnect();
    this.faderCallbacks.clear();
    this.buttonCallbacks.clear();
    this.encoderCallbacks.clear();
  }
}

// =============================================================================
// Control Surface Events
// =============================================================================

export type ControlSurfaceEvent =
  | { type: 'connected'; protocol: 'mcu' | 'hui' }
  | { type: 'disconnected' }
  | { type: 'message'; protocol: 'mcu' | 'hui'; data: number[] }
  | { type: 'fader'; channel: number; position: number; normalized: number }
  | { type: 'faderTouch'; channel: number; touched: boolean }
  | { type: 'button'; channel: number; button: string; pressed: boolean }
  | { type: 'encoder'; channel: number; value: number }
  | { type: 'transport'; control: string; pressed: boolean }
  | { type: 'jogWheel'; delta: number }
  | { type: 'bank'; position: number };

// =============================================================================
// Factory
// =============================================================================

export function createControlSurfaceManager(config?: Partial<ControlSurfaceConfig>): ControlSurfaceManager {
  return new ControlSurfaceManager(config);
}

export default ControlSurfaceManager;
