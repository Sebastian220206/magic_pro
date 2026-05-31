# DAW Project File System Architecture

## Overview

This document describes the architecture of a professional DAW project file system for a browser-based digital audio workstation, similar to Logic Pro or Ableton Live.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DAW PROJECT FILE SYSTEM                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────┘

Project Data Flow:
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROJECT MANAGER                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   create()   │  │   save()     │  │   load()     │  │   export()   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘      │
│        ↓                  ↓                 ↓                 ↓               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     PROJECT SERIALIZER                                   │ │
│  │  • Convert app state → project.json                                    │ │
│  │  • Convert project.json → app state                                    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     INDEXEDDB ADAPTER                                    │ │
│  │  • Store projects                                                        │ │
│  │  • Store audio assets                                                    │ │
│  │  • Store waveform cache                                                  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     ASSET MANAGER                                        │ │
│  │  • Audio file management                                                 │ │
│  │  • Deduplication                                                         │ │
│  │  • Lazy loading                                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

Storage Structure:

IndexedDB: DAWProjectsDB
├── Projects Store
│   ├── project_metadata
│   ├── project_json
│   └── version_history
├── Assets Store
│   ├── audio_buffers (ArrayBuffer)
│   ├── waveform_cache
│   └── asset_metadata
└── Settings Store
    ├── user_preferences
    └── recent_projects

Project File Structure:
/project_name/
├── project.json           # Main project file
├── /audio                 # Imported audio files
│   ├── kick_001.wav
│   ├── snare_003.wav
│   └── hihat_002.wav
├── /midi                  # MIDI clip data
│   ├── clip_001.json
│   └── clip_002.json
├── /waveforms             # Pre-computed waveform data
│   ├── kick_001.peak
│   └── snare_003.peak
├── /renders               # Bounced/frozen tracks
│   ├── track_1_render.wav
│   └── track_2_render.wav
├── /plugins               # Plugin state files
│   ├── eq_state.json
│   └── reverb_state.json
└── /backups               # Auto-save backups
    ├── backup_001.json
    └── backup_002.json
```

## Project File Format

### project.json Schema
```json
{
  "format": "daw-project-v1",
  "project": {
    "id": "uuid",
    "name": "My Song",
    "createdAt": "2024-01-15T10:30:00Z",
    "modifiedAt": "2024-01-15T14:20:00Z",
    "version": 12
  },
  "timeline": {
    "tempo": 120,
    "timeSignature": { "numerator": 4, "denominator": 4 },
    "startBeat": 0,
    "endBeat": 256,
    "loop": { "enabled": false, "start": 0, "end": 16 }
  },
  "tracks": [
    {
      "id": "track-1",
      "name": "Kick",
      "type": "audio",
      "color": "#3B82F6",
      "muted": false,
      "soloed": false,
      "volume": 0,
      "pan": 0,
      "clips": [
        {
          "id": "clip-1",
          "startBeat": 0,
          "duration": 4,
          "assetId": "audio-001",
          "fadeIn": 0.01,
          "fadeOut": 0.01
        }
      ]
    }
  ],
  "midiClips": [
    {
      "id": "midi-1",
      "trackId": "track-2",
      "startBeat": 0,
      "length": 4,
      "notes": [
        { "pitch": 60, "velocity": 100, "startBeat": 0, "duration": 0.5 }
      ]
    }
  ],
  "mixer": {
    "master": { "volume": 0, "limiter": true },
    "channels": [
      { "trackId": "track-1", "volume": 0, "pan": 0, "sends": [] }
    ]
  },
  "automation": {
    "track-1": [
      { "param": "volume", "points": [{ "beat": 0, "value": 0 }, { "beat": 4, "value": -6 }] }
    ]
  },
  "markers": [
    { "beat": 0, "name": "Intro", "color": "#10B981" },
    { "beat": 32, "name": "Verse 1", "color": "#3B82F6" }
  ],
  "assets": [
    {
      "id": "audio-001",
      "type": "audio",
      "name": "kick_drum.wav",
      "hash": "sha256:abc123...",
      "duration": 2.5,
      "sampleRate": 44100,
      "channels": 2
    }
  ],
  "plugins": []
}
```

## Component Structure

```
engine/filesystem/
├── README_PROJECT.md         # This file
├── indexedDBAdapter.ts     # IndexedDB interface
├── projectManager.ts       # Project CRUD operations
├── assetManager.ts         # Audio asset management
├── projectSerializer.ts    # State serialization
├── autosaveManager.ts      # Auto-save system
├── versionManager.ts       # Version history
├── exportManager.ts        # Export system
├── importManager.ts        # Import system
└── waveformCache.ts        # Waveform caching

