/**
 * HUI Protocol - Digidesign HUI Implementation
 *
 * Features:
 * - 8 channel strips with touch-sensitive faders
 * - Assignable rotary encoders (V-Pots)
 * - Channel buttons (Select, Mute, Solo, Record Arm)
 * - Transport controls
 * - Digital scribble strips (channel names)
 * - LED metering (8 segments)
 * - Mode buttons and assignment section
 */

// =============================================================================
// HUI Constants
// =============================================================================

// MIDI Status bytes
export const HUI_STATUS = {
  NOTE_ON: 0x90,
  NOTE_OFF: 0x80,
  CONTROL_CHANGE: 0xB0,
  PITCH_BEND: 0xE0,
  SYSEX: 0xF0,
  SYSEX_END: 0xF7,
};

// HUI MIDI Channel (channel 1 for most functions)
export const HUI_CHANNEL = 0;

// Fader positions (14-bit MIDI)
export const HUI_FADER_MIN = 0;
export const HUI_FADER_MAX = 16383;

// =============================================================================
// HUI Button Notes (Note On/Off)
// =============================================================================

export enum HUIButton {
  // Channel strip buttons (per channel, offset by channel index)
  REC_ARM = 0,      // Record Arm
  SOLO = 8,         // Solo
  MUTE = 16,        // Mute
  SELECT = 24,      // Select

  // Transport controls
  TRANSPORT_STOP = 94,
  TRANSPORT_PLAY = 95,
  TRANSPORT_RECORD = 96,
  TRANSPORT_FORWARD = 97,
  TRANSPORT_REWIND = 98,
  TRANSPORT_LOOP = 99,
  TRANSPORT_PUNCH_IN = 100,
  TRANSPORT_PUNCH_OUT = 101,

  // Mode buttons
  MODE_FADER = 102,
  MODE_PAN = 103,
  MODE_EQ = 104,
  MODE_SEND = 105,
  MODE_INSTRUMENT = 106,

  // Banking
  BANK_LEFT = 107,
  BANK_RIGHT = 108,
  CHANNEL_LEFT = 109,
  CHANNEL_RIGHT = 110,

  // Navigation
  NAVIGATION_UP = 111,
  NAVIGATION_DOWN = 112,
  NAVIGATION_LEFT = 113,
  NAVIGATION_RIGHT = 114,
  NAVIGATION_ENTER = 115,
  NAVIGATION_CANCEL = 116,

  // Function keys
  F1 = 117,
  F2 = 118,
  F3 = 119,
  F4 = 120,
  F5 = 121,
  F6 = 122,
  F7 = 123,
  F8 = 124,

  // Modifier keys
  SHIFT = 125,
  OPTION = 126,
  CONTROL = 127,
}

// =============================================================================
// HUI Control Change Numbers
// =============================================================================

export enum HUICC {
  // V-Pot encoders (per channel, offset by channel index)
  VPOT_1 = 16,
  VPOT_2 = 17,
  VPOT_3 = 18,
  VPOT_4 = 19,
  VPOT_5 = 20,
  VPOT_6 = 21,
  VPOT_7 = 22,
  VPOT_8 = 23,

