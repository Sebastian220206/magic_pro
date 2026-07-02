# Magic Pro DAW → Logic Pro Parity Roadmap

> **Source:** `PROJECT_DETAILED.md` (audit dated June 21, 2026)
> **Current state:** ~80,740 LOC, 127 TypeScript errors, build not clean
> **Goal:** Close the functional gap with Logic Pro in priority order — foundation first, then table-stakes features, then differentiation

---

## How to use this document

Each phase has a **goal**, **why it matters**, a **task list**, and the **files/dirs it touches** (pulled directly from your existing project structure). Phases are ordered by dependency, not by "coolness" — Phase 0 blocks everything else and should be finished before any new feature work, no matter how tempting the AI/collab features are.

Check off tasks as you go. This file is meant to be edited, not just read.

---

## Current State Snapshot

| Area | Logic Pro | Magic Pro | Gap |
|---|---|---|---|
| Build stability | Ships, decades-stable | 127 TS errors, doesn't build clean | 🔴 Blocking |
| Built-in effects | 100+ plugins | 2 (WASM EQ, Compressor) | 🔴 Large |
| Third-party plugins | Full AU support | None (sandbox not built) | 🔴 Large |
| Sound library | Thousands of patches/loops, Drummer | Basic synth/sampler/drum machine | 🔴 Large |
| Export formats | WAV, MP3, AAC, stems | WAV only | 🟡 Medium |
| Automation | Mature, sample-accurate | Sample-accurate, Bezier curves | 🟢 Comparable |
| MIDI editing | Mature piano roll, score editor | Piano roll w/ quantize/humanize, no score editor | 🟡 Medium |
| Mixing | Full channel strip, sends, multiband, Atmos | Channel strip, sends; no multiband/Atmos | 🟡 Medium |
| Rendering | Native Metal/Cocoa | WebGL2 timeline, 60fps nav loop | 🟢 Comparable approach |
| AI features | Stem split, chord/melody assist | None implemented (planned only) | 🔴 Large |
| Collaboration | N/A (Logic is single-user) | CRDT stubs only, no server | 🟡 Medium (not a Logic feature anyway) |
| Test coverage | Extensive internal QA | Scheduler/routing only; 0% on MIDI/instruments/automation/components/stores/API | 🔴 Large risk |

---

## Phase 0 — Make It Actually Work ✅ COMPLETE

**Goal:** A clean, reliable build with no silent breakage. Nothing else matters if this isn't true.

**Result:** All 10 tasks completed.
- ✅ 127 `tsc --noEmit` errors → **0 errors**
- ✅ Legacy audio engine removed (`lib/audioEngine.ts` deleted)
- ✅ `GlobalKeyHandler` setState-in-render fixed (useMemo lifted)
- ✅ Stale-project-ID 404 fixed (loadError state + error overlay UI)
- ✅ Collaboration CRDT stubs removed (`engine/collaboration/` deleted)
- ✅ ESLint configured (`.eslintrc.json` exists)
- ✅ Repo hygiene: Aider source deleted, stale logs removed, `rust/dsp-core/` consolidated into `wasm/dsp-core/`
- ✅ README reconciled with `implementation_plan.md.resolved`
- ✅ CI configured (`.github/workflows/ci.yml` with tsc, eslint, jest)
- ✅ Baseline test coverage: 38 new smoke tests (MIDI editing, instrument playback, automation, save/load round-trip); **122 tests passing**

**Effort:** Large, but mechanical. This is days-to-weeks of unglamorous work, not new engineering.

---

## Phase 1 — Table-Stakes DAW Features

**Goal:** Reach feature parity on things every modern DAW user expects by default — the absence of these reads as "broken," not "in progress."

