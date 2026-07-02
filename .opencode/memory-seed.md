# Magic Pro — Memory Seeds

These facts must be stored in the memory MCP at session start.

LOAD THESE INTO MEMORY:

entity: "Magic Pro"
type: "project"
facts:
  - "Browser-based DAW built with Next.js, TypeScript, Zustand, Prisma"
  - "Deploys to Vercel with COOP/COEP headers"
  - "Uses AudioWorklet + SharedArrayBuffer for real-time DSP"
  - "Has SIMD WASM DSP kernels in engine/dsp/"
  - "Current launch score: 52/100, target 75/100"
  - "V1 must ship in 6 weeks"

entity: "Hard Blockers"
type: "bugs"
facts:
  - "Prisma InputJsonValue TS2322 at app/api/project/save/route.ts:64"
  - "100+ TypeScript errors in store/projectStore.ts"
  - "Prisma migrations not deployed - ENOTFOUND to Supabase pooler"

entity: "Audio Engine Architecture"
type: "architecture"
facts:
  - "V2 engine lives in engine/audioEngine/ - modular, correct"
  - "Legacy engine in engine/audioEngine.ts - being phased out"
  - "AudioEngineAdapter.ts is the single interface the UI uses"
  - "Phase 3 Worklet transport is disabled via ENABLE_PHASE3_TRANSPORT=false"
  - "Legacy scheduler in engine/audioEngine/scheduler.ts handles all playback for v1"
  - "clip.startBeat is the correct field - not clip.start"

entity: "Agent System"
type: "workflow"
facts:
  - "8 specialist agents + 1 orchestrator defined in agents/"
  - "Each agent owns specific files - see agents/*/scope.md"
  - "Commit format: [agent-name]: description"
  - "Build must pass after every agent session"
  - "Audio Engine Agent and UI Agent must never edit same file same day"

entity: "Completed Work"
type: "history"
facts:
  - "COOP/COEP headers added to vercel.json and next.config.js"
  - "~30 dead UI elements removed from TransportBar, AppMenuBar, ExportDialog"
  - "Dashboard CRUD complete - rename, delete, create, timestamps"
  - "CRDT hardcoded localhost removed - reads NEXT_PUBLIC_CRDT_URL"
  - ".env.example complete with 100-line template"
  - "CrossOriginIsolationOverlay and runtime diagnostics page built"
  - "integrationExample.ts renamed to .tsx - 145 TS errors cleared"

entity: "Deferred to Post-Launch"
type: "decisions"
facts:
  - "Phase 3 AudioWorklet transport - too risky for v1"
  - "Recording - recording.processor.ts needs compilation to JS first"
  - "Collaboration - CRDT system exists but not wired"
  - "GPU rendering - WebGL2 foundation exists but not active"
  - "SIMD WASM kernels - built but not integrated in v1 DSP path"
  - "AI music assistant - Phase 8 in roadmap"
  - "Mobile support - desktop only for v1"
