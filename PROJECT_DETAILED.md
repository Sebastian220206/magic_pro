# Magic Pro DAW — Detailed Project Documentation

> **Generated:** June 21, 2026
> **Project:** `C:\personal\daw`
> **Type:** Browser-based Digital Audio Workstation
> **Stack:** Next.js 14 + TypeScript + Web Audio API + Zustand + Rust/WASM

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [Routing & Pages](#5-routing--pages)
6. [UI Component Layer](#6-ui-component-layer)
7. [State Management](#7-state-management)
8. [Audio Engine](#8-audio-engine)
9. [MIDI System](#9-midi-system)
10. [Instrument Engine](#10-instrument-engine)
11. [Automation System](#11-automation-system)
12. [Rendering Pipeline](#12-rendering-pipeline)
13. [Navigation System](#13-navigation-system)
14. [Editor & Tools](#14-editor--tools)
15. [Persistence & Filesystem](#15-persistence--filesystem)
16. [Database Schema](#16-database-schema)
17. [API Routes](#17-api-routes)
18. [WASM DSP Core](#18-wasm-dsp-core)
19. [TypeScript Errors & Build Status](#19-typescript-errors--build-status)
20. [Testing](#20-testing)
21. [Development Guide](#21-development-guide)
22. [Risks & Technical Debt](#22-risks--technical-debt)
23. [Roadmap Gaps](#23-roadmap-gaps)

---

## 1. Executive Summary

**Magic Pro DAW** is a feature-rich, in-progress browser-based Digital Audio Workstation. It implements a professional-grade multi-track audio/MIDI recording, editing, and mixing environment entirely in the browser using Web Audio API, AudioWorklets, and WebGL rendering.

### What It Does Well

- Multi-track timeline with audio/MIDI clips, drag-to-arrange, trimming, crossfading, looping
- Professional mixer with per-track channel strips, faders, pan, mute/solo, sends, effects chain
- Real-time audio scheduling with 25-50ms lookahead and drift correction
- Audio recording with live waveform display
- Piano roll MIDI editing (notes, velocity, automation, quantization, humanization)
- Automation with sample-accurate playback, Bezier curves, multiple curve types
- WebGL-accelerated rendering (notes, grid, curves)
- WASM DSP plugins (EQ, Compressor) via Rust
- Full project persistence to IndexedDB + PostgreSQL with autosave
- NextAuth-based authentication with credentials provider
- Project sharing (public read-only view)
- 5 project templates (Lo-Fi, Hip-Hop, Piano, EDM, Podcast)

### Scale

| Metric | Value |
|---|---|
| Source files (TS/TSX/JS/Rust/Prisma/CSS) | ~559 |
| Source lines of code | ~80,740 |
| Engine | 209 files, ~35,593 LOC |
| Components | 119 files, ~26,387 LOC |
| Store | 7 files, ~7,616 LOC |
| Largest single file | `store/projectStore.ts` — 4,819 lines |
| Git commits | 8 (2 branches) |
| TypeScript errors | **127** |

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 14.1.0 |
| **Language** | TypeScript | ^5 (strict: true) |
| **UI Library** | React | ^18 |
| **Styling** | Tailwind CSS | ^3.3 |
| **Icons** | lucide-react | ^0.344 |
| **State** | Zustand + immer | 4.5 / 10.2 |
| **Auth** | NextAuth.js | ^4.24 |
| **ORM** | Prisma | ^5.22 |
| **Database** | PostgreSQL (SQLite fallback) | — |
| **Audio** | Web Audio API + AudioWorklets | — |
| **DSP** | Rust → WebAssembly (wasm-bindgen) | — |
| **Rendering** | HTML Canvas + WebGL2 | — |
| **Testing** | Jest + ts-jest | ^30 |
| **Linting** | ESLint 8 + eslint-config-next | — |
| **Build** | PostCSS, Autoprefixer | — |

### Path Aliases

- `@/*` → `./*` (root)

### Cross-Origin Isolation

Configured in `next.config.js` for `SharedArrayBuffer` / AudioWorklet shared memory:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Resource-Policy: cross-origin`

---

## 3. Project Structure

```
C:\personal\daw\
├── app/                          # Next.js App Router (21 files, ~2,184 LOC)
│   ├── layout.tsx                # Root layout (dark theme, session)
│   ├── page.tsx                  # Root redirect (/welcome or /dashboard)
│   ├── providers.tsx             # SessionProvider + ToastProvider + EngineBoot
│   ├── middleware.ts             # NextAuth middleware (protects /account)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── welcome/page.tsx          # Onboarding / template selection
│   ├── dashboard/page.tsx        # Project list / new project
│   ├── project/[projectId]/page.tsx  # ★ Main DAW workspace (~361 LOC)
│   ├── p/[shareId]/page.tsx      # Public read-only project view
│   ├── account/page.tsx          # Account settings
│   ├── debug/runtime/page.tsx    # Runtime capabilities diagnostics
│   └── debug-audio/page.tsx      # Audio device diagnostics
│
├── app/api/                      # API routes
│   ├── auth/[...nextauth]/route.ts
│   ├── auth/signup/route.ts
│   ├── account/update/route.ts
│   ├── projects/route.ts
│   ├── project/save/route.ts
│   ├── project/[id]/route.ts
│   ├── project/[id]/share/route.ts
│   └── public/[shareId]/route.ts
│
├── components/                   # React UI (119 files, ~26,387 LOC)
│   ├── (85 root-level components)
│   ├── adapters/                 # ProjectPianoRollAdapter
│   ├── automation/               # AutomationCurve, Editor, Lane, Point
│   ├── debug/                    # AutomationRuntimeOverlay
│   ├── filesystem/               # ExportDialog, ImportDialog, ProjectBrowser
│   ├── layout/                   # DAWWorkspace, HorizontalSplitView, etc.
│   ├── midi/                     # MidiGrid, PianoRoll, PianoKeyboard, VelocityLane
│   ├── mixer/                    # ChannelStrip, Mixer, MixerFader, Meter, SendControls
│   └── plugins/                  # WasmEQUI, WasmCompressorUI
│
├── engine/                       # Core DAW engine (209 files, ~35,593 LOC)
│   ├── AudioEngineAdapter.ts     # Singleton audio facade (597 LOC)
│   ├── audioEngine/              # V2 modular audio engine (20 files)
│   │   ├── scheduler.ts          # Lookahead scheduler (583 LOC)
│   │   ├── audioContext.ts       # AudioContext singleton
│   │   ├── routingEngine.ts      # Signal routing (719 LOC)
│   │   ├── bufferCache.ts        # LRU audio buffer cache
│   │   ├── bounceEngine.ts       # Offline render/export
│   │   ├── channelStrip.ts       # Channel strip DSP
│   │   ├── masterBus.ts          # Master bus with limiter
│   │   ├── metronome.ts          # Click track
│   │   ├── recordingEngine.ts    # Recording sessions
│   │   ├── clipPlaybackController.ts
│   │   ├── clipDSP.ts
│   │   ├── audioMeter.ts
│   │   ├── nodePool.ts
│   │   ├── types.ts              # Shared type definitions (225 LOC)
│   │   ├── dsp/                  # Worklet processors
│   │   └── __tests__/            # Unit tests
│   │
│   ├── audioRecording/           # Recording pipeline (8 files)
│   │   ├── recorder.ts
│   │   ├── inputManager.ts
│   │   ├── bufferManager.ts
│   │   ├── wavEncoder.ts
│   │   ├── waveformAnalyzer.ts
│   │   ├── liveWaveform.ts
│   │   └── recordingClip.ts
│   │
│   ├── midi/                     # MIDI system (16 files, ~3,024 LOC)
│   │   ├── types.ts              # MIDI data model
│   │   ├── midiScheduler.ts      # Real-time MIDI scheduling
│   │   ├── midiEditor.ts         # Note editing operations (742 LOC)
│   │   ├── midiTransforms.ts     # Transpose, invert, humanize, quantize (516 LOC)
│   │   ├── MidiQuantizer.ts
│   │   ├── MidiRenderer.ts
│   │   ├── MidiHumanizer.ts
│   │   ├── MidiNoteIndex.ts      # O(log n) note lookup
│   │   ├── MidiCommands.ts       # Undoable MIDI commands
│   │   └── ...
│   │
│   ├── instruments/              # Instrument engine (12 files, ~2,831 LOC)
│   │   ├── synthEngine.ts        # PolyphonicSynth (ADSR, filters)
│   │   ├── samplerEngine.ts      # Sampler with multi-zone mapping
│   │   ├── drumMachine.ts        # Drum machine (trap, acoustic, 808)
│   │   ├── multiSamplerEngine.ts # DecentSampler format support
│   │   ├── instrumentFactory.ts
│   │   ├── instrumentRegistry.ts
│   │   ├── instrumentService.ts
│   │   └── midiIntegration.ts    # MIDI → instrument router
│   │
│   ├── automation/               # Automation system (12+ files, ~2,441 LOC)
│   │   ├── types.ts              # Core data models (366 LOC)
│   │   ├── curves.ts             # Curve interpolation engine (448 LOC)
│   │   ├── automationScheduler.ts # Real-time automation (567 LOC)
│   │   ├── parameterBinding.ts   # AudioParam binding (521 LOC)
│   │   ├── AutomationStateResolver.ts
│   │   ├── AutomationCommands.ts # Undoable commands
│   │   ├── compiler/             # Automation compilation
│   │   ├── cache/                # Spatial caching
│   │   ├── runtime/              # Sample-accurate runtime
│   │   └── rendering/            # Lane/Bezier rendering
│   │
│   ├── editor/                   # Editor interaction system (6 files)
│   │   ├── EditorCore.ts         # Bootstraps tools, selection, snap, coordinates
│   │   ├── ToolManager.ts        # Tool registry & switching
│   │   ├── SelectionManager.ts   # Clip/note/automation selection
│   │   ├── SnapEngine.ts         # Grid & object snapping
│   │   ├── CoordinateSystem.ts   # Screen ↔ musical unit mapping
│   │   └── tools/                # SelectTool, DrawTool, SplitTool, MarqueeTool, TextTool
│   │
│   ├── navigation/               # 60fps frame graph navigation (10 files)
│   │   ├── NavigationLoop.ts     # Main pipeline loop
│   │   ├── NavigationEngine.ts   # timelineNavigation + pianoRollNavigation singletons
│   │   ├── GestureInterpreter.ts # Wheel → NavigationVector
│   │   ├── VelocityIntegrator.ts # Momentum-based pan/zoom
│   │   ├── ConstraintPass.ts     # Bounds clamping
│   │   ├── PlayheadFollowEngine.ts
│   │   ├── SpatialCoordinateSystem.ts
│   │   └── useNavigation.ts      # React hook
│   │
│   ├── rendering/                # Render graph & GPU (11 files)
│   │   ├── RenderGraph.ts
│   │   ├── RenderPass.ts
│   │   ├── cache/                # SpatialCache (clip bucket cache)
│   │   ├── webgl/                # WebGLRenderer, WebGLBatcher
│   │   ├── webgl/shaders/        # CurveShader, GridShader, NoteShader
│   │   ├── invalidation/         # DirtyRegionManager
│   │   ├── profiler/             # FrameProfiler (FPS, latency, memory)
│   │   └── contracts/            # RendererScheduler (16.6ms budget)
│   │
│   ├── persistence/              # Save/load (6 files)
│   │   ├── projectPersistence.ts # Serialization + IndexedDB CRUD
│   │   ├── engineRebuilder.ts    # 8-step audio graph restoration
│   │   ├── autosave.ts           # Debounced autosave
│   │   └── audioFileStore.ts     # Audio asset CRUD
│   │
│   ├── filesystem/               # File management (8 files, ~3,882 LOC)
│   │   ├── indexedDBAdapter.ts   # Low-level IDB wrapper (4 stores)
│   │   ├── projectSerializer.ts  # Project serialization
│   │   ├── projectManager.ts     # Project lifecycle
│   │   ├── importManager.ts      # Audio/MIDI import
│   │   ├── exportManager.ts      # WAV/MP3 export
│   │   └── autosaveManager.ts    # Autosave scheduling
│   │
│   ├── interactions/             # Gesture controllers (7 files)
│   ├── timeline/                 # Timeline rendering (11 files)
│   ├── tools/                    # Pointer, Pencil, Eraser, Glue, Fade, Mute, Zoom tools
│   ├── workflow/                 # Command pattern (MoveClips, ResizeClip, etc.)
│   ├── viewport/                 # ViewportManager, ZoomController
│   ├── effects/plugins/          # compressorPlugin.ts, eqPlugin.ts
│   ├── plugins/                  # PluginAPI, PluginRegistry
│   ├── modulation/               # ModulationMatrix
│   ├── bootstrap/                # Engine bootstrap
│   ├── collaboration/            # CRDT stubs (no server)
│   ├── gpu/                      # GPUDevice, GPUCapabilities, ShaderCompiler
│   ├── soundLibrary/             # Instrument definitions
│   ├── pianoRoll/                # Piano roll rendering
│   ├── debug/                    # Diagnostics
│   └── dsp/                      # SharedTransportBuffer, graph sync
│
├── store/                        # Zustand state (7 files, ~7,616 LOC)
│   ├── projectStore.ts           # ★ 4,819 LOC — core DAW state
│   ├── midiStore.ts              # MIDI recording/editing (1,187 LOC)
│   ├── mixerStore.ts             # Mixer layout (505 LOC)
│   ├── automationStore.ts        # Automation lanes (836 LOC)
│   ├── clipEditingStore.ts       # Clip edit state (602 LOC)
│   ├── onboardingStore.ts        # First-run flow (26 LOC)
│   └── tutorialStore.ts          # Tutorial steps (33 LOC)
│
├── models/                       # Domain types (5 files)
│   ├── Clip.ts                   # Clip model (68 LOC)
│   ├── Track.ts                  # Track + alternatives (84 LOC)
│   ├── Project.ts                # Project metadata (11 LOC)
│   ├── Articulation.ts           # MIDI articulations (34 LOC)
│   └── Annotation.ts             # Timeline annotations (9 LOC)
│
├── lib/                          # Shared utilities (13 files)
│   ├── audioEngine.ts            # Legacy audio engine (still imported)
│   ├── auth.ts                   # NextAuth config
│   ├── db.ts                     # Prisma client singleton
│   ├── prisma.ts                 # Prisma helper
│   ├── storage.ts                # Storage abstraction
│   ├── supabase.ts               # Supabase client (unused)
│   ├── shareId.ts                # Share ID generation
│   └── ...
│
├── prisma/                       # Database (6 files)
│   ├── schema.prisma             # Full schema (114 LOC)
│   ├── seed.js                   # Sample data
│   └── migrations/               # 3 migration files
│
├── templates/                    # Project templates (7 files)
│   ├── types.ts                  # Template type definitions
│   ├── index.ts                  # Template registry
│   ├── lofi.ts, hiphop.ts, piano.ts, edm.ts, podcast.ts
│
├── wasm/dsp-core/                # Rust → WASM DSP (6 files)
│   ├── Cargo.toml
│   ├── build.ps1
│   └── src/
│       ├── lib.rs
│       └── processors/
│           ├── mod.rs
│           ├── eq.rs             # 3-band EQ processor
│           └── compressor.rs     # Dynamics compressor
│
├── rust/                         # Additional Rust DSP crate
│   ├── dsp-core/                 # FFT, SIMD, modulation, oversampling
│   └── plugins/                  # Compressor + EQ plugin stubs
│
├── public/                       # Static assets
│   ├── worklets/                 # DSPWorkletProcessor.js, synth-processor.js
│   ├── recorder-worklet.js
│   └── audio/loops/              # Bass, drums, melodic loops
│
├── hooks/                        # React hooks (3 files)
│   ├── useErrorHandler.ts
│   ├── useFullscreen.ts
│   └── useInstruments.ts
│
├── tests/                        # Tests (3 files)
│   ├── benchmarks/engine.bench.ts
│   ├── integration/bpm-sync.test.ts
│   └── integration/playback.test.ts
│
├── types/                        # TypeScript declarations
│   ├── audioworklet.d.ts
│   └── next-auth.d.ts
│
├── scripts/                      # Build scripts
├── docs/                         # Architecture reports (.pdf, .docx)
├── agents/                       # AI agent configurations
├── legacy/                       # Legacy HTML/CSS/JS (pre-Next.js)
└── magic-pro-modules/            # Legacy module scratchpad
```

---

## 4. Architecture Overview

### 4.1 High-Level System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Browser Client                         │
│                                                          │
│  ┌────────────────────┐    ┌──────────────────────────┐  │
│  │   React UI Layer    │    │   Audio Engine            │  │
│  │   (components/)     │◄──►│   (engine/audioEngine/)   │  │
│  │                     │    │   - Scheduler             │  │
│  │  ┌───────────────┐  │    │   - RoutingEngine         │  │
│  │  │ Zustand Stores │  │    │   - AudioWorklets         │  │
│  │  └───────┬───────┘  │    │   - BufferCache           │  │
│  │          │          │    └──────────────────────────┘  │
│  │          ▼          │                                  │
│  │  ┌───────────────┐  │    ┌──────────────────────────┐  │
│  │  │ Editor System  │  │    │   Rendering Pipeline      │  │
│  │  │ (engine/editor)│  │    │   (engine/rendering/)     │  │
│  │  │ - Tools        │  │    │   - WebGL Renderer        │  │
│  │  │ - Selection    │  │    │   - Canvas Timeline       │  │
│  │  │ - Snap         │  │    │   - Dirty Regions         │  │
│  │  └───────┬───────┘  │    │   - Frame Profiler        │  │
│  │          │          │    └──────────────────────────┘  │
│  │          ▼          │                                  │
│  │  ┌───────────────┐  │    ┌──────────────────────────┐  │
│  │  │ Navigation    │  │    │   WASM DSP Core           │  │
│  │  │ (engine/nav)  │  │    │   (wasm/dsp-core/)        │  │
│  │  │ - 60fps loop  │  │    │   - EQ Processor          │  │
│  │  │ - Gesture     │  │    │   - Compressor Processor  │  │
│  │  │ - Constraints │  │    └──────────────────────────┘  │
│  │  └───────────────┘  │                                  │
│  │                     │    ┌──────────────────────────┐  │
│  │  ┌───────────────┐  │    │   Persistence             │  │
│  │  │ MIDI System   │  │    │   (engine/persistence/)   │  │
│  │  │ (engine/midi/)│  │    │   - IndexedDB             │  │
│  │  │ - Scheduler   │  │    │   - Engine Rebuilder      │  │
│  │  │ - Editor      │  │    │   - Autosave              │  │
│  │  │ - Transforms  │  │    └──────────┬───────────────┘  │
│  │  └───────────────┘  │               │                  │
│  │                     │               ▼                  │
│  │  ┌───────────────┐  │    ┌──────────────────────────┐  │
│  │  │ Instruments   │  │    │   API Layer (app/api/)    │  │
│  │  │ (engine/inst) │  │    │   - NextAuth              │  │
│  │  │ - Synth       │  │    │   - Project CRUD          │  │
│  │  │ - Sampler     │  │    │   - Sharing               │  │
│  │  │ - DrumMachine │  │    └──────────┬───────────────┘  │
│  │  └───────────────┘  │               │                  │
│  └──────────────────────┘               ▼                  │
│                                 ┌────────────────────────┐ │
│                                 │   PostgreSQL (Prisma)   │ │
│                                 └────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Engine Singleton Architecture

The engine uses a **Singleton** pattern extensively. Key singletons:

| Singleton | File | Responsibility |
|---|---|---|
| `audioEngineAdapter` / `audioEngine` | `engine/AudioEngineAdapter.ts` | Central audio facade (backward-compatible) |
| `advancedScheduler` | `audioEngine/scheduler.ts` | Lookahead clip scheduling |
| `audioContextManager` | `audioEngine/audioContext.ts` | AudioContext lifecycle |
| `routingEngine` | `audioEngine/routingEngine.ts` | Signal flow routing |
| `bufferCacheManager` | `audioEngine/bufferCache.ts` | LRU audio buffer cache |
| `recordingEngine` | `audioEngine/recordingEngine.ts` | Recording session management |
| `bounceEngine` | `audioEngine/bounceEngine.ts` | Offline export |
| `globalProfiler` | `rendering/profiler/FrameProfiler.ts` | FPS/latency/memory metrics |
| `globalRendererScheduler` | `rendering/contracts/RendererScheduler.ts` | Frame rendering coordinator |
| `globalDirtyRegionManager` | `rendering/invalidation/DirtyRegionManager.ts` | Dirty region tracking |
| `globalSpatialCache` | `rendering/cache/SpatialCache.ts` | Clip spatial bucket cache |
| `timelineNavigation` | `navigation/NavigationEngine.ts` | Timeline 60fps nav loop |
| `pianoRollNavigation` | `navigation/NavigationEngine.ts` | Piano roll nav loop |
| `instrumentService` | `instruments/instrumentService.ts` | Per-track instrument lifecycle |
| `globalMidiRouter` | `instruments/midiIntegration.ts` | MIDI-to-instrument routing |

### 4.3 Design Patterns Used

| Pattern | Location |
|---|---|
| **Singleton** | Most engine modules (scheduler, routingEngine, etc.) |
| **Adapter / Strangler Fig** | `AudioEngineAdapter.ts` (wraps V2 engine, legacy `lib/audioEngine.ts` being replaced) |
| **Factory** | `InstrumentFactory`, `createAutomationScheduler` |
| **Registry** | `InstrumentRegistry`, `ToolManager`, `ParameterRegistry` |
| **Command (Undoable)** | `workflow/*`, `AutomationCommands`, `MidiCommands` |
| **Observer** | Event system in scheduler, routing, profiler |
| **Pipeline** | `NavigationLoop` (6-stage frame graph), `RenderGraph` |
| **Dirty Region** | `DirtyRegionManager` (invalidation-based rendering) |
| **O(log n) Index** | `AutomationIndex`, `MidiNoteIndex`, `SpatialNoteCache` |
| **Space Partitioning** | `SpatialCache` (16-beat buckets), `AutomationSpatialCache` |
| **Provider** | React hooks (`useNavigation`, `useAudioPlayer`) |

---

## 5. Routing & Pages

### 5.1 Page Routes

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Redirect to `/welcome` or `/dashboard` based on onboarding state |
| `/welcome` | `app/welcome/page.tsx` | Onboarding with template selection grid |
| `/login` | `app/login/page.tsx` | Email/password login form |
| `/signup` | `app/signup/page.tsx` | Registration form |
| `/dashboard` | `app/dashboard/page.tsx` | Project list with cards, rename, delete, new project |
| `/project/[projectId]` | `app/project/[projectId]/page.tsx` | **Main DAW workspace** |
| `/p/[shareId]` | `app/p/[shareId]/page.tsx` | Public read-only project view |
| `/account` | `app/account/page.tsx` | Account settings (protected by middleware) |
| `/debug/runtime` | `app/debug/runtime/page.tsx` | Runtime capability diagnostics |
| `/debug-audio` | `app/debug-audio/page.tsx` | Audio device diagnostics |

### 5.2 API Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth credentials handler |
| `/api/auth/signup` | POST | User registration (bcrypt + Prisma) |
| `/api/projects` | GET, POST | List / create projects |
| `/api/project/save` | POST | Full project state save (upsert with stateJson) |
| `/api/project/[id]` | GET, PATCH, DELETE | Read / rename / delete project (with relations) |
| `/api/project/[id]/share` | POST, DELETE | Generate share link / revoke sharing |
| `/api/public/[shareId]` | GET | Fetch public project snapshot (no auth) |
| `/api/account/update` | PUT | Update user display name |

### 5.3 Middleware

`app/middleware.ts` — Exports default NextAuth middleware. Only matches `/account/:path*`. All other routes handle auth client-side.

---

## 6. UI Component Layer

### 6.1 DAW Workspace Layout (`/project/[projectId]`)

The workspace is a single page composing ~40+ toggleable components:

```
┌──────────────────────────────────────────────────────────┐
│ AppMenuBar (macOS-style)                                  │
├──────────────────────────────────────────────────────────┤
│ TransportBar (play/stop/record, tempo, time, loop, etc.)  │
├──────────────────────────────────────────────────────────┤
│ Toolbar (select, draw, split, marquee, snap settings)     │
├──────┬───────────────────────────────────────┬────────────┤
│Left  │ Central Workspace                     │ Right      │
│Drawer│ ┌──────────────────────────────────┐  │ Sidebar    │
│Library│ TracksAreaMenuBar                  │  │ ┌──────┐  │
│Panel │ ├──────────────────────────────────┤  │ │List  │  │
│      │ │ GlobalTracks (tempo, signature)   │  │ │Editors│  │
│      │ ├──────────┬───────────────────────┤  │ ├──────┤  │
│      │ │ TrackList│ Timeline (Canvas)      │  │ │Note  │  │
│      │ │ (headers)│ / TimelineCanvas       │  │ │Pad   │  │
│      │ │          │ / TimelineRuler        │  │ ├──────┤  │
│      │ │          │ / Clip*                │  │ │Loop  │  │
│      │ │          │ / ClipHandles          │  │ │Browser│  │
│      │ └──────────┴───────────────────────┘  │ ├──────┤  │
│      │                                       │ │Browsers│  │
│      └───────────────────────────────────────┘ └──────┘  │
├──────────────────────────────────────────────────────────┤
│ Bottom Panel (resizable, toggleable)                       │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ SmartControls | Mixer | PianoRoll                    │  │
│ └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│ ViewControlBar (panel toggles)                            │
├──────────────────────────────────────────────────────────┤
│ GlobalKeyHandler (keyboard shortcuts)                     │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Key Components

#### Core DAW Panels

| Component | File | Lines | Description |
|---|---|---|---|
| `Timeline` | `components/Timeline.tsx` | 966 | Main arrangement view |
| `TrackList` | `components/TrackList.tsx` | 964 | Track headers & controls |
| `Mixer` | `components/Mixer.tsx` | 635 | Full mixer panel |
| `TransportBar` | `components/TransportBar.tsx` | 567 | Transport controls |
| `Inspector` | `components/Inspector.tsx` | 548 | Track/clip properties |
| `PianoRoll` | `components/PianoRoll.tsx` | 164 | MIDI editor (entry) |
| `PreferencesDialog` | `components/PreferencesDialog.tsx` | 2,673 | Settings dialog |
| `ProjectChooser` | `components/ProjectChooser.tsx` | 494 | Project quick-switcher |
| `Clip` | `components/Clip.tsx` | 577 | Single clip component |
| `ClipHandles` | `components/ClipHandles.tsx` | 337 | Fade/trim/gain handles |
| `ChannelEQ` | `components/ChannelEQ.tsx` | 510 | Parametric EQ UI |
| `ProjectManager` | `components/ProjectManager.tsx` | 277 | Save/duplicate/rename |
| `SmartControls` | `components/SmartControls.tsx` | 174 | Macro knob panel |
| `LiveLoopsGrid` | `components/LiveLoopsGrid.tsx` | 404 | Live Loops (Logic-style) |
| `GlobalKeyHandler` | `components/GlobalKeyHandler.tsx` | 433 | Keyboard shortcuts |
| `TimelineWithClipEditing` | `components/TimelineWithClipEditing.tsx` | 428 | Inline clip editor |
| `TimelineRuler` | `components/TimelineRuler.tsx` | 429 | Time ruler |
| `Toolbar` | `components/Toolbar.tsx` | 172 | Tool selection bar |
| `ToolsMenu` | `components/ToolsMenu.tsx` | 153 | Tool dropdown |

#### Dialogs

| Component | Purpose |
|---|---|
| `BounceDialog`, `BounceAllTracksDialog`, `BounceRegionsDialog`, `BounceTrackDialog` | Bounce/render dialogs |
| `ExportDialog`, `ImportProjectDialog`, `SaveDialog` | Import/export/save |
| `ShareDialog`, `ShareModal` | Project sharing |
| `NewTrackDialog`, `NewProjectScreen` | Creation dialogs |
| `PreferencesDialog`, `ProjectSettingsDialog`, `ProjectInfoDialog` | Settings |
| `NoteRepeatDialog`, `SpotEraseDialog`, `DrumReplacementDialog` | Specialized tools |
| `SearchAndSelectDialog`, `ColorPalette`, `IconBrowser` | Utility dialogs |
| `OnboardingOverlay`, `QuickHelpWindow` | Help & onboarding |
| `ArticulationSetEditor`, `TrackHeaderConfigDialog`, `CreateNewTrackUsingDialog` | Track config |

#### Mixer Subcomponents (`components/mixer/`)

| Component | Lines | Purpose |
|---|---|---|
| `ChannelStrip.tsx` | 419 | Single channel strip (fader, mute, solo, pan, sends) |
| `Mixer.tsx` | 417 | Main mixer panel |
| `MixerChannel.tsx` | 169 | Channel strip wrapper |
| `MixerFader.tsx` | 188 | Volume fader control |
| `MixerMeter.tsx` | 131 | Level meter |
| `SendControls.tsx` | 241 | Bus send routing |
| `Meter.tsx` | 239 | Generic VU meter |

#### MIDI Subcomponents (`components/midi/`)

| Component | Purpose |
|---|---|
| `PianoRoll.tsx` | MIDI editor with notes grid |
| `PianoKeyboard.tsx` | Vertical piano keyboard |
| `PianoRollTools.tsx` | MIDI editing tools toolbar |
| `MidiGrid.tsx`, `MidiCanvasGrid.tsx` | Grid rendering |
| `MidiNote.tsx`, `MidiNoteCanvas.tsx` | Note rendering |
| `VelocityLane.tsx` | Velocity editing lane |

### 6.3 Panel Visibility State

All panels are toggled via `useProjectStore` booleans:
- `showLibrary` (left drawer)
- `showRightSidebar` → sub-panels: `showListEditors`, `showNotePad`, `showLoopBrowser`, `showBrowsers`
- `showLiveLoopsGrid`
- `showAudioTrackEditor`
- `showTracksArea`
- `bottomPanel` → `'smartcontrols' | 'mixer' | 'pianoroll'`

---

## 7. State Management

### 7.1 Stores Overview

| Store | File | Lines | Responsibility |
|---|---|---|---|
| **projectStore** | `store/projectStore.ts` | **4,819** | Core DAW: tracks, clips, transport, history, automation, environment, alternatives, settings, panel visibility |
| midiStore | `store/midiStore.ts` | 1,187 | MIDI recording session, input state, editing state |
| automationStore | `store/automationStore.ts` | 836 | Automation lanes, points, modes, clipboard |
| clipEditingStore | `store/clipEditingStore.ts` | 602 | Clip edit selections, tool state, drag state |
| mixerStore | `store/mixerStore.ts` | 505 | Mixer layout, sends, mute/solo groups |
| onboardingStore | `store/onboardingStore.ts` | 26 | First-run tutorial state |
| tutorialStore | `store/tutorialStore.ts` | 33 | Tutorial step progress |

### 7.2 projectStore Key State Shape

```typescript
interface ProjectState {
  // Project metadata
  id: string;
  name: string;
  tempo: number;
  timeSignature: string;
  keySignature: string;
  projectFormat: string;
  projectStart: number;

  // Transport
  isPlaying: boolean;
  isRecording: boolean;
  isPaused: boolean;
  currentBeat: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;

  // Tracks & Clips
  tracks: Track[];
  clips: Clip[];
  annotations: TimelineAnnotation[];
  globalTracks: GlobalTracks;

  // Selection
  selectedTrackId: string | null;
  selectedClipIds: string[];

  // Mixer
  masterVolume: number;
  soloedTrackIds: string[];

  // Environment
  environment: { layers: EnvironmentLayer[]; objects: EnvironmentObject[] };
  alternatives: ProjectAlternative[];
  settings: ProjectSettings;

  // Panel visibility
  showLibrary: boolean;
  showListEditors: boolean;
  showNotePad: boolean;
  showLoopBrowser: boolean;
  showBrowsers: boolean;
  showLiveLoopsGrid: boolean;
  showTracksArea: boolean;
  showAudioTrackEditor: boolean;
  showRightSidebar: boolean;
  bottomPanel: 'smartcontrols' | 'mixer' | 'pianoroll';
  bottomPanelHeight: number;

  // Undo/Redo
  undoStack: SelectiveSnapshot[];
  redoStack: SelectiveSnapshot[];
  maxUndo: number;

  // Actions (100+ action methods)
  setTempo: (bpm: number) => void;
  addTrack: (type: TrackType) => void;
  addClip: (trackId: string, clip: Clip) => void;
  moveClip: (clipId: string, newStart: number) => void;
  splitClip: (clipId: string, atBeat: number) => void;
  undo: () => void;
  redo: () => void;
  // ... many more
}
```

---

## 8. Audio Engine

### 8.1 AudioEngineAdapter (`engine/AudioEngineAdapter.ts`)

The central audio facade (597 lines). Provides backward-compatible API while routing to V2 modular engine:

```
AudioEngineAdapter
├── Lifecycle: init(), dispose(), isInitialized(), waitForReady()
├── Transport: play(), stop(), seekTo(), setTempo(), onTransportTick()
├── Mixer/Routing: addTrack(), removeTrack(), setTrackVolume(), setTrackPan()
│               muteTrack(), soloTrack(), routeTrackToBus(), setMasterVolume()
├── Playback: playClip(), loadAudio(), loadSample(), addBuffer(), getBuffer()
├── MIDI/Synth: triggerNote(), releaseNote(), setPitchBend(), loadInstrument()
├── Recording: startRecording(), stopRecording(), monitorInput()
└── Export: bounce()
```

### 8.2 Scheduler (`engine/audioEngine/scheduler.ts`)

**Class:** `AdvancedScheduler` (singleton: `advancedScheduler`, 583 lines)

- Lookahead scheduling (default 50ms lookahead, 25ms interval)
- Clip offset, time stretching, pitch shifting support
- Drift prevention using `AudioContext.currentTime` as master clock
- Per-clip mute/solo filtering via routingEngine
- On-demand buffer resolution with parallel fetch/decode
- Tempo change with live rescheduling
- Event system: `transportTick`, `clipScheduled`, `clipFinished`, etc.

```typescript
// Core scheduling loop
private schedule() {
  const currentTime = this.audioContext.currentTime;
  const lookAheadEnd = currentTime + this.config.lookaheadTime / 1000;
  for (const clip of this.activeClips) {
    const clipStart = this.beatsToSeconds(clip.startBeat);
    if (clipStart < lookAheadEnd && !clip.isScheduled) {
      this.scheduleClip(clip, clipStart);
      clip.isScheduled = true;
    }
  }
}
```

### 8.3 Routing Engine (`engine/audioEngine/routingEngine.ts`)

**Class:** `RoutingEngine` (singleton: `routingEngine`, ~719 lines)

Flexible signal flow topology:
```
Input → Track → preEffects[] → sendGains → panner → mainGain → postEffects[] → Bus → Output
```

- Solo/mute logic with soloed-track tracking
- Send/return bus architecture
- Insert effects chains (pre/post)
- Panning, gain staging

### 8.4 AudioContext (`engine/audioEngine/audioContext.ts`)

**Class:** `AudioContextManager` (singleton: `audioContextManager`)

- Lazy context initialization
- AudioWorklet module loading (`loadWorklet()`)
- Autoplay policy compliance (resume/suspend)
- Input/output device enumeration via `getUserMedia`
- Performance monitoring

### 8.5 Other Audio Engine Modules

| Module | Description |
|---|---|
| `bufferCache.ts` | LRU cache with reference counting, max size config |
| `bounceEngine.ts` | Offline audio context rendering, progress tracking |
| `channelStrip.ts` | Insert slots, send levels, dB ↔ gain conversion |
| `masterBus.ts` | Master output with optional limiter |
| `clipPlaybackController.ts` | Per-clip AudioBufferSourceNode management |
| `clipDSP.ts` | Audio buffer DSP processing |
| `audioMeter.ts` | RMS/peak level metering |
| `nodePool.ts` | AudioNode pooling for performance |
| `metronome.ts` | Click track with accent/offbeat |
| `recordingEngine.ts` | Recording session lifecycle |
| `dsp/synth.processor.ts` | AudioWorkletProcessor for synth |
| `dsp/channelStrip.processor.ts` | AudioWorkletProcessor for channel strip |
| `dsp/timeStretch.processor.ts` | AudioWorkletProcessor for time stretching |

### 8.6 Recording Pipeline (`engine/audioRecording/`)

8 files, ~1,965 LOC total:

```
UserMediaStream
  → inputManager.ts (device selection, stream management)
    → recorder.ts (recording session, AudioWorklet-based capture)
      → bufferManager.ts (ring buffer for live data)
        → wavEncoder.ts (PCM → WAV encoding)
          → recordingClip.ts (clip creation from recorded data)
  → liveWaveform.ts / waveformAnalyzer.ts (real-time waveform display)
```

### 8.7 Effects (`engine/effects/plugins/`)

| Plugin | File | Lines | Description |
|---|---|---|---|
| Compressor | `compressorPlugin.ts` | 446 | Threshold, ratio, attack, release, knee, makeup gain |
| EQ | `eqPlugin.ts` | 413 | 3-band parametric: low/high shelf + peak bell |

Both implement full plugin interfaces with parameter automation and are mirrored by the WASM DSP processors.

---

## 9. MIDI System

### 9.1 Architecture (`engine/midi/`, 16 files, ~3,024 LOC)

```
MidiScheduler → InstrumentAdapter → SynthEngine/Sampler/DrumMachine
     ↓
MidiEditor (pure functions: add, delete, move, resize notes)
     ↓
MidiTransforms (quantize, humanize, transpose, invert, retrograde, etc.)
```

### 9.2 Key Types (`engine/midi/types.ts`)

```typescript
interface MidiNote {
  id: string;
  pitch: number;       // 0-127
  velocity: number;    // 0-127
  startBeat: number;
  duration: number;    // beats
  channel: number;
  muted: boolean;
  selected: boolean;
}

interface MidiRegion {
  id: string;
  trackId: string;
  startBeat: number;
  durationBeats: number;
  notes: MidiNote[];
  chunks: MidiRegionChunk[];  // for 100k+ note support
}
```

### 9.3 MIDI Scheduler (`engine/midi/midiScheduler.ts`)

**Class:** `MidiScheduler` — real-time MIDI note scheduling

- `scheduleRegion()` / `unscheduleRegion()` — manage active regions
- `scheduleLookahead()` — O(log n) via `MidiNoteIndex`
- Voice tracking with `panicAllNotes()`
- `rescheduleWindow()` for invalidation-based rescheduling

### 9.4 MIDI Editor (`engine/midi/midiEditor.ts`)

**742 lines** of pure functions:
- CRUD: `addNote()`, `deleteNote()`, `moveNote()`, `resizeNote()`
- Selection: single, group, region, invert
- Clipboard: `copyNotes()`, `cutNotes()`, `pasteNotes()`, `duplicateNotes()`
- Drag: `startDrag()`, `updateDrag()`, `commitDrag()`
- Hit testing: `hitTestNote()`, `getNoteAtPosition()`
- Clip ops: `splitClip()`, `mergeClips()`, `cropClip()`

### 9.5 MIDI Transforms (`engine/midi/midiTransforms.ts`)

**516 lines** of musical transformations:
- Transpose: up/down octave, semitone, arbitrary
- Invert: pitch inversion around a center
- Retrograde: reverse note order
- Humanize: subtle/heavy timing + velocity randomization
- Velocity: scale, compress, expand, limit, randomize, fixed
- Duration: scale, legato, staccato, double/half time
- Time shift: nudge forward/backward
- Pattern: `duplicatePattern()`, `createChord()` (major, minor, dom7, etc.), `strumChord()`
- Selection filters: pitch range, time range, every Nth

### 9.6 Quantization (`engine/midi/quantization.ts`, `MidiQuantizer.ts`)

- Grid divisions: 1, 2, 4, 8, 16, 32, 64, 128, 256
- Swing support
- Strength percentage
- `MidiQuantizer.quantizeNotes(notes, resolution, strength, swing)`

---

## 10. Instrument Engine

### 10.1 Instrument Registry

Registered in `engine/instruments/instrumentRegistry.ts`:
- **Synthesizers:** Analog Pad, Lead Synth, Warm Strings, Deep Bass, Hammond Organ, Clavinet
- **Samplers:** Grand Piano, Electric Piano
- **Drum Kits:** Trap Kit, Acoustic Kit, 808 Kit

### 10.2 PolyphonicSynth (`engine/instruments/synthEngine.ts`)

- Web Audio API synthesizer
- Per-voice: oscillator (sine/square/saw/triangle/noise), filter (lowpass/highpass/bandpass), ADSR envelope
- Voice pooling with round-robin voice stealing
- Velocity scaling, portamento
- 6 presets with full parameter sets

### 10.3 Sampler (`engine/instruments/samplerEngine.ts`)

- Multi-zone sample mapping with velocity layers (min/max note and velocity)
- Pitch adjustment via playback rate
- Voice pooling
- Generated fallback samples (piano synthesis via waveform math)

### 10.4 DrumMachine (`engine/instruments/drumMachine.ts`)

- Maps MIDI notes to drum samples
- 32-voice polyphony, pitch tuning, velocity scaling, panning
- 3 kits: Trap, Acoustic, 808
- Synthesized fallback sounds for all drum types (kick, snare, hi-hat, crash, ride, tom, clap, etc.)

### 10.5 MultiSamplerEngine (`engine/instruments/multiSamplerEngine.ts`)

- Parses DecentSampler format (`.dspreset` XML)
- Groups with velocity layers and round-robin groups
- On-demand sample fetching with buffer cache
- ADSR envelope on playback
- `SamplerNoteMapper` for note/velocity zone matching

### 10.6 MIDI → Instrument Routing

```
MidiInstrumentRouter (singleton: globalMidiRouter)
  → maps trackId → Instrument instance
  → forwards noteOn/noteOff/allNotesOff
  → track-level volume, mute, solo
```

---

## 11. Automation System

### 11.1 Architecture (`engine/automation/`, 12+ files, ~2,441 LOC)

```
Types (AutomationPoint, AutomationLane, ParameterPath, CurveType)
  ↓
Curves (interpolation engine: linear, exponential, logarithmic, Bezier, hold, S-curve)
  ↓
AutomationScheduler (real-time playback with AudioParam scheduling)
  ↓
ParameterBinding (maps normalized values → AudioParams with dB/pan special handling)
  ↓
Indexing (O(log n) binary search via AutomationIndex)
  ↓
Rendering (BezierCurveRenderer, AutomationLaneRenderer)
```

### 11.2 Curve Types

| Type | Description |
|---|---|
| `linear` | Straight line between points |
| `exponential` | Exponential ramp |
| `logarithmic` | Logarithmic ramp |
| `bezier` | Cubic Bezier with tension control |
| `hold` | Step/jump (instant value change) |

Plus utility functions: `dbToGain()`, `gainToDb()`, `normalizedToPan()`, `panToNormalized()`

### 11.3 Automation Scheduler (`engine/automation/automationScheduler.ts`)

- Real-time playback with `scheduleCurveSegment()` mapping curves to `AudioParam`:
  - Linear → `linearRampToValueAtTime()`
  - Hold → `setValueAtTime()`
  - Bezier/Exponential → multi-step approximation
- Recording: Write, Touch, Latch modes with `recordValue()` and `mergeRecordedPoints()`
- Tempo tracking and adjustment
- 60fps update loop for UI sync

### 11.4 Parameter Binding (`engine/automation/parameterBinding.ts`)

- Registers AudioParams for automation (track: volume, pan, sends; plugin params; master)
- `evaluateAndApply()` with volume/pan special handling (dB scaling)
- `batchEvaluateAndApply()` for efficient updates

---

## 12. Rendering Pipeline

### 12.1 Render Graph (`engine/rendering/`)

```
RendererScheduler (singleton: globalRendererScheduler)
  ↓ 16.6ms budget, full or partial redraws
RenderGraph (ordered list of RenderPass instances)
  ↓
WebGLRenderer (WebGL2, orthographic 2D projection)
  ↓
WebGLBatcher (instanced rectangle drawing, auto-flush at 100k)
```

### 12.2 Dirty Region System

```typescript
// engine/rendering/invalidation/DirtyRegionManager.ts
class DirtyRegionManager {
  invalidate(source: InvalidationSource, bbox?: BoundingBox): void;
  // Merges regions if > 5 small regions → full frame redraw
  getDirtyRegions(): BoundingBox[];
}
```

Invalidation sources: `PLAYHEAD`, `CLIP_DRAG`, `OVERLAY`, `AUTOMATION`, `VIEWPORT_PAN`, `ZOOM`, etc.

### 12.3 Spatial Cache (`engine/rendering/cache/SpatialCache.ts`)

- 16-beat bucket spatial partitioning
- O(1) viewport culling for visible clips

### 12.4 Frame Profiler (`engine/rendering/profiler/FrameProfiler.ts`)

- Per-frame FPS tracking
- RAF latency, delta variance
- Dropped frames, long tasks (>50ms)
- Memory estimation

### 12.5 WebGL Shaders (`engine/rendering/webgl/shaders/`)

| Shader | Purpose |
|---|---|
| `NoteShader.ts` | MIDI note rectangles with colors |
| `GridShader.ts` | Grid lines (vertical beat divisions, horizontal pitch lines) |
| `CurveShader.ts` | Automation curve lines |

---

## 13. Navigation System

### 13.1 60fps Frame Graph Pipeline

```
DOM Input (WheelEvent)
  → GestureInterpreter.processQueue() → NavigationVector[]
    → VelocityIntegrator.integrate() → pan + zoom momentum
      → ConstraintPass.apply() → bounds clamping (0-127 pitch, 1-500 px/beat)
        → Object.freeze(state) → immutable snapshot
          → Listener notification → renderers flush
```

### 13.2 Singletons

- `timelineNavigation` — arrangement view navigation loop
- `pianoRollNavigation` — piano roll editor navigation loop
- `globalViewportGroup` — links arrangement and piano roll horizontally

### 13.3 Follow Mode

```typescript
enum FollowMode {
  DISABLED,
  PAGE_FLIP,     // jump when playhead reaches edge
  CONTINUOUS     // smooth scroll with playhead
}
```

---

## 14. Editor & Tools

### 14.1 EditorCore (`engine/editor/EditorCore.ts`)

```typescript
class EditorCore {
  coordinateSystem: CoordinateSystem;  // screen ↔ musical units
  toolManager: ToolManager;            // tool registry + active tool
  selectionManager: SelectionManager;  // clip/note/automation selection
  snapEngine: SnapEngine;              // grid + object snapping
  interactionManager: InteractionManager; // pointer/keyboard orchestrator
}
```

### 14.2 Tools

| Tool | File | Purpose |
|---|---|---|
| `SelectTool` | `engine/editor/tools/SelectTool.ts` | Clip/note selection |
| `DrawTool` | `engine/editor/tools/DrawTool.ts` | Draw new clips/notes |
| `SplitTool` | `engine/editor/tools/SplitTool.ts` | Split clips at beat |
| `MarqueeTool` | `engine/editor/tools/MarqueeTool.ts` | Region selection |
| `TextTool` | `engine/editor/tools/TextTool.ts` | Annotation text input |
| `PointerTool` | `engine/tools/PointerTool.ts` | Basic pointer |
| `PencilTool` | `engine/tools/PencilTool.ts` | Freehand drawing |
| `EraserTool` | `engine/tools/EraserTool.ts` | Delete clips/notes |
| `GlueTool` | `engine/tools/GlueTool.ts` | Join adjacent clips |
| `FadeTool` | `engine/tools/FadeTool.ts` | Draw fade curves |
| `MuteTool` | `engine/tools/MuteTool.ts` | Toggle clip mute |
| `ZoomTool` | `engine/tools/ZoomTool.ts` | Zoom to region |

### 14.3 Undo/Redo (Command Pattern)

```typescript
// engine/workflow/Command.ts
interface Command {
  execute(store: ProjectState): void;
  undo(store: ProjectState): void;
  description?: string;
}

// Concrete commands:
class MoveClipsCommand     // Move clips to new positions
class ResizeClipCommand    // Resize clip boundaries
class DeleteClipCommand    // Delete clips with full restore
class DuplicateClipCommand // Duplicate clips
```

The project store implements **selective snapshots** (not full-store cloning) for efficient undo/redo with configurable max depth.

### 14.4 Interaction Controllers (`engine/interactions/`)

| Controller | Purpose |
|---|---|
| `RegionDragController` | Clip drag-and-drop with snap |
| `RegionResizeController` | Clip edge resizing |
| `RegionCreationController` | New clip creation from drag |
| `MarqueeController` | Marquee region selection |
| `MidiCreationController` | MIDI note creation |
| `AutomationCreationController` | Automation point creation |
| `SelectionController` | Selection handling |

---

## 15. Persistence & Filesystem

### 15.1 Dual-Target Persistence

```
IndexedDB (client-side, local)
  ├── projects store (serialized project state)
  ├── assets store (audio buffers, files)
  ├── waveforms store (pre-computed peaks)
  └── settings store (user preferences)

PostgreSQL (server-side, via Prisma)
  └── Users, Projects, Tracks, Clips, Notes, Automation, Plugins, Buses, Sends
```

### 15.2 projectPersistence.ts

```typescript
// Key functions:
saveToIndexedDB(projectId: string, state: SerializedState): Promise<void>
  // With backup protection & crash recovery

loadFromIndexedDB(projectId: string): Promise<SerializedState | null>
  // With backup fallback on corruption

serializeStoreState(getState: () => ProjectState): SerializedState
  // Full serialization (current schema version = 1)

deserializeState(serialized: SerializedState): Partial<ProjectState>
  // Reconstruction from persisted state
```

### 15.3 EngineRebuilder (`engine/persistence/engineRebuilder.ts`)

8-step audio graph restoration:
1. Create tracks with routing
2. Restore mixer state
3. Load instruments
4. Restore audio buffers from IndexedDB
5. Restore plugin chains
6. Set tempo / project format
7. Validate audio graph
8. Return result with any warnings

### 15.4 IndexedDBAdapter (`engine/filesystem/indexedDBAdapter.ts`)

Low-level wrapper (~611 lines):
- 4 object stores: `projects`, `assets`, `waveforms`, `settings`
- Asset deduplication via SHA-256
- Backup management with corruption detection
- Full CRUD for all stores

### 15.5 Autosave

- Debounced at 3 seconds via `requestIdleCallback`
- Subscribes to store changes
- Triggered in `EngineBoot` component (`app/providers.tsx`)

---

## 16. Database Schema

### 16.1 Prisma Schema (`prisma/schema.prisma`)

**Provider:** PostgreSQL (SQLite fallback via `DATABASE_URL=file:./dev.db`)

#### User
```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  projects     Project[]
}
```

#### Project
```prisma
model Project {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  name            String
  tempo           Int       @default(120)
  timeSignature   String    @default("4/4")
  keySignature    String    @default("C Maj")
  projectFormat   String    @default("stereo")
  surroundFormat  String    @default("5.1 (ITU 775)")
  spatialAudioMode String   @default("Off")
  stateJson       Json?     // Full DAW state blob
  shareId         String?   @unique
  isPublic        Boolean   @default(false)
  shareCreatedAt  DateTime?
  lastOpenedAt    DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  tracks          Track[]
  buses           Bus[]
}
```

#### Track
```prisma
model Track {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id])
  name       String
  type       String   // audio, midi, drum, aux, bus
  volume     Float    @default(0.8)
  pan        Float    @default(0.0)
  muted      Boolean  @default(false)
  soloed     Boolean  @default(false)
  color      String   @default("#888888")
  orderIndex Int      @default(0)
  clips      Clip[]
  plugins    Plugin[]
  automation Automation[]
  sends      Send[]
}
```

#### Clip
```prisma
model Clip {
  id       String   @id @default(cuid())
  trackId  String
  track    Track    @relation(fields: [trackId], references: [id])
  type     String   // audio, midi
  start    Float    // in beats
  duration Float    // in beats
  name     String
  color    String
  fileUrl  String?
  notes    Note[]
}
```

#### Note
```prisma
model Note {
  id       String @id @default(cuid())
  clipId   String
  clip     Clip   @relation(fields: [clipId], references: [id])
  pitch    Int
  velocity Int
  start    Float  // relative to clip start, in beats
  duration Float  // in beats
}
```

#### Automation & AutomationPoint
```prisma
model Automation {
  id        String   @id @default(cuid())
  trackId   String
  track     Track    @relation(fields: [trackId], references: [id])
  parameter String   // volume, pan, etc.
  points    AutomationPoint[]
}

model AutomationPoint {
  id           String     @id @default(cuid())
  automationId String
  automation   Automation @relation(fields: [automationId], references: [id])
  time         Float
  value        Float
}
```

#### Plugin, Bus, Send
```prisma
model Plugin {
  id           String @id @default(cuid())
  trackId      String
  track        Track  @relation(fields: [trackId], references: [id])
  name         String
  slotIndex    Int
  settingsJson String?
}

model Bus {
  id        String @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id])
  name      String
  sends     Send[]
}

model Send {
  id      String @id @default(cuid())
  trackId String
  track   Track  @relation(fields: [trackId], references: [id])
  busId   String
  bus     Bus    @relation(fields: [busId], references: [id])
  level   Float  @default(0.0)
}
```

---

## 17. API Routes

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | No | NextAuth credentials handler |
| `/api/auth/signup` | POST | No | Register user (validates, hashes, creates) |
| `/api/projects` | GET | Session | List user's projects |
| `/api/projects` | POST | Session | Create new project |
| `/api/project/[id]` | GET | Session | Get project with all relations |
| `/api/project/[id]` | PATCH | Session | Rename project |
| `/api/project/[id]` | DELETE | Session | Delete project |
| `/api/project/save` | POST | Session | Save full project state (upsert) |
| `/api/project/[id]/share` | POST | Session | Generate share link |
| `/api/project/[id]/share` | DELETE | Session | Revoke sharing |
| `/api/public/[shareId]` | GET | No | Fetch public project snapshot |
| `/api/account/update` | PUT | Session | Update display name |

---

## 18. WASM DSP Core

### 18.1 Rust Crate (`wasm/dsp-core/`)

**File:** `Cargo.toml`
```toml
[package]
name = "magic-dsp-core"
version = "0.1.0"
[lib]
crate-type = ["cdylib"]
[dependencies]
wasm-bindgen = "0.2"
[profile.release]
lto = true
opt-level = 3
```

### 18.2 Processors

#### EQ (`wasm/dsp-core/src/processors/eq.rs`)
- 3-band parametric equalizer
- Low shelf, peak bell, high shelf
- Gain, frequency, Q controls per band

#### Compressor (`wasm/dsp-core/src/processors/compressor.rs`)
- Dynamics compressor
- Threshold, ratio, attack, release, knee, makeup gain

### 18.3 Build

```powershell
# wasm/dsp-core/build.ps1
wasm-pack build --target web
```

### 18.4 Additional Rust Code (`rust/`)

A separate `rust/dsp-core/` crate with stubs for:
- FFT, SIMD, modulation, oversampling, memory management
- Plugin EQ and compressor (likely an overlapping/duplicate effort with `wasm/dsp-core/`)

---

## 19. TypeScript Errors & Build Status

### 19.1 Current Count: **127 errors** (`tsc --noEmit`)

| Category | Count | Examples |
|---|---|---|
| **Missing modules** | ~15 | `Cannot find module 'yjs'`, `'y-websocket'`, `'uuid'`, `'../../../models/AutomationPoint'`, `'../../../rendering/overlay/OverlayRenderer'` |
| **Non-existent properties** | ~12 | `Property 'automationLanes' does not exist on type 'Track'`, `Property 'mergeRegions'`, `Property 'transport'`, `Property 'yOffset'` |
| **Possibly undefined** | ~10 | `'clip.startBeat' is possibly 'undefined'` |
| **Type mismatch** | ~8 | `Type 'number[]' not assignable to type 'Float32Array'`, `Type '"off"' not assignable to type '"time" \| "pitch" \| "none" \| "both"'` |
| **Missing member** | ~5 | `'AdvancedScheduler' has no exported member`, `Property 'executeCommand'` |
| **Implicit any** | ~3 | `Parameter 'events' implicitly has an 'any' type` |
| **Argument errors** | ~2 | `Expected 1 arguments but got 2`, `not assignable to parameter` |

### 19.2 ESLint Status

ESLint is not configured. Running `next lint` triggers the first-time setup prompt. The project has no `.eslintrc.*` file.

### 19.3 Browser Console Errors (from test runs)

- 404 on `GET /api/project/proj-1781451919613-r81kaz` — stale project ID reference
- React `setState-in-render` warning in `GlobalKeyHandler`
- Various reference errors from missing modules (yjs, etc.)

---

## 20. Testing

### 20.1 Test Configuration (`jest.config.js`)

- Jest 30 with `ts-jest`
- Tests located in `engine/audioEngine/__tests__/` and `tests/`

### 20.2 Existing Tests

| Test | File | Lines | Description |
|---|---|---|---|
| Scheduler | `engine/audioEngine/__tests__/scheduler.test.ts` | 74 | Scheduler unit tests |
| Routing | `engine/audioEngine/__tests__/routing.test.ts` | 75 | Routing engine unit tests |
| Eraser Tool | `engine/tools/__tests__/EraserTool.test.ts` | 249 | Eraser tool unit tests |
| BPM Sync | `tests/integration/bpm-sync.test.ts` | 800 | BPM sync integration (largest test) |
| Playback | `tests/integration/playback.test.ts` | 41 | Playback integration |
| Engine Bench | `tests/benchmarks/engine.bench.ts` | 34 | Performance benchmark |

### 20.3 Coverage Gaps

| Area | Test Coverage |
|---|---|
| Audio engine | Partial (scheduler, routing only) |
| MIDI system | None |
| Instruments | None |
| Automation | None |
| Components | **None** |
| Stores | **None** |
| API routes | **None** |

---

## 21. Development Guide

### 21.1 Setup

```bash
npm install
npx prisma generate
npx prisma db push          # uses DATABASE_URL (Postgres or SQLite)
npx prisma db seed           # optional sample data
npm run dev                  # http://localhost:3000
```

### 21.2 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint (needs configuration) |
| `npx jest` | Run Jest tests |
| `npx tsc --noEmit` | TypeScript type checking |
| `npx prisma studio` | Open Prisma database UI |
| `wasm\dsp-core\build.ps1` | Build WASM DSP (Windows, needs wasm-pack) |

### 21.3 Dependencies

**Runtime:**
- `next`, `react`, `react-dom`, `zustand`, `immer`
- `@prisma/client`, `prisma`, `pg` (database)
- `next-auth`, `bcryptjs` (auth)
- `lucide-react` (icons)
- `@supabase/supabase-js`, `firebase` (optional cloud services)

**Dev:**
- `typescript`, `@types/*`
- `tailwindcss`, `postcss`, `autoprefixer`
- `eslint`, `eslint-config-next`
- `@types/jest`, `playwright`

### 21.4 Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (or `file:./dev.db` for SQLite) |
| `NEXTAUTH_SECRET` | NextAuth encryption key |
| `NEXTAUTH_URL` | Application URL (e.g., `http://localhost:3000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (optional) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (optional) |

---

## 22. Risks & Technical Debt

### 22.1 Critical

| # | Issue | Impact |
|---|---|---|
| 1 | **127 TypeScript errors** — Many are real type mismatches, missing module declarations, non-existent properties on types | Build fails, runtime crashes likely |
| 2 | **`projectStore.ts` is 4,819 lines** — Monolithic store coupling UI/engine/persistence/history | Maintenance nightmare, merge conflicts |
| 3 | **Dual audio engines** — `lib/audioEngine.ts` (legacy) still imported in some places alongside `engine/audioEngine/*` + `AudioEngineAdapter` | Inconsistent behavior, dead code |

### 22.2 Moderate

| # | Issue | Impact |
|---|---|---|
| 4 | **No component or store tests** | Large risk surface, regressions impossible to catch |
| 5 | **Browser runtime errors** — 404 on project API, React setState-in-render in GlobalKeyHandler | Broken user experience |
| 6 | **Collaboration stubs import yjs/y-websocket** — libs not in package.json | Runtime crash if code path is hit |
| 7 | **ESLint not configured** — `next lint` prompts for setup | No code quality enforcement |
| 8 | **Stale log files in root** (`console-errors.txt`, `output.txt`, `ts_errors.txt`, `typescript_errors.log`, `tsc-errors.txt`) | Repository clutter |

### 22.3 Low (Housekeeping)

| # | Issue |
|---|---|
| 9 | Legacy directories: `legacy/`, `magic-pro-modules/`, `vst/`, `sound sample/`, `scratch/`, `tmp/`, `src/` |
| 10 | Vendored Aider source (`Aider-AI-aider-a4be6cc/` — 666 files, ~741k lines) — likely unintentional in repo |
| 11 | Two Rust crates (`wasm/dsp-core/` and `rust/dsp-core/`) — overlapping/duplicate |
| 12 | `implementation_plan.md.resolved` describes cloud/collab/AI vision, `README.md` describes single-user DAW — documentation mismatch |
| 13 | `.env` listed in root (confirm `.gitignore` prevents commit) |
| 14 | Large binary files tracked in git history (WAV samples, VST presets, PDFs) — repo bloat |

---

## 23. Roadmap Gaps

Features from `implementation_plan.md.resolved` ("SoundForge Studio") **not yet implemented**:

### Cloud & Infrastructure
- ❌ S3 presigned upload/download
- ❌ Real-time CRDT collaboration (Yjs/Socket.IO server)
- ❌ Redis session/pubsub
- ❌ CI/CD pipeline (no `.github/`, no Docker)
- ❌ PWA support
- ❌ Stripe / subscription tiers

### AI Features
- ❌ AI chord suggestion
- ❌ Melody generation
- ❌ Stem separation
- ❌ Auto-mix suggestions
- ❌ Lyric assistant

### Additional DAW Features
- ❌ Third-party plugin sandbox (WASM iframe)
- ❌ Multi-user collaboration presence (cursors, avatars)
- ❌ MP3 export (WAV only currently)
- ❌ Stem export (separate track bounces partly done)

### What IS Implemented (despite not being in README)
- ✅ Live Loops grid
- ✅ Environment object system
- ✅ Project alternatives (variants)
- ✅ Beat mapping
- ✅ Surround format config
- ✅ Spatial audio mode config
- ✅ Articulation sets for MIDI
- ✅ Multi-sampler with DecentSampler format
- ✅ WebGL shader-based rendering
- ✅ 60fps navigation frame graph
- ✅ Undo/redo with selective snapshots
- ✅ Full metronome config (polyphonic, accent, count-in)

---

*End of PROJECT_DETAILED.md*