components/filesystem/
├── ProjectBrowser.tsx      # Project list/manager
├── ProjectCard.tsx         # Project thumbnail card
├── FileExplorer.tsx        # File tree view
├── ImportDialog.tsx        # Import modal
├── ExportDialog.tsx        # Export modal
├── SaveProjectDialog.tsx   # Save dialog
├── RecentProjects.tsx      # Recent projects list
└── ProjectSettings.tsx     # Project configuration
```

## API Reference

### ProjectManager
```typescript
class ProjectManager {
  // Lifecycle
  createProject(name: string, template?: string): Promise<Project>;
  saveProject(project: Project): Promise<void>;
  loadProject(projectId: string): Promise<Project>;
  closeProject(): Promise<void>;
  
  // Management
  renameProject(projectId: string, newName: string): Promise<void>;
  duplicateProject(projectId: string, newName: string): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;
  
  // Queries
  listProjects(): Promise<ProjectMetadata[]>;
  getProjectMetadata(projectId: string): Promise<ProjectMetadata>;
  
  // Import/Export
  exportProject(projectId: string, format: 'zip' | 'json'): Promise<Blob>;
  importProject(file: File): Promise<Project>;
}
```

### AssetManager
```typescript
class AssetManager {
  // Import
  importAudio(file: File): Promise<AudioAsset>;
  importMidi(file: File): Promise<MidiAsset>;
  
  // Management
  getAsset(assetId: string): Promise<Asset>;
  deleteAsset(assetId: string): Promise<void>;
  
  // Deduplication
  findDuplicate(file: File): Promise<Asset | null>;
  
  // Lazy loading
  loadAudioBuffer(assetId: string): Promise<AudioBuffer>;
  unloadAudioBuffer(assetId: string): void;
}
```

### IndexedDBAdapter
```typescript
class IndexedDBAdapter {
  // Projects
  saveProject(projectId: string, data: ProjectData): Promise<void>;
  loadProject(projectId: string): Promise<ProjectData>;
  deleteProject(projectId: string): Promise<void>;
  listProjects(): Promise<ProjectMetadata[]>;
  
  // Assets
  saveAsset(assetId: string, buffer: ArrayBuffer, metadata: AssetMetadata): Promise<void>;
  loadAsset(assetId: string): Promise<{ buffer: ArrayBuffer; metadata: AssetMetadata }>;
  deleteAsset(assetId: string): Promise<void>;
  
  // Waveforms
  saveWaveform(assetId: string, peaks: Float32Array): Promise<void>;
  loadWaveform(assetId: string): Promise<Float32Array | null>;
}
```

## Performance Strategy

### Storage
- **Audio Buffers**: Stored as ArrayBuffer in IndexedDB (binary storage)
- **Waveform Cache**: Pre-computed peaks stored as Float32Array
- **Project JSON**: Stored as serialized string with compression
- **Lazy Loading**: Audio buffers loaded on-demand, not at project open

### Memory Management
- **Reference Counting**: Track which clips use which assets
- **Garbage Collection**: Unload unused audio buffers after timeout
- **Streaming**: Large files use chunked reading

### Transactions
- **Batch Operations**: Group multiple saves into single transaction
- **Write-Ahead**: Save to temp location first, then commit
- **Rollback**: Ability to cancel incomplete saves

## File Browser Features

### Project Browser
- Grid/list view of projects
- Search and filter
- Sort by date/name
- Thumbnail preview
- Right-click context menu

### File Explorer
- Tree view of project files
- Drag and drop import
- File metadata display
- Duplicate detection
- Batch operations

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+S` | Save project |
| `Cmd+Shift+S` | Save as... |
| `Cmd+O` | Open project |
| `Cmd+N` | New project |
| `Cmd+W` | Close project |
| `Cmd+E` | Export project |
| `Cmd+I` | Import file |
| `Cmd+Z` | Undo (with auto-save) |
| `Cmd+Shift+Z` | Redo |

## Future Enhancements

1. **Cloud Sync**: Synchronize projects across devices
2. **Collaboration**: Real-time collaborative editing
3. **Templates**: Project templates and presets
4. **Media Bay**: Centralized asset library
5. **Project Pool**: Manage unused/temp files
6. **Backup to Cloud**: Automatic cloud backups
7. **Project Analytics**: File size breakdown, asset usage

## Security Considerations

1. **Sandbox**: All file operations within browser sandbox
2. **Encryption**: Optional project password protection
3. **Validation**: Validate all imported files for corruption
4. **Quota Management**: Monitor storage quota, warn user

## References

- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- File System Access API: https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
- File API: https://developer.mozilla.org/en-US/docs/Web/API/File
- JSZip: https://stuk.github.io/jszip/
