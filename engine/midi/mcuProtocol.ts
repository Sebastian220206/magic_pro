/**
 * MCU Protocol - Mackie Control Universal Implementation
 *
 * Features:
 * - 8 channel strips with motorized faders
 * - V-Pot encoders (assignable knobs)
 * - Channel buttons (Select, Mute, Solo, Record Arm)
 * - Transport controls (Play, Stop, Record, FF, Rewind, etc.)
 * - LCD display (2 x 56 characters)
 * - Modifier keys (Shift, Option, Control, Alt)
 * - Banking (shift channels by 8)
 * - Assignment modes
 */

// =============================================================================
// MCU Constants
// =============================================================================

// MIDI Status bytes
export const MCU_STATUS = {
  NOTE_ON: 0x90,
  NOTE_OFF: 0x80,
  CONTROL_CHANGE: 0xB0,
  PITCH_BEND: 0xE0,
  SYSEX: 0xF0,
  SYSEX_END: 0xF7,
};

// MCU Channel (typically channel 1 for most functions)
export const MCU_CHANNEL = 0;

// Fader positions (14-bit MIDI)
export const MCU_FADER_MIN = 0;
export const MCU_FADER_MAX = 16383;

// V-Pot positions (0-127)
export const MCU_VPOT_MIN = 0;
export const MCU_VPOT_MAX = 127;

// =============================================================================
// MCU Button Notes (Note On/Off)
// =============================================================================

export enum MCUButton {
  // Channel strip buttons (per channel, offset by channel index)
  REC_ARM = 0,      // Record Arm
  SOLO = 8,         // Solo
  MUTE = 16,        // Mute
  SELECT = 24,      // Select
  V_POT_PUSH = 32,  // V-Pot push button

  // Transport controls
  TRANSPORT_STOP = 54,
  TRANSPORT_PLAY = 55,
  TRANSPORT_RECORD = 56,
  TRANSPORT_FORWARD = 57,
  TRANSPORT_REWIND = 58,
  TRANSPORT_LOOP = 59,
  TRANSPORT_PUNCH_IN = 60,
  TRANSPORT_PUNCH_OUT = 61,

  // Navigation
  NAVIGATION_UP = 62,
  NAVIGATION_DOWN = 63,
  NAVIGATION_LEFT = 64,
  NAVIGATION_RIGHT = 65,
  NAVIGATION_ENTER = 66,
  NAVIGATION_CANCEL = 67,

  // Function keys
  F1 = 68,
  F2 = 69,
  F3 = 70,
  F4 = 71,
  F5 = 72,
  F6 = 73,
  F7 = 74,
  F8 = 75,

  // Modifier keys
  SHIFT = 76,
  OPTION = 77,
  CONTROL = 78,
  ALT = 79,

  // Banking
  BANK_LEFT = 80,
  BANK_RIGHT = 81,
  CHANNEL_LEFT = 82,
  CHANNEL_RIGHT = 83,

  // Assignment modes
  ASSIGN_FADER = 84,
  ASSIGN_PAN = 85,
  ASSIGN_EQ = 86,
  ASSIGN_SEND = 87,

  // Display
  DISPLAY_BRIGHTNESS_UP = 88,
  DISPLAY_BRIGHTNESS_DOWN = 89,

  // Jog wheel
  JOG_WHEEL_PUSH = 90,

  // Touch-sensitive faders
  FADER_TOUCH = 104, // + channel index (104-111)
}

// =============================================================================
// MCU Control Change Numbers
// =============================================================================

export enum MCUCC {
  // V-Pot encoders (per channel, offset by channel index)
  VPOT_1 = 16,
  VPOT_2 = 17,
  VPOT_3 = 18,
  VPOT_4 = 19,
  VPOT_5 = 20,
  VPOT_6 = 21,
  VPOT_7 = 22,
  VPOT_8 = 23,

  // Jog wheel (relative or absolute)
  JOG_WHEEL = 60,

  // Fader touch (per channel)
  FADER_TOUCH_1 = 104,
  FADER_TOUCH_2 = 105,
  FADER_TOUCH_3 = 106,
  FADER_TOUCH_4 = 107,
  FADER_TOUCH_5 = 108,
  FADER_TOUCH_6 = 109,
  FADER_TOUCH_7 = 110,
  FADER_TOUCH_8 = 111,
}

// =============================================================================
// MCU Fader Pitch Bend (per channel)
// =============================================================================

export const MCU_FADER_CHANNELS = {
  FADER_1: 0,
  FADER_2: 1,
  FADER_3: 2,
  FADER_4: 3,
  FADER_5: 4,
  FADER_6: 5,
  FADER_7: 6,
  FADER_8: 7,
};

// =============================================================================
// MCU Types
// =============================================================================

export type MCUMode = 'mcu' | 'mcu-extender';

export interface MCUChannelStrip {
  index: number;              // 0-7
  faderPosition: number;      // 0-16383 (14-bit)
  faderTouched: boolean;
  vPot: number;               // 0-127
  vPotLEDs: number;           // Bitmask for LED ring (0-127)
  recArm: boolean;
  solo: boolean;
  mute: boolean;
  selected: boolean;
  name: string;               // 6 chars for LCD
  meterLevel: number;         // 0-15 for meter display
}

export interface MCUTimecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  display: string;            // 10-char display string
}

