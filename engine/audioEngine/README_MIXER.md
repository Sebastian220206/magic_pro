# Professional DAW Mixer Architecture

## Overview

This document describes the architecture of a professional channel strip mixer system for a browser-based DAW, similar to Logic Pro or Ableton Live.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DAW MIXER ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUDIO SIGNAL FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

Track Channel Strip:
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Input Source (Audio Clip / Instrument / Input)                       │
│        ↓                                                                │
│   ┌─────────┐                                                           │
│   │  Gain   │  ← Volume fader (-∞ to +12dB)                             │
│   │  Node   │                                                           │
│   └────┬────┘                                                           │
│        ↓                                                                │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │                    INSERT EFFECTS CHAIN                        │    │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐      ┌─────────┐      │    │
│   │  │ Slot 1  │→ │ Slot 2  │→ │ Slot 3  │ →...→│ Slot 8  │      │    │
│   │  │   EQ    │  │  Comp   │  │ Reverb  │      │ Limiter │      │    │
│   │  └─────────┘  └─────────┘  └─────────┘      └─────────┘      │    │
│   │     ↑           ↑           ↑                  ↑              │    │
│   │  [bypass]    [bypass]   [bypass]           [bypass]         │    │
│   └─────────────────────────────────────────────────────────────────┘    │
│        ↓                                                                │
│   ┌─────────┐                                                           │
│   │   Pan   │  ← Stereo panning (-100% to +100%)                        │
│   │  Node   │                                                           │
│   └────┬────┘                                                           │
│        ↓                                                                │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │                      BUS SENDS                               │    │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │    │
│   │  │ Send A  │  │ Send B  │  │ Send C  │  │ Send D  │          │    │
│   │  │ [pre]   │  │ [post]  │  │ [post]  │  │ [pre]   │          │    │
│   │  │  0dB    │  │  -6dB   │  │  -12dB  │  │  -3dB   │          │    │
│   │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │    │
│   │       │            │            │            │               │    │
│   │       └────────────┴────────────┴────────────┘               │    │
│   │                    ↓                                          │    │
│   │              Aux Bus Channels                                │    │
│   └─────────────────────────────────────────────────────────────────┘    │
│        ↓                                                                │
│   ┌─────────┐                                                           │
│   │  Meter  │  ← Real-time peak/RMS analysis                            │
│   │  Node   │                                                           │
│   └────┬────┘                                                           │
│        ↓                                                                │
│   ┌─────────┐                                                           │
│   │ Output  │  → To Master Bus                                           │
│   │  Node   │                                                           │
│   └─────────┘                                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Master Bus:
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   All Track Outputs                                                      │
│        ↓                                                                │
│   ┌─────────┐                                                           │
│   │  Gain   │  ← Master fader                                           │
│   │  Node   │                                                           │
│   └────┬────┘                                                           │
│        ↓                                                                │
│   ┌─────────┐                                                           │
│   │  Meter  │  ← Master metering                                        │
│   │  Node   │                                                           │
│   └────┬────┘                                                           │
│        ↓                                                                │
│   ┌─────────┐                                                           │
│   │ Limiter │  ← Master protection                                       │
│   │  Slot   │                                                           │
│   └────┬────┘                                                           │
│        ↓                                                                │
│   ┌─────────┐                                                           │
│   │ Output  │  → Audio destination (speakers/headphones)                 │
│   └─────────┘                                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Structure

```
engine/audioEngine/
├── channelStrip.ts       # Channel strip with gain, pan, inserts, sends, meter
├── insertChain.ts        # Insert effects chain management
├── busRouting.ts         # Bus send system with pre/post fader
├── masterBus.ts          # Master channel strip
├── audioMeter.ts         # Real-time peak/RMS metering
├── pluginHost.ts         # Plugin loading and management
└── plugins/
    ├── basePlugin.ts     # Base plugin class
    ├── eqPlugin.ts       # Parametric EQ
    ├── compressorPlugin.ts # Dynamics processor
    └── reverbPlugin.ts   # Convolution/algorithmic reverb

components/mixer/
├── MixerChannel.tsx      # Complete channel strip UI
├── MixerFader.tsx        # Volume fader with dB scale
├── MixerPanKnob.tsx      # Pan control (-100% to +100%)
├── MixerSendKnob.tsx     # Send level knobs (A-D)
├── MixerInsertSlot.tsx   # Insert effect slot UI
├── MixerMeter.tsx        # Peak/RMS meter with hold
└── MasterChannel.tsx     # Master channel strip UI

store/
└── mixerStore.ts         # Zustand store for mixer state
```

## Web Audio Graph Structure

### Channel Strip Nodes

```typescript
interface ChannelStripNodes {
  input: GainNode;              // Input gain stage
  insertIn: GainNode;           // Insert chain input
  inserts: AudioNode[];         // Array of plugin nodes
  insertOut: GainNode;        // Insert chain output
  preFaderSendTap: GainNode;    // Pre-fader send tap
  panner: StereoPannerNode;     // Pan control
  postFaderSendTap: GainNode;  // Post-fader send tap
  sends: Map<string, GainNode>; // Send level nodes
  meter: AnalyserNode;          // Analysis for metering
  output: GainNode;             // Final output gain
}
```

### Signal Flow Connections

```
input → insertIn → [inserts chain] → insertOut → preFaderSendTap
                                                   ↓
                                              sends (pre)
                                                   ↓
                                               panner
                                                   ↓
                                            postFaderSendTap
                                                   ↓
                                              sends (post)
                                                   ↓
                                               meter
                                                   ↓
                                              output
```

## State Management

### Mixer State (Zustand)

