/**
 * MIDI Sync Types - MTC (MIDI Time Code) and MMC (MIDI Machine Control)
 *
 * MTC (MIDI Time Code):
 * - Synchronizes playback position between devices
 * - Quarter-frame messages for continuous sync
 * - Full-frame messages for position display
 * - Supports 24/25/29.97/30 fps frame rates
 *
 * MMC (MIDI Machine Control):
 * - Controls transport functions (play, stop, record, etc.)
 * - Based on SysEx messages
 * - Supports basic and extended commands
 */

// =============================================================================
// MTC (MIDI Time Code) Types
// =============================================================================

export type MTCFrameRate = 24 | 25 | 29.97 | 30;

export interface MTCFrameRateConfig {
  rate: MTCFrameRate;
  name: string;
  dropFrame: boolean;
  framesPerSecond: number;
}

export const MTC_FRAME_RATES: Record<MTCFrameRate, MTCFrameRateConfig> = {
  24: { rate: 24, name: '24 fps', dropFrame: false, framesPerSecond: 24 },
  25: { rate: 25, name: '25 fps', dropFrame: false, framesPerSecond: 25 },
  29.97: { rate: 29.97, name: '29.97 fps (DF)', dropFrame: true, framesPerSecond: 29.97 },
  30: { rate: 30, name: '30 fps', dropFrame: false, framesPerSecond: 30 },
};

export interface MTCTimecode {
  hours: number;        // 0-23
  minutes: number;      // 0-59
  seconds: number;      // 0-59
  frames: number;       // 0-29 (depends on frame rate)
  frameRate: MTCFrameRate;
  totalFrames: number;  // Total frame count from 00:00:00:00
}

export type MTCMessageType = 'quarter-frame' | 'full-frame';

export interface MTCQuarterFrame {
  type: 'quarter-frame';
  nibbleType: MTCNibbleType;
  value: number;        // 0-15 (4-bit nibble)
}

export type MTCNibbleType =
  | 'frame-lsb'       // Frame count low nibble
  | 'frame-msb'       // Frame count high nibble
  | 'second-lsb'      // Seconds low nibble
  | 'second-msb'      // Seconds high nibble
  | 'minute-lsb'      // Minutes low nibble
  | 'minute-msb'      // Minutes high nibble
  | 'hour-lsb'        // Hours low nibble
  | 'hour-msb';       // Hours high nibble + frame rate bits

export interface MTCFullFrame {
  type: 'full-frame';
  timecode: MTCTimecode;
}

export type MTCMessage = MTCQuarterFrame | MTCFullFrame;

// =============================================================================
// MTC Sync State
// =============================================================================

export type MTCSyncMode = 'internal' | 'mtc-master' | 'mtc-slave' | 'midi-clock';

export type MTCSyncStatus = 'synced' | 'syncing' | 'unsynced' | 'waiting' | 'error';

export interface MTCSyncState {
  mode: MTCSyncMode;
  status: MTCSyncStatus;
  currentTimecode: MTCTimecode;
  receivedTimecode: MTCTimecode | null;
  frameRate: MTCFrameRate;
  syncOffset: number;          // ms offset for alignment
  drift: number;               // Current drift in ms
  lastSyncTime: number;        // Timestamp of last sync message
  quarterFrameCount: number;   // Count of received quarter frames
  fullFrameCount: number;      // Count of received full frames
}

// =============================================================================
// MTC Configuration
// =============================================================================

export interface MTCSyncConfig {
  mode: MTCSyncMode;
  frameRate: MTCFrameRate;
  syncOffset: number;          // ms
  autoDetectFrameRate: boolean;
  sendMTC: boolean;            // Send MTC when acting as master
  receiveMTC: boolean;         // Receive MTC when acting as slave
  syncTimeout: number;         // ms before considering sync lost
  driftCompensation: boolean;  // Auto-correct drift
  midiChannel: number;         // 0-15 for MTC messages
}

// =============================================================================
// MMC (MIDI Machine Control) Types
// =============================================================================