export interface MCUState {
  mode: MCUMode;
  channels: MCUChannelStrip[];
  transport: MCUTransportState;
  modifiers: MCUModifierState;
  timecode: MCUTimecode;
  lcd: {
    top: string;              // 56 chars top row
    bottom: string;           // 56 chars bottom row
  };
  assignmentMode: MCUAssignmentMode;
  bankPosition: number;       // Starting channel index (0, 8, 16, etc.)
  connected: boolean;
}

export interface MCUTransportState {
  playing: boolean;
  recording: boolean;
  stopped: boolean;
  looping: boolean;
  punchIn: boolean;
  punchOut: boolean;
  fastForward: boolean;
  rewind: boolean;
}

export interface MCUModifierState {
  shift: boolean;
  option: boolean;
  control: boolean;
  alt: boolean;
}

export type MCUAssignmentMode = 'fader' | 'pan' | 'eq' | 'send' | 'instrument';

// =============================================================================
// MCU Configuration
// =============================================================================

export interface MCUConfig {
  mode: MCUMode;
  deviceId: number;           // MIDI device ID
  channel: number;            // MIDI channel (0-15)
  numChannels: number;        // Number of channels (8 or 16 for extender)
  faderTouchSensitivity: number; // ms
  vPotAcceleration: boolean;  //加速模式
  displayEnabled: boolean;
  meterEnabled: boolean;
}

// =============================================================================
// MCU Messages
// =============================================================================

export interface MCUMessage {
  type: 'note' | 'cc' | 'pitchbend' | 'sysex';
  status: number;
  channel: number;
  data1: number;
  data2: number;
  timestamp?: number;
}

export interface MCU_SYSEX_HEADER {
  manufacturer: number[];     // [0x00, 0x00, 0x66] for Mackie
  model: number;              // 0x10-0x13 for MCU variants
  deviceId: number;
}

// =============================================================================
// MCU Functions
// =============================================================================

// Create channel strip with defaults
export function createChannelStrip(index: number): MCUChannelStrip {
  return {
    index,
    faderPosition: 0,
    faderTouched: false,
    vPot: 0,
    vPotLEDs: 0,
    recArm: false,
    solo: false,
    mute: false,
    selected: false,
    name: '      ',
    meterLevel: 0,
  };
}

// Create default MCU state
export function createMCUState(config: MCUConfig): MCUState {
  const channels: MCUChannelStrip[] = [];
  for (let i = 0; i < config.numChannels; i++) {
    channels.push(createChannelStrip(i));
  }

  return {
    mode: config.mode,
    channels,
    transport: {
      playing: false,
      recording: false,
      stopped: true,
      looping: false,
      punchIn: false,
      punchOut: false,
      fastForward: false,
      rewind: false,
    },
    modifiers: {
      shift: false,
      option: false,
      control: false,
      alt: false,
    },
    timecode: {
      hours: 0,
      minutes: 0,
      seconds: 0,
      frames: 0,
      display: '00:00:00:00',
    },
    lcd: {
      top: '                                                            ',
      bottom: '                                                            ',
    },
    assignmentMode: 'fader',
    bankPosition: 0,
    connected: false,
  };
}

// Encode fader position to pitch bend (14-bit)
export function encodeFaderPosition(position: number): [number, number] {
  const clamped = Math.max(0, Math.min(16383, position));
  return [clamped & 0x7F, (clamped >> 7) & 0x7F]; // LSB, MSB
}

// Decode fader position from pitch bend
export function decodeFaderPosition(lsb: number, msb: number): number {
  return ((msb & 0x7F) << 7) | (lsb & 0x7F);
}

// Encode V-Pot position to CC value
export function encodeVPot(position: number): number {
  return Math.max(0, Math.min(127, position));
}

// Decode V-Pot position from CC value
export function decodeVPot(value: number): number {
  return value & 0x7F;
}

// Create LCD update SysEx
export function createLCDUpdateSysex(
  topRow: string,
  bottomRow: string,
  deviceId: number = 0
): number[] {
  const header: number[] = [
    MCU_STATUS.SYSEX,
    0x00, 0x00, 0x66,  // Mackie manufacturer ID
    0x10,              // MCU model
    deviceId,
    0x12,              // LCD update command
  ];

  // Pad strings to 56 characters
  const top = topRow.padEnd(56, ' ').slice(0, 56);
  const bottom = bottomRow.padEnd(56, ' ').slice(0, 56);

  // Convert to ASCII
  const data: number[] = [];
  for (let i = 0; i < 56; i++) {
    data.push(top.charCodeAt(i) & 0x7F);
  }
  for (let i = 0; i < 56; i++) {
    data.push(bottom.charCodeAt(i) & 0x7F);
  }

  return [...header, ...data, MCU_STATUS.SYSEX_END];
}

// Create V-Pot LED update
export function createVPotLEDUpdate(
  channel: number,
  position: number,
  mode: number = 0
): number[] {
  return [
    MCU_STATUS.CONTROL_CHANGE | MCU_CHANNEL,
    MCUCC.VPOT_1 + channel,
    (mode << 4) | (position & 0x0F),
  ];
}

// Create timecode display update
export function createTimecodeDisplay(
  timecode: MCUTimecode,
  deviceId: number = 0
): number[] {
  const header: number[] = [
    MCU_STATUS.SYSEX,
    0x00, 0x00, 0x66,
    0x10,
    deviceId,
    0x01,  // Timecode display command
  ];

  const data: number[] = [
    timecode.hours,
    timecode.minutes,
    timecode.seconds,
    timecode.frames,
  ];

  return [...header, ...data, MCU_STATUS.SYSEX_END];
}