```typescript
interface MixerState {
  // Channel strips
  channels: Map<string, ChannelStripState>;
  
  // Master bus
  masterBus: MasterBusState;
  
  // Selection
  selectedChannelId: string | null;
  
  // Plugin registry
  pluginRegistry: Map<string, PluginDefinition>;
  
  // UI state
  mixerConfig: {
    meterRefreshRate: number;
    faderResolution: number;
    showPeakHold: boolean;
    meterBallistics: 'fast' | 'slow';
  };
}

interface ChannelStripState {
  id: string;
  name: string;
  volume: number;        // 0-1 (maps to -∞ to +12dB)
  pan: number;           // -1 to +1
  mute: boolean;
  solo: boolean;
  arm: boolean;
  inserts: InsertSlotState[];
  sends: Map<string, SendState>;
  meterData: MeterData;
}

interface InsertSlotState {
  slotIndex: number;
  pluginId: string | null;
  pluginInstanceId: string | null;
  bypass: boolean;
  enabled: boolean;
}

interface SendState {
  busId: string;
  level: number;         // 0-1
  preFader: boolean;
  enabled: boolean;
}

interface MasterBusState {
  volume: number;
  meterData: MeterData;
  limiterEnabled: boolean;
  limiterThreshold: number;
}

interface MeterData {
  peakLeft: number;
  peakRight: number;
  rmsLeft: number;
  rmsRight: number;
  peakHoldLeft: number;
  peakHoldRight: number;
  clipLeft: boolean;
  clipRight: boolean;
}
```

## Performance Considerations

### Audio Thread
- All audio processing happens in Web Audio graph
- No JavaScript in audio callback
- Plugins use native Web Audio nodes or AudioWorklet

### UI Thread
- Meter updates via requestAnimationFrame (30-60fps)
- Fader/pan updates throttle to 16ms
- Zustand selectors for fine-grained updates
- React.memo on all mixer components

### Memory Management
- Plugin nodes disconnected when removed
- AnalyserNode buffer size optimized
- LRU cache for plugin parameters

## File Structure

```
engine/audioEngine/
├── README_MIXER.md              # This file
├── channelStrip.ts              # Channel strip implementation
├── insertChain.ts               # Insert chain management
├── busRouting.ts                # Bus send system
├── masterBus.ts                 # Master bus implementation
├── audioMeter.ts                # Metering system
├── pluginHost.ts                # Plugin host
└── plugins/
    ├── basePlugin.ts
    ├── eqPlugin.ts
    ├── compressorPlugin.ts
    └── reverbPlugin.ts

components/mixer/
├── MixerChannel.tsx
├── MixerFader.tsx
├── MixerPanKnob.tsx
├── MixerSendKnob.tsx
├── MixerInsertSlot.tsx
├── MixerMeter.tsx
└── MasterChannel.tsx

store/
└── mixerStore.ts

hooks/
└── useAudioMeter.ts
```

## API Reference

### ChannelStrip

```typescript
class ChannelStrip {
  constructor(audioContext: AudioContext, id: string);
  
  // Volume
  setVolume(db: number): void;
  getVolume(): number;
  
  // Pan
  setPan(value: number): void;  // -1 to 1
  getPan(): number;
  
  // Mute/Solo
  setMute(mute: boolean): void;
  setSolo(solo: boolean): void;
  
  // Inserts
  addPlugin(slot: number, plugin: AudioPlugin): void;
  removePlugin(slot: number): void;
  reorderPlugins(fromSlot: number, toSlot: number): void;
  setPluginBypass(slot: number, bypass: boolean): void;
  
  // Sends
  setSendLevel(sendId: string, db: number): void;
  setSendPreFader(sendId: string, preFader: boolean): void;
  enableSend(sendId: string, enabled: boolean): void;
  
  // Meter
  getMeterData(): MeterData;
  
  // Output
  connect(destination: AudioNode): void;
  disconnect(): void;
}
```

### MasterBus

```typescript
class MasterBus {
  constructor(audioContext: AudioContext);
  
  setVolume(db: number): void;
  getVolume(): number;
  
  enableLimiter(enabled: boolean): void;
  setLimiterThreshold(db: number): void;
  
  getMeterData(): MeterData;
  
  connect(destination: AudioDestinationNode): void;
}
```

### AudioMeter

```typescript
class AudioMeter {
  constructor(analyserNode: AnalyserNode, options?: MeterOptions);
  
  start(): void;
  stop(): void;
  
  getPeak(channel: number): number;
  getRMS(channel: number): number;
  getPeakHold(channel: number): number;
  resetPeakHold(): void;
  
  onUpdate(callback: (data: MeterData) => void): void;
}
```

## Integration with Timeline

```typescript
// Connect clip playback to mixer
function connectClipToMixer(
  clipSource: AudioBufferSourceNode,
  channelStrip: ChannelStrip
): void {
  clipSource.connect(channelStrip.input);
}

// Connect mixer to master
function connectMixerToMaster(
  channelStrip: ChannelStrip,
  masterBus: MasterBus
): void {
  channelStrip.connect(masterBus.input);
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `M` | Toggle mute on selected channel |
| `S` | Toggle solo on selected channel |
| `↑/↓` | Select previous/next channel |
| `F` | Focus volume fader on selected channel |
| `0` | Reset fader to 0dB |
| `Ctrl+M` | Mute all |
| `Ctrl+S` | Solo clear all |

## Future Enhancements

1. **Sidechain routing** for ducking effects
2. **VCA groups** for grouped fader control
3. **Automation lanes** for mixer parameters
4. **Surround panning** (5.1/7.1)
5. **External hardware** integration via MIDI
6. **Plugin delay compensation**
7. **Freeze/Render** tracks to audio