export type MMCCommand =
  | 'stop'
  | 'play'
  | 'record'
  | 'pause'
  | 'fast-forward'
  | 'rewind'
  | 'loop-on'
  | 'loop-off'
  | 'goto-zero'
  | 'goto-start'
  | 'goto-end'
  | 'shuttle';            // Variable speed playback

export type MMCMode = 'basic' | 'extended';

export interface MMCMessage {
  command: MMCCommand;
  mode: MMCMode;
  data?: number;          // For shuttle speed (0-127)
  deviceId: number;       // MMC device ID (0-127, 127 = all devices)
}

export interface MMCControlMessage {
  type: 'mmc';
  command: MMCCommand;
  deviceId: number;
  data?: number;
}

// =============================================================================
// MMC State
// =============================================================================

export type MMCMode_ = 'internal' | 'mmc-master' | 'mmc-slave';

export interface MMCState {
  mode: MMCMode_;
  deviceId: number;           // Our device ID
  lastCommand: MMCCommand | null;
  lastCommandTime: number;
  commandHistory: MMCCommandHistory[];
  isPlaying: boolean;
  isRecording: boolean;
  isPaused: boolean;
}

export interface MMCCommandHistory {
  command: MMCCommand;
  timestamp: number;
  fromDevice: number;
}

// =============================================================================
// MMC Configuration
// =============================================================================

export interface MMCConfig {
  mode: MMCMode_;
  deviceId: number;
  sendMMC: boolean;           // Send MMC commands when acting as master
  receiveMMC: boolean;        // Receive MMC commands when acting as slave
  respondToAllDevices: boolean; // Respond to MMC from any device ID
  commandHistorySize: number; // Max commands to keep in history
}

// =============================================================================
// Combined Sync Types
// =============================================================================

export type SyncMode = 'internal' | 'mtc-master' | 'mtc-slave' | 'mmc-master' | 'mmc-slave' | 'combined-master' | 'combined-slave';

export interface ExternalSyncConfig {
  mtc: MTCSyncConfig;
  mmc: MMCConfig;
  mode: SyncMode;
  enabled: boolean;
}

export interface ExternalSyncState {
  mtc: MTCSyncState;
  mmc: MMCState;
  mode: SyncMode;
  enabled: boolean;
  connected: boolean;
}

// =============================================================================
// MIDI Clock Types (additional sync method)
// =============================================================================

export interface MIDIClockState {
  bpm: number;              // Tempo from MIDI clock
  ticksPerBeat: 24;         // Always 24 ticks per quarter note
  tickCount: number;        // Total ticks received
  lastTickTime: number;     // Timestamp of last tick
  songPosition: number;     // Song position pointer (in 16th notes)
  songPositionHigh: number; // MSB
  songPositionLow: number;  // LSB
}

export interface MIDIClockConfig {
  sendClock: boolean;
  receiveClock: boolean;
  sendSongPosition: boolean;
  receiveSongPosition: boolean;
  sendStart: boolean;
  receiveStart: boolean;
  sendContinue: boolean;
  receiveContinue: boolean;
  sendStop: boolean;
  receiveStop: boolean;
}

// =============================================================================
// SysEx Constants
// =============================================================================

export const MMC_SYSEX_HEADER = [0xF0, 0x7F, 0x7F, 0x01]; // F0 7F 7F 01
export const MMC_SYSEX_END = 0xF7;

export const MMC_COMMAND_BYTES: Record<MMCCommand, number> = {
  'stop': 0x01,
  'play': 0x02,
  'record': 0x06,
  'pause': 0x09,
  'fast-forward': 0x04,
  'rewind': 0x05,
  'loop-on': 0x0B,
  'loop-off': 0x0C,
  'goto-zero': 0x01,
  'goto-start': 0x01,
  'goto-end': 0x01,
  'shuttle': 0x44,
};

export const MMC_DEVICE_ALL = 0x7F;

// =============================================================================
// Helper Functions
// =============================================================================

