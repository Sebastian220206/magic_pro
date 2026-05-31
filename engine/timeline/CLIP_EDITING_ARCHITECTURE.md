# Professional Clip Editing System - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIP EDITING SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   ClipEditor    │────│   ClipTools     │────│  ClipRenderer   │        │
│  │   (Core)        │    │  (Operations)   │    │  (Visual)       │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│          │                     │                     │                    │
│          └─────────────────────┴─────────────────────┘                    │
│                              │                                          │
│                    ┌─────────┴─────────┐                                │
│                    │   Zustand Store   │                                │
│                    │   (State Mgmt)    │                                │
│                    └─────────┬─────────┘                                │
│                              │                                          │
│  ┌───────────────────────────┼───────────────────────────┐             │
│  │                           │                           │             │
│  ▼                           ▼                           ▼             │
│ ┌──────────────┐   ┌─────────────────┐   ┌─────────────────┐            │
│ │   Clip.tsx    │   │ ClipPlayback    │   │  AudioEngine    │            │
│ │  (Component)  │   │ Controller.ts   │   │  Integration    │            │
│ └──────────────┘   └─────────────────┘   └─────────────────┘            │
│       │                   │                                          │
│       ├───────────────────┤                                          │
│       │    Pointer Events │                                          │
│       │    RAF Updates    │                                          │
│       └───────────────────┘                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **User Interaction** → Pointer Events (drag, click, right-click)
2. **ClipEditor** → Calculates operations (trim, split, move)
3. **ClipTools** → Executes split/duplicate/trim logic
4. **Zustand Store** → Updates clip state immutably
5. **ClipRenderer** → Re-renders waveform with fades/stretch
6. **ClipPlaybackController** → Applies playback rate/fades to audio
7. **AudioEngine** → Schedules playback with transformations

## Performance Strategy

- **Pointer Events**: Use native pointerdown/pointermove/pointerup
- **RAF Updates**: Schedule visual updates via requestAnimationFrame
- **Memoization**: React.memo for Clip components with shallow comparison
- **Virtual Clips**: Only render visible clips in viewport
- **Canvas Waveforms**: Hardware-accelerated waveform rendering

## Core Concepts

### Clip Coordinates
- `startTime`: Beat position on timeline
- `duration`: Length in beats
- `offset`: Sample offset within audio buffer
- `trackY`: Vertical position in track lane

### Grid Snapping
- Snap divisions: 1/1, 1/2, 1/4, 1/8, 1/16, 1/32
- Dynamic based on zoom level
- Magnetic snap threshold: 8 pixels

### Handle Types
- `left`: Trim start / Fade in handle
- `right`: Trim end / Fade out handle / Stretch handle (with Shift)
- `body`: Move entire clip
- `fadeIn`: Fade in curve control
- `fadeOut`: Fade out curve control

### Multi-Selection
- `selectedClipIds`: Set of selected clip IDs
- `isShiftPressed`: Boolean for multi-select mode
- Bounding box for group move operations

## File Structure

```
timeline/
├── clipEditor.ts           # Core editing engine
├── clipTools.ts            # Clip operations (split, duplicate, etc.)
├── clipRenderer.ts         # Visual rendering utilities
└── types.ts              # Clip editing types

audioEngine/
└── clipPlaybackController.ts  # Playback with stretch/fades

components/
├── Clip.tsx               # Main clip component
├── ClipHandles.tsx        # Trim/stretch handles
├── ClipContextMenu.tsx    # Right-click menu
├── ClipWaveform.tsx       # Waveform display with fades
└── MultiClipSelection.tsx   # Selection box component

store/
└── clipActions.ts         # Zustand clip editing actions

hooks/
└── useClipEditing.ts      # Combined editing hook
```

## Key Features Implementation

### 1. Clip Trimming
- Detect handle drag (left/right edges)
- Calculate new startTime/duration based on drag delta
- Snap to grid if within threshold
- Minimum duration: 0.1 beats

### 2. Clip Splitting
- Tool mode activation
- Click at position creates two clips
- First clip: original start to split point
- Second clip: split point to original end
- Share same audio buffer reference

### 3. Clip Duplication
- Alt key detection during drag
- Create new clip with same buffer reference
- Offset position by 1 beat
- New unique ID

### 4. Fade In/Out
- Fade handles on clip edges
- Exponential gain curve
- Render on waveform as transparency gradient
- Adjustable duration (0-100% of clip)

### 5. Grid Snapping
- Calculate nearest grid line based on zoom
- Snap threshold: 8px
- Visual indicator when snapping

### 6. Clip Stretch
- Shift + right edge drag
- Adjust playbackRate (0.25x - 4x)
- Maintain pitch (time-stretch)
- Visual stretch indicator

### 7. Context Menu
- Right-click on clip
- Options: Split, Duplicate, Delete, Reverse, Normalize, Rename
- Positioned near cursor

### 8. Multi-Selection
- Shift + click to add/remove from selection
- Drag selection box
- Move all selected clips together
- Maintain relative positions
