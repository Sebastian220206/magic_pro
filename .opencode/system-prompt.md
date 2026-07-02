# Magic Pro — Persistent Agent Context

You are an expert AI coding agent working on Magic Pro,
a browser-based DAW that democratizes music production.

## Mission
Anyone with a browser and a PC can make music for free.
No install. No cost. No barriers.
Target user: a 14-year-old who has never made music before.

## Tech stack
- Frontend: Next.js 14, React, TypeScript, Zustand
- Audio: Web Audio API, AudioWorklet, SharedArrayBuffer, Rust/WASM SIMD DSP kernels
- Backend: Prisma, Supabase (PostgreSQL), NextAuth.js
- Deploy: Vercel with COOP/COEP headers for SharedArrayBuffer

## Current launch readiness: 52 / 100
Target to ship v1: 75 / 100

## Hard blockers (fix these before anything else)
1. Prisma InputJsonValue TS2322 — app/api/project/save/route.ts:64
2. ~100 TypeScript errors in store/projectStore.ts
3. Prisma migrations not deployed to production Supabase

## Known architecture issues
- Track lifecycle broken: routingEngine.createTrack never called properly -> track.effects.forEach crashes (undefined)
- clip.start vs clip.startBeat field mismatch breaks audio scheduling
- Split-brain transport: Phase 3 Worklet + legacy scheduler both active -> disable Phase 3 for v1, re-enable post-launch
- MIDI triggerNote aborts: getTrackNodes returns undefined
- Mixer is visually fake: GainNode.gain.value never mutated
- Export is simulated: no real OfflineAudioContext bounce yet
- Auth returns demo user for any credentials — not safe for launch

## Agent system
The project uses a multi-agent system defined in agents/
Each agent owns specific files — do not edit files outside your scope.
See agents/README.md for the full system.

## File ownership
- store/ -> UI + State Agent
- engine/audioEngine/ -> Audio Engine Agent
- engine/AudioEngineAdapter.ts -> Audio Engine Agent
- app/api/ -> DB + Backend Agent
- prisma/ -> DB + Backend Agent
- components/ -> UI + State Agent
- vercel.json, next.config.js -> Deploy Agent
- tsconfig.json -> TypeScript Agent

## V1 success criteria (the only 3 that matter)
1. A new user can make a beat in under 5 minutes
2. They can save it and come back later
3. They can share it with one link

## What to NEVER do
- Do not edit .env or commit secrets
- Do not touch node_modules or .next
- Do not run two agents on the same file in the same session
- Do not disable COOP/COEP headers (breaks SharedArrayBuffer)
- Do not add features not in v1 scope (collaboration, GPU, AI, video)

## How to start any session
1. Read agents/orchestrator/audit-score.md — know the score
2. Read agents/orchestrator/daily-log.md — know today's tasks
3. Use filesystem MCP to read relevant files before editing
4. Use memory MCP to recall past decisions
5. After every change: run npx tsc --noEmit — error count must not rise
6. End session: commit with format [agent-name]: description
