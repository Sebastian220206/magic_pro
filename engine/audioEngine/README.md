# Advanced Audio Engine Architecture

## Overview

A modular, low-latency audio engine for browser DAW built with Web Audio API.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Audio Engine Core                      │
├─────────────────────────────────────────────────────────────┤
│  audioContext.ts     - AudioContext management          │
│  scheduler.ts        - Low-latency clip scheduling      │
│  recordingEngine.ts  - Audio recording & capture        │
│  routingEngine.ts    - Audio routing & processing       │
│  bufferCache.ts      - AudioBuffer memory management     │
│  bounceEngine.ts     - Offline rendering & export       │
└─────────────────────────────────────────────────────────────┘
```

## Signal Flow

```
Input Devices → RecordingEngine → RoutingEngine → Scheduler → AudioContext → Output
     ↓                ↓                ↓           ↓            ↓
  Microphone     AudioBuffer     Track Buses   Scheduled    Speakers
  Line Input        Cache        Effects      Sources
```

## Core Features

### 1. Low Latency Scheduling
- 25-100ms lookahead scheduling
- AudioContext.currentTime based timing
- Prevents timing drift with correction loops
- Multi-track efficient scheduling

### 2. Audio Recording
- getUserMedia microphone capture
- Real-time AudioBuffer storage
- Automatic clip creation from recordings
- Input monitoring with latency compensation

### 3. Audio Routing
- Flexible input → track → master routing
- Per-track insert effects chains
- Send/return bus architecture
- Low-latency monitoring

### 4. Buffer Management
- Intelligent AudioBuffer caching
- Memory-efficient storage
- Automatic cleanup of unused buffers
- Fast lookup by file ID

### 5. Offline Bounce
- OfflineAudioContext rendering
- Whole timeline export
- Multiple format support (WAV, MP3)
- Real-time progress reporting

### 6. Time Stretching & Pitch Shifting
- playbackRate based time stretching
- detune property pitch shifting
- Tempo change compensation
- Clip alignment preservation

## File Structure

```
audioEngine/
├── audioContext.ts     # AudioContext singleton & management
├── scheduler.ts        # Advanced clip scheduling system
├── recordingEngine.ts  # Audio recording & input handling
├── routingEngine.ts    # Audio routing & track processing
├── bufferCache.ts      # AudioBuffer cache & memory management
├── bounceEngine.ts     # Offline rendering & export
├── types.ts           # Shared type definitions
└── index.ts           # Main engine exports
```

## Integration

The engine integrates with React components through Zustand store:

```typescript
// Store integration
useAudioPlayer() {
  // Initialize engine modules
  // Handle playback state
  // Manage recording state
  // Process routing changes
}
```

## Performance Optimizations

- **Lookahead Scheduling**: 50ms scheduling window
- **Batch Processing**: Group audio operations per frame
- **Memory Pooling**: Reuse AudioBuffers when possible
- **Lazy Loading**: Load audio only when needed
- **Garbage Collection**: Automatic cleanup of unused resources

## Browser Compatibility

- Chrome/Edge: Full feature support
- Firefox: Full feature support
- Safari: Limited getUserMedia support
- Mobile: Reduced feature set for performance