- [x] **MP3 export** (currently WAV-only) — added `lamejs` to `engine/audioEngine/bounceEngine.ts` and `engine/filesystem/exportManager.ts`
- [x] **Stem export** — finished `bounceStems()` method in `bounceEngine.ts`
- [x] **Flex Time / audio warping** — implemented WSOLA time-stretch + warp markers in `engine/audio/FlexTime.ts`
- [x] **Flex Pitch** — YIN pitch detection + per-note correction in `engine/audio/FlexPitch.ts`
- [x] **Comping (take lanes)** — full take lane manager with crossfade comping in `engine/audio/Comping.ts`
- [x] **Audio quantization** — spectral-flux transient detector + grid snapping in `engine/audio/AudioQuantizer.ts`
- [x] Expand `wasm/dsp-core/src/processors/` beyond EQ + Compressor:
  - [x] Convolution/algorithmic reverb (`reverb.rs`)
  - [x] Delay (with sync-to-tempo) (`delay.rs`)
  - [x] Saturation/distortion (`saturation.rs`)
  - [x] Chorus/Phaser/Flanger (`chorus.rs`)
  - [x] Limiter (separate from master bus limiter) (`limiter.rs`)
  - [x] De-esser (`deesser.rs`)

**Effort:** Medium-large. Flex Time/Pitch are the hardest items here (real-time DSP, not just UI).

---

## Phase 2 — Sound Library & Content

**Goal:** Logic's real moat isn't the editor, it's the content. Without a library, even a flawless engine feels empty.

- [ ] Expand `engine/soundLibrary/` with curated instrument patches (not just raw synth/sampler engines)
- [ ] Grow `public/audio/loops/` beyond bass/drums/melodic into genre-organized packs
- [ ] Build a patch browser UI (search, preview, tag/category filter) — currently no equivalent exists in `components/`
- [ ] Multi-sampler content: ship a few real DecentSampler-format instruments (the engine supports it — `multiSamplerEngine.ts` — but content is the gap, not code)
- [ ] Drum machine kit expansion beyond trap/acoustic/808

**Effort:** Large, but mostly content production/curation rather than engineering — could be partially crowdsourced or licensed.

---

## Phase 3 — Professional Mixing & Mastering

**Goal:** Move from "can route audio" to "can finish a record."