export function createTimecode(
  hours: number,
  minutes: number,
  seconds: number,
  frames: number,
  frameRate: MTCFrameRate
): MTCTimecode {
  const framesPerSecond = MTC_FRAME_RATES[frameRate].framesPerSecond;
  const totalFrames = Math.floor(
    hours * 3600 * framesPerSecond +
    minutes * 60 * framesPerSecond +
    seconds * framesPerSecond +
    frames
  );

  return {
    hours: Math.max(0, Math.min(23, hours)),
    minutes: Math.max(0, Math.min(59, minutes)),
    seconds: Math.max(0, Math.min(59, seconds)),
    frames: Math.max(0, Math.min(Math.floor(framesPerSecond) - 1, frames)),
    frameRate,
    totalFrames,
  };
}

export function timecodeToString(tc: MTCTimecode): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(tc.hours)}:${pad(tc.minutes)}:${pad(tc.seconds)}:${pad(tc.frames)}`;
}

export function timecodeToSeconds(tc: MTCTimecode): number {
  const fps = MTC_FRAME_RATES[tc.frameRate].framesPerSecond;
  return tc.hours * 3600 + tc.minutes * 60 + tc.seconds + tc.frames / fps;
}

export function secondsToTimecode(seconds: number, frameRate: MTCFrameRate): MTCTimecode {
  const fps = MTC_FRAME_RATES[frameRate].framesPerSecond;
  const totalFrames = Math.floor(seconds * fps);

  const frames = totalFrames % Math.floor(fps);
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hrs = Math.floor(totalMinutes / 60);

  return createTimecode(hrs, mins, secs, frames, frameRate);
}

export function beatsToTimecode(
  beats: number,
  bpm: number,
  frameRate: MTCFrameRate
): MTCTimecode {
  const secondsPerBeat = 60 / bpm;
  const totalSeconds = beats * secondsPerBeat;
  return secondsToTimecode(totalSeconds, frameRate);
}

export function timecodeToBeats(
  tc: MTCTimecode,
  bpm: number
): number {
  const seconds = timecodeToSeconds(tc);
  const secondsPerBeat = 60 / bpm;
  return seconds / secondsPerBeat;
}

export function createTimecodeFromBytes(
  bytes: number[],
  frameRate: MTCFrameRate
): MTCTimecode {
  return createTimecode(
    bytes[3] & 0x1F,  // Hours (5 bits)
    bytes[2],         // Minutes
    bytes[1],         // Seconds
    bytes[0] & 0x1F,  // Frames (5 bits)
    frameRate
  );
}

export function timecodeToBytes(tc: MTCTimecode): number[] {
  return [
    tc.frames & 0x1F,
    tc.seconds,
    tc.minutes,
    (tc.hours & 0x1F) | ((MTC_FRAME_RATES[tc.frameRate].dropFrame ? 1 : 0) << 6),
  ];
}

export function createTimecodeFromQuarterFrames(nibbles: number[]): MTCTimecode {
  if (nibbles.length < 8) {
    throw new Error('Need 8 quarter-frame nibbles to create timecode');
  }

  const frameLsb = nibbles[0] & 0x0F;
  const frameMsb = nibbles[1] & 0x0F;
  const secondLsb = nibbles[2] & 0x0F;
  const secondMsb = nibbles[3] & 0x0F;
  const minuteLsb = nibbles[4] & 0x0F;
  const minuteMsb = nibbles[5] & 0x0F;
  const hourLsb = nibbles[6] & 0x0F;
  const hourMsb = nibbles[7] & 0x0F;

  const frames = (frameMsb << 4) | frameLsb;
  const seconds = (secondMsb << 4) | secondLsb;
  const minutes = (minuteMsb << 4) | minuteLsb;
  const hours = (hourMsb << 4) | hourLsb;

  // Extract frame rate from hour MSB bits
  const rateBits = (hourMsb >> 1) & 0x03;
  let frameRate: MTCFrameRate;
  switch (rateBits) {
    case 0: frameRate = 24; break;
    case 1: frameRate = 25; break;
    case 2: frameRate = 29.97; break;
    case 3: frameRate = 30; break;
    default: frameRate = 30;
  }

  return createTimecode(hours, minutes, seconds, frames, frameRate);
}

export default ExternalSyncConfig;