  // Jog wheel
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
// HUI Fader Pitch Bend (per channel)
// =============================================================================

export const HUI_FADER_CHANNELS = {
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
// HUI Types
// =============================================================================

export type HUIMode = 'hui' | 'hui-8';

export interface HUIChannelStrip {
  index: number;              // 0-7
  faderPosition: number;      // 0-16383 (14-bit)
  faderTouched: boolean;
  vPot: number;               // 0-127
  vPotLEDs: number;           // Bitmask for LED ring
  recArm: boolean;
  solo: boolean;
  mute: boolean;
  selected: boolean;
  name: string;               // 6 chars for scribble strip
  meterLevel: number;         // 0-15 for meter display
  meterPeak: boolean;         // Peak indicator
}

export interface HUITimecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  display: string;            // 10-char display string
}

export interface HUIState {
  mode: HUIMode;
  channels: HUIChannelStrip[];
  transport: HUITransportState;
  modifiers: HUIModifierState;
  timecode: HUITimecode;
  assignmentMode: HUIAssignmentMode;
  bankPosition: number;       // Starting channel index
  connected: boolean;
}

export interface HUITransportState {
  playing: boolean;
  recording: boolean;
  stopped: boolean;
  looping: boolean;
  punchIn: boolean;
  punchOut: boolean;
  fastForward: boolean;
  rewind: boolean;
}

export interface HUIModifierState {
  shift: boolean;
  option: boolean;
  control: boolean;
}

export type HUIAssignmentMode = 'fader' | 'pan' | 'eq' | 'send' | 'instrument';

// =============================================================================
// HUI Configuration
// =============================================================================

export interface HUIConfig {
  mode: HUIMode;
  deviceId: number;
  channel: number;
  numChannels: number;
  faderTouchSensitivity: number;
  displayEnabled: boolean;
  meterEnabled: boolean;
}

// =============================================================================
// HUI Messages
// =============================================================================

export interface HUIMessage {
  type: 'note' | 'cc' | 'pitchbend' | 'sysex';
  status: number;
  channel: number;
  data1: number;
  data2: number;
  timestamp?: number;
}

export interface HUI_SYSEX_HEADER {
  manufacturer: number[];     // [0x00, 0x00, 0x66] for Digidesign
  model: number;
  deviceId: number;
}

// =============================================================================
// HUI Functions
// =============================================================================

// Create channel strip with defaults
export function createHUIChannelStrip(index: number): HUIChannelStrip {
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
    meterPeak: false,
  };
}

// Create default HUI state
export function createHUIState(config: HUIConfig): HUIState {
  const channels: HUIChannelStrip[] = [];
  for (let i = 0; i < config.numChannels; i++) {
    channels.push(createHUIChannelStrip(i));
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
    },
    timecode: {
      hours: 0,
      minutes: 0,
      seconds: 0,
      frames: 0,
      display: '00:00:00:00',
    },
    assignmentMode: 'fader',
    bankPosition: 0,
    connected: false,
  };
}

// Encode fader position to pitch bend (14-bit)
export function encodeHUIFaderPosition(position: number): [number, number] {
  const clamped = Math.max(0, Math.min(16383, position));
  return [clamped & 0x7F, (clamped >> 7) & 0x7F]; // LSB, MSB
}

// Decode fader position from pitch bend
export function decodeHUIFaderPosition(lsb: number, msb: number): number {
  return ((msb & 0x7F) << 7) | (lsb & 0x7F);
}

// Encode V-Pot position to CC value
export function encodeHUIVPot(position: number): number {
  return Math.max(0, Math.min(127, position));
}

// Decode V-Pot position from CC value
export function decodeHUIVPot(value: number): number {
  return value & 0x7F;
}

// Create scribble strip update SysEx
export function createScribbleStripUpdate(
  channel: number,
  name: string,
  deviceId: number = 0
): number[] {
  const header: number[] = [
    HUI_STATUS.SYSEX,
    0x00, 0x00, 0x66,  // Digidesign manufacturer ID
    0x10,              // HUI model
    deviceId,
    0x12,              // Scribble strip command
    channel,
  ];

  // Pad name to 6 characters
  const paddedName = name.padEnd(6, ' ').slice(0, 6);
  const data: number[] = [];
  for (let i = 0; i < 6; i++) {
    data.push(paddedName.charCodeAt(i) & 0x7F);
  }

  return [...header, ...data, HUI_STATUS.SYSEX_END];
}

// Create meter display update
export function createMeterUpdate(
  channel: number,
  level: number,
  peak: boolean
): number[] {
  return [
    HUI_STATUS.CONTROL_CHANGE | HUI_CHANNEL,
    HUICC.VPOT_1 + channel,
    (peak ? 0x40 : 0x00) | (level & 0x0F),
  ];
}

// Create timecode display update
export function createTimecodeDisplayHUI(
  timecode: HUITimecode,
  deviceId: number = 0
): number[] {
  const header: number[] = [
    HUI_STATUS.SYSEX,
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

  return [...header, ...data, HUI_STATUS.SYSEX_END];
}

// Create V-Pot LED update
export function createHUIVPotLEDUpdate(
  channel: number,
  position: number,
  mode: number = 0
): number[] {
  return [
    HUI_STATUS.CONTROL_CHANGE | HUI_CHANNEL,
    HUICC.VPOT_1 + channel,
    (mode << 4) | (position & 0x0F),
  ];
}