- [ ] Multiband compression plugin
- [ ] LUFS / true-peak metering (currently only basic level metering in `audioMeter.ts`)
- [ ] Mastering chain template + loudness matching
- [ ] Turn the existing surround/spatial **config stubs** into an actual processing engine (you already have `Surround format config` and `Spatial audio mode config` per the roadmap audit — they're not wired to real multichannel DSP yet)
- [ ] Binaural/Atmos-style object panning (full Atmos is a stretch goal — binaural downmix is the realistic first step)
- [ ] Mix bus / send refinements: parallel compression bus presets, refined `SendControls`

**Effort:** Large. Metering and multiband compression are achievable; full Atmos is a multi-month effort even at a major studio.

---

## Phase 4 — Third-Party Plugin Ecosystem

**Goal:** Logic's extensibility comes from AU plugin support. You won't get native AU in a browser, but you can build an equivalent.

- [x] Design a WASM/AudioWorklet plugin sandbox — `PluginSandbox` + `IFramePluginSandbox` in `engine/plugins/sandbox.ts`
- [x] Define a plugin manifest spec — `PluginManifest` + `PluginParameter` in `engine/plugins/manifest.ts`
- [x] Build a standard plugin GUI embedding contract — `PluginUIContract` interface, `PluginHost` component, `UIRegistry` with React + IFrame + auto-gen UI fallback
- [x] Port your own EQ/Compressor to the new plugin API as reference implementations — `WasmEQUI` + `WasmCompressorUI` use `PluginUIContract`, registered via `registerBuiltins.ts`
- [x] Publish plugin SDK docs — `engine/plugins/PLUGIN_SDK.md` with full API reference, WASM example, and manifest spec

**Effort:** Large, high-leverage. This is the single feature most likely to let the ecosystem grow faster than you can build content alone.

---

## Phase 5 — AI Features

**Goal:** This is genuinely where you could differentiate rather than just chase Logic — but it's also the most expensive phase, so it comes after the foundation is solid.

- [ ] Stem separation: realistic path is calling a server-side model (e.g., Demucs) rather than running it client-side; needs a backend job queue
- [x] Chord suggestion (can be rule-based/ML-light to start — doesn't need a huge model) — `/api/ai/chords` + OpenAI integration
- [x] Melody generation — `/api/ai/melody` + OpenAI integration
- [x] Auto-mix suggestions (gain-staging/EQ suggestions based on frequency analysis — tractable as a v1) — `/api/ai/automix` + OpenAI integration
- [x] Lyric assistant — `/api/ai/lyrics` + OpenAI integration

**Effort:** Large, and the first item (stem separation) requires server infrastructure you don't currently have (no S3, no job queue — see Phase 6).

---

## Phase 6 — Cloud & Collaboration Infrastructure

**Goal:** Needed as a foundation for AI features (Phase 5) and real-time collab, not optional polish.

- [ ] S3 (or compatible) presigned upload/download for audio assets
- [ ] Real CRDT collaboration: implement the `yjs`/`y-websocket` server the stubs already assume, or remove the stubs if collab isn't a near-term priority
- [ ] Multi-user presence (cursors, avatars) — depends on the above
- [ ] Redis for session/pubsub if you proceed with real-time collab
- [ ] CI/CD pipeline + Docker (currently no `.github/` workflows, no containerization)
- [ ] PWA support (offline-capable shell)
- [ ] Stripe / subscription tiers — only after there's enough product to charge for

**Effort:** Medium-large, mostly infra/DevOps rather than DSP work.

---

## Phase 7 — Score, Video & Hardware (Stretch)

**Goal:** Logic's least-used-but-still-expected features. Lowest priority — do this last.

- [x] Score/notation editor — Canvas staff renderer with clefs, key/time signatures, noteheads, stems, accidentals, ledger lines in `engine/score/` + `components/score/ScoreEditor.tsx`
- [x] Video track with playback sync — HTML5 `<video>` backed `VideoEngine` (play/pause/seek/volume/fullscreen), `VideoTrack` component, `'video'` clip + track type added to models
- [x] Deeper MIDI control-surface mapping — `ControlSurfaceEngine` with MIDI message → assignment matching, MIDI learn mode, device connect/disconnect events
- [x] Multi-channel audio interface support refinement — `ChannelConfig` type with mono/stereo/quad/5.1/7.1/ambisonic formats, channel label utilities, input mapping

**Effort:** Large, niche audience. Only worth it if you have users specifically asking for scoring/post-production workflows.

---

## Quick Wins (do these regardless of phase order — high impact, low effort)

| Task | Why it's cheap | Phase |
|---|---|---|
| MP3 export | Single encoder library, well-trodden path | 1 |
| LUFS metering | Math problem, not architecture problem | 3 |
| ESLint config | Literally just running the setup wizard | 0 |
| Remove vendored Aider source + stale logs | Pure deletion | 0 |
| Reconcile README vs implementation plan | Documentation only | 0 |

## Moonshots (high impact, but don't start until Phase 0–2 are done)

| Task | Why it's expensive | Phase |
|---|---|---|
| Third-party plugin sandbox | New security/API surface to design from scratch | 4 |
| Stem separation | Needs server-side ML infra you don't have yet | 5 |
| Dolby Atmos mixing | Multi-month effort even for established studios | 3 |
| Real-time CRDT collaboration | Needs a stateful server + conflict resolution at scale | 6 |

---

## Suggested Sequencing (realistic, solo/small-team pace)

1. **Phase 0** — non-negotiable, do alone, no shortcuts
2. **Phase 1** — gets the app to "usable for real songs"
3. **Phase 2** in parallel with late Phase 1 — content production can happen while you code
4. **Phase 3** — turns "usable" into "can finish a track end-to-end"
5. **Phase 4** — unlocks community-driven growth (plugins) once the core is stable
6. **Phase 5 & 6** together — AI features need the cloud infra from Phase 6 anyway
7. **Phase 7** — only if user demand specifically calls for it

---

## Notes

- This roadmap assumes Logic Pro's *current* (as of early 2026) feature set as the benchmark, including AI stem splitting and session players. Apple ships updates regularly — re-check Logic's feature list periodically rather than treating this document as static.
- "100% parity" with Logic Pro is not really achievable or even the right goal for a browser-based, likely-solo-developed project — Logic has a multi-decade head start and a dedicated team. A more realistic target after Phases 0–3 is "a genuinely usable, stable DAW with a clear identity," not a pixel-for-pixel Logic clone.
