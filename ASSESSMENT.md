# Magic Pro DAW — Technical Assessment

**Date:** 2026-08-04
**Assessed by:** Incoming engineering owner
**Method:** Full read of the repository, import-graph reachability analysis, and
verification of every claim against a real `tsc`, `jest` and `next build` run.
Documentation was treated as a hypothesis, not as evidence.

---

## 0. How to read this document

The repo already contains three overlapping status documents
(`PROJECT_REPORT.md`, `PROJECT_DETAILED.md`, `ROADMAP_TO_LOGIC_PARITY.md`) that
**contradict each other and, in important places, contradict the code**. This
document supersedes them as the statement of record. Where it disagrees with
them, this document was verified by execution and they were not.

Section 19 lists what changed in this pass. Section 20 is the prioritised plan.

---

## 1. Project purpose

A browser-based Digital Audio Workstation — multi-track audio and MIDI
recording, arrangement, editing, mixing and export — built as a Next.js
application with a Web Audio engine. The stated benchmark is Logic Pro.

## 2. Product vision

Three documents describe three different products, and the gap between them is
itself a finding:

| Source | Vision |
|---|---|
| `README.md` | Single-user web DAW with cloud/AI as optional extras |
| `implementation_plan.md.resolved` | "SoundForge Studio" — collaborative cloud platform with CRDT, AI assistant, plugin marketplace |
| `ROADMAP_TO_LOGIC_PARITY.md` | Logic Pro feature parity, phased |

The **realistic and defensible** vision, based on what the code actually does
well, is the first one: *a genuinely good single-user browser DAW, with cloud
sync and AI assistance as adjuncts.* The collaboration platform vision is not
supported by any working code and should be explicitly deferred or dropped
rather than left as ambient scope.

## 3. Current development stage

**Advanced prototype approaching alpha.** Not production-ready, primarily for
security and verification reasons rather than feature reasons.

Verified state as of this assessment:

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `next build` | ✅ succeeds, 29 routes |
| `jest` | ✅ 307 tests / 26 suites passing |
| Lint config | ✅ present |
| CI | ✅ typecheck, lint, test, reachability gate, build |
| DAW workspace loads in a browser | ✅ verified via Playwright |
| **Can a user write and hear a song?** | ✅ **as of this pass** — see §11.7–11.9 |

Until this pass the honest answer to the last row was *no*: MIDI regions never
sounded, the transport's scheduling loop had never executed, and opening a
project threw before the workspace rendered. Those are fixed and covered by
tests. Loop playback for MIDI and the drifting UI playhead (§7.6) remain.

`ROADMAP_TO_LOGIC_PARITY.md`'s claim that Phase 0 is complete is **accurate on
build health**. Its claims that Phases 1, 4, 5 and 7 features are complete are
**not** — see §10.

## 4. Scale

| Area | Files | LOC |
|---|---:|---:|
| `engine/` | 329 | 76,903 |
| `components/` | 134 | 34,376 |
| `store/` | 7 | 9,336 |
| `app/` | 36 | 3,052 |
| `lib/` | 30 | 2,469 |
| Other (`models`, `hooks`, `templates`, `data`, `types`) | 20 | 1,737 |
| **Total** | **~566** | **~127,900** |

Largest single file: `store/projectStore.ts` at 4,860 lines.

## 5. System architecture

```
┌──────────────────────── Browser ────────────────────────┐
│                                                          │
│  React (app/, components/)                               │
│         │  reads/writes                                  │
│         ▼                                                │
│  Zustand stores (store/)                                 │
│    projectStore ◄── the single source of truth           │
│         │  imperative calls                              │
│         ▼                                                │
│  AudioEngineAdapter (engine/AudioEngineAdapter.ts)       │
│         │  facade over ↓                                 │
│    ┌────┴───────────────────────────────┐                │
│    │ scheduler   routingEngine          │  Web Audio     │
│    │ bufferCache recordingEngine        │  graph         │
│    │ metronome   bounceEngine           │                │
│    └────────────────────────────────────┘                │
│                                                          │
│  Persistence: IndexedDB (local) + POST /api/project/save │
└──────────────────────────────────────────────────────────┘
                          │
                   Next.js API routes
                          │
                    Prisma → PostgreSQL
```

The **live** data path is: React → `projectStore` → `AudioEngineAdapter` →
`advancedScheduler` → Web Audio nodes. This path is coherent and reasonably
well built.

There is a **second, dormant** audio architecture — `engine/dsp/runtime/global`,
`SharedTransportBuffer`, `ProjectToGraphSync`, a WASM SIMD core and an
AudioWorklet transport — gated off behind `ENABLE_PHASE3_TRANSPORT = false` in
`engine/config/runtimeFlags.ts`. See §7 and §17.

## 6. Strengths

These are real and worth protecting:

1. **The scheduler's clock handling is correct.** `engine/audioEngine/scheduler.ts`
   anchors playback to `AudioContext.currentTime` and derives beat position from
   elapsed audio time rather than accumulating. `setTempo` re-anchors `startTime`
   so tempo changes don't shift already-played material. This is the single
   hardest thing to get right in a DAW and it is right.
2. **Clean module boundaries in the engine.** Scheduling, routing, buffering,
   recording and bouncing are genuinely separate and separately testable.
3. **The adapter pattern is paying off.** `AudioEngineAdapter` gives the UI one
   stable surface; the legacy `lib/audioEngine.ts` was successfully removed.
4. **Serious algorithmic work exists** — O(log n) note/automation indices, spatial
   bucket caches, dirty-region invalidation, a 60fps navigation pipeline. The
   ambition is backed by real implementation, not stubs.
5. **Build health is genuinely good** — zero type errors across 127k LOC with
   `strict: true` is not trivial.
6. **Security headers are correct** — COOP/COEP/CORP, `nosniff`, a real
   `Permissions-Policy`. Someone thought about this.
7. **Stripe webhooks verify signatures** and admin soundfont routes check roles —
   the newest code is the most careful code.

## 7. Weaknesses

### 7.1 The central problem: build-without-wiring

**144 modules totalling ~29,500 LOC — roughly 23% of the application — are
unreachable from any entry point.** Not "unused utility functions": entire
finished features that nothing imports.

This is the signature of feature work done by agents in isolation: a file is
written, it compiles, it is marked complete, and it is never connected to the
app. Because it compiles and is never imported, neither `tsc` nor the tests nor
the build ever notice.

Representative examples, all confirmed unreferenced:

| Module | LOC | Claimed as |
|---|---:|---|
| `engine/midi/eventListEditor.ts` | 1,172 | — |
| `engine/score/guitarTab.ts` | 787 | Phase 7 ✅ |
| `engine/midi/beatMapEngine.ts` | 738 | tempo mapping |
| `engine/midi/controlSurfaceManager.ts` | 706 | Phase 7 ✅ "complete" |
| `store/clipEditingStore.ts` | 680 | active store |
| `store/mixerStore.ts` | 563 | active store |
| `components/ChannelEQ.tsx` | 560 | mixer EQ UI |
| `engine/audio/FlexTime.ts` + `FlexPitch.ts` + `Comping.ts` | 471 | Phase 1 ✅ "complete" |
| `engine/plugins/sandbox.ts` | 184 | Phase 4 ✅ "complete" |
| `components/score/ScoreEditor.tsx` | — | Phase 7 ✅ "complete" |

The roadmap marks these complete because the files exist. **File existence was
used as the definition of done.** That is the root cause to fix, not the
individual modules.

### 7.2 The WASM DSP core is never built or shipped

Every document lists "Rust → WebAssembly DSP core" as an architectural pillar.
Nine processors exist in `wasm/dsp-core/src/processors/` (EQ, compressor,
reverb, delay, saturation, chorus, limiter, de-esser).

**There is no `public/wasm/` directory.** `engine/bootstrap/EngineBootstrap.ts`
fetches `/wasm/dsp-core/magic_dsp_core_bg.wasm`, which would 404 — but the whole
block is behind `ENABLE_PHASE3_TRANSPORT = false`, so it never runs and never
errors. The Rust DSP layer has never executed in this application.

### 7.3 Two sources of truth in the database

`prisma/schema.prisma` defines `Track`, `Clip`, `Note`, `Automation`,
`AutomationPoint`, `Plugin`, `Bus`, `Send` — and **nothing in the codebase ever
writes to them.** A repo-wide search for `prisma.track.*`, `prisma.clip.*` etc.
returns nothing. All project state is written as a single `stateJson` blob on
`Project`.

Seven of eleven models are dead schema. This directly caused a user-facing bug
(§11.1).

### 7.4 Feature flags are decorative

`lib/featureFlags.ts` defines ~80 flags. `isFeatureEnabled` is imported by
**exactly one file: its own test.** No flag gates anything. Several are also
stale — `exportMp3: false` while MP3 encoding is implemented and offered in
`BounceDialog`. The file reads as a status report but has no authority.

### 7.5 `projectStore.ts` is a 4,860-line monolith

~700 lines of interface followed by ~340 actions covering transport, tracks,
clips, selection, automation, environment, alternatives, settings, panel
visibility and persistence. Every component subscribing to it is coupled to all
of it.

### 7.6 The UI playhead did not follow the audio clock — **fixed**

`projectStore.play()`'s render loop advanced the playhead by
`currentTempo / 60 / 60` per frame — frame-count accumulation — so the visible
position drifted from what was heard whenever the frame rate deviated from
60fps. It now reads `audioEngine.getCurrentBeat()`, the same AudioContext-derived
beat the scheduler uses to place notes.

Related and also fixed: the piano roll ran a *second* transport of its own
(`midiStore.isPlaying` / `currentBeat`, advanced by a private rAF timer) that
nothing ever started, so its playhead never moved at all. The project transport
is now mirrored into midiStore by `ProjectPianoRollAdapter`. See
`CHANGELOG-HANDOVER.md` §6.5.

### 7.7 Tempo automation does not reach the scheduler

The project models a tempo track (`globalTracks.tempo`), the UI edits it, and
`play()` reads the tempo at the current playhead — but the scheduler holds a
single scalar `this.tempo` and converts beats↔seconds linearly. Tempo *changes*
work; tempo *curves* do not affect scheduled audio. `beatMapEngine.ts`, which
appears intended to solve this, is unreferenced.

## 8. Risks

| # | Risk | Severity | Status |
|---|---|---|---|
| R1 | Any user could read/overwrite/delete any other user's project | **Critical** | ✅ Fixed this pass |
| R2 | Unauthenticated callers were treated as `user-1` | **Critical** | ✅ Fixed this pass |
| R3 | AI endpoints open to the internet, billed to the project owner | **High** | ✅ Fixed this pass |
| R4 | 23% dead code — future work built on modules that aren't wired | **High** | Documented, not resolved |
| R5 | Zero component/store test coverage of 43k LOC of UI | **High** | Infrastructure added; coverage still ~0 |
| R6 | Documentation actively misleads about what is done | **High** | This document supersedes |
| R7 | 19 npm advisories (4 critical, 13 high) | **Medium** | Not triaged |
| R8 | No staging environment or smoke test against a real browser | **Medium** | Open |

## 9. Technical debt (ranked by cost to carry)

1. **Dead code (~29,500 LOC).** Every future search, refactor and onboarding pays
   for it. Some of it is *nearly* valuable — Flex Time/Pitch, comping, the plugin
   sandbox are real implementations that just need wiring.
2. **`projectStore.ts` monolith.** Blocks parallel work and makes any state
   change high-risk.
3. **Dead relational schema.** Misleads every reader into thinking the DB is
   normalised. Also makes migrations ambiguous.
4. **Dormant Phase-3 DSP architecture.** A whole second engine design, off,
   undocumented as to whether it is the future or abandoned.
5. **Decorative feature flags.**
6. **Three contradictory status documents.**

## 10. Missing features (vs. the roadmap's own claims)

Marked ✅ in `ROADMAP_TO_LOGIC_PARITY.md`, but **not reachable by a user**:

- Flex Time / Flex Pitch / audio quantisation / comping (Phase 1)
- Third-party plugin sandbox + manifest + SDK (Phase 4)
- Score/notation editor (Phase 7)
- Video track (Phase 7)
- MIDI control-surface mapping (Phase 7)
- All six extra WASM effects — reverb, delay, saturation, chorus, limiter,
  de-esser (Phase 1): written in Rust, never compiled or loaded

Genuinely missing and honestly marked:
- Server-side stem separation (needs a model host + job queue)
- Sound library / content (Phase 2 — the real moat, and the least-started)
- LUFS/true-peak metering, multiband compression, surround/Atmos (Phase 3)
- Real-time collaboration (correctly deprioritised)

## 11. Bugs and inconsistencies found

### 11.1 Public sharing returned empty projects — **fixed**
`GET /api/public/[shareId]` read `project.tracks` (relational, always empty)
while the save path writes `stateJson`. Every shared link rendered a project
with no tracks. The share feature has never worked.

### 11.2 Recording had no reference playback and no click — **fixed**
`startRecording()` called `audioEngine.play(metronomeEnabled)`. That argument
was interpreted as "this is a boolean, so start with no clips", so the transport
rolled with an empty clip list. You recorded against silence.

### 11.3 The metronome was never connected — **fixed**
`engine/audioEngine/metronome.ts` is a complete, correct, self-scheduling click
generator that **nothing imported**. The transport had a metronome button, the
store had metronome state and settings, and no sound was ever produced.

### 11.4 Duplicate interface declaration — **fixed**
`ControlSurfaceAssignment` was declared twice, identically, in
`projectStore.ts`. TypeScript merges identical declarations silently, so it
survived a clean typecheck.

### 11.5 Crash on a project with an empty tempo track — **fixed**
`play()` indexed `globalTracks.tempo[idx].value` without a guard. New projects
seed one entry so it never fired locally, but any restored project with an empty
tempo array would throw.

### 11.6 Stem endpoint buffered 100 MB to say "not implemented" — **fixed**
It parsed the entire multipart upload before returning a placeholder message.

### 11.7 MIDI regions never played back — **fixed**
The transport called `audioEngine.playRegion()` once when play was pressed,
which triggered only the notes already sounding under the playhead at that
instant. Nothing sequenced MIDI afterwards: `advancedScheduler` had no MIDI code,
and `MidiScheduler` was never constructed because `initializeScheduler()` has no
callers. Pressing play on a MIDI arrangement produced at most one chord.

Audio clips were unaffected — they are scheduled as single long buffer sources —
which is why the gap survived so long. Fixed with a new
`engine/audioEngine/midiSequencer.ts` driven from the scheduler's lookahead loop.

### 11.8 The scheduling loop had never run — **fixed**
`createTimerWorker()` resolved its worker URL with
`new Function('return new URL(..., import.meta.url)')`. `import.meta` is a
SyntaxError inside a Function constructor in every environment — verified in both
Node and Chrome — so the call always threw, the `catch` returned `null`, and
`tick()` never fired. No drift correction, no `transportTick` events, and only the
first ~100 ms lookahead window was ever scheduled. Replaced with an inlined Blob
worker plus a `setInterval` fallback.

### 11.9 Opening any project crashed the workspace — **fixed**
`loadProject` replaced the settings object with the API payload instead of
merging, dropping `masterVolume`; `useAudioPlayer` then wrote `undefined` to an
AudioParam, throwing `The provided float value is non-finite` and taking down the
render. Both load paths now merge over defaults, and `setMasterVolume` rejects
non-finite input.

## 12. Documentation inconsistencies

| Claim | Source | Reality |
|---|---|---|
| "127 TypeScript errors" | `ROADMAP` header, `PROJECT_DETAILED` §19 | 0 errors |
| "AI features: not present" | `PROJECT_REPORT` §6 | Implemented and wired |
| "Stripe: not present" | `PROJECT_REPORT` §6 | Implemented, feature-flagged |
| "No CI configuration" | `PROJECT_REPORT` §9 | `.github/workflows/ci.yml` exists |
| "Collaboration stubs removed" | `ROADMAP` Phase 0 | Correct — but `AGENTS.md` still documents them as present |
| Phases 1/4/7 "complete" | `ROADMAP` | Code exists, is unreachable |
| "WAV is the only export format" | `components/ExportDialog.tsx:172` | MP3 implemented; `BounceDialog` offers MP3/M4A |
| Metronome listed as a feature | `README`, `engine/audioEngine/README.md` | Was not connected until this pass |

`PROJECT_REPORT.md` (June 2) is simply older than `ROADMAP` (June 21); both are
older than the code. They should be archived, not updated.

## 13. Performance issues

1. **`GET /api/project/[id]` ran a five-level join that always returned nothing** —
   `tracks → clips → notes`, `automation → points`, `plugins`, `buses → sends` —
   on every project open. Fixed: the blob is read directly and the join is only
   attempted as a legacy fallback.
2. **Frame-accumulated playhead** (§7.6) — correctness *and* jank under load.
3. **`projectStore` breadth** causes broad re-render fan-out; components
   subscribing to the store object rather than selectors re-render on unrelated
   state changes.
4. **No bundle budget.** 134 components, many heavy, with no code-splitting audit.

## 14. Security concerns

Fixed in this pass (details in §19):

| Finding | Severity |
|---|---|
| IDOR: `POST /api/project/save` upserted by id with no ownership check — any caller could overwrite any project | **Critical** |
| Broken access control: `GET /api/project/[id]` had no ownership check at all | **Critical** |
| Auth bypass: six routes fell back to `userId = 'user-1'` when signed out, and `prisma/seed.js` creates exactly that user | **Critical** |
| Unauthenticated AI endpoints — direct cost/abuse vector against the owner's OpenAI key | **High** |
| Any signed-in user could create a public Supabase bucket via the service-role key | **Medium** |
| Error responses leaked `err.stack` and serialised Prisma internals | **Medium** |
| Session ids and payload sizes logged on every save | **Low** |

Remaining, not addressed:
- **19 npm advisories (4 critical, 13 high)** — needs triage; `npm audit fix`
  may be partly safe but must be verified against the build.
- **No CSRF protection on state-changing routes** beyond NextAuth's own.
- **No request size limits** on `POST /api/project/save`; a project blob is
  unbounded and goes straight into Postgres.
- **In-memory rate limiting only** — per-instance, resets on cold start. Fine as
  a brake, not as a quota. Needs Redis before it protects a real bill.

## 15. Scalability concerns

1. **`stateJson` as the unit of persistence.** Every save rewrites the entire
   project. At a few hundred tracks with waveform peaks this becomes a
   multi-megabyte write on every autosave. This is the most important
   architectural decision to revisit — see §17.1.
2. **No pagination** on `GET /api/projects`.
3. **Rate limiting is per-instance** and will not survive horizontal scaling.
4. **Audio assets** go to Supabase with no CDN or lifecycle policy.

## 16. Code quality assessment

Better than the "built by AI agents" origin would suggest, with a specific and
consistent failure mode.

**Good:** strict TypeScript throughout with almost no `any` escape hatches; only
7 TODO/FIXME markers in 127k LOC; only 2 duplicate declarations repo-wide;
consistent naming; genuinely well-commented engine internals; sensible module
decomposition.

**Bad:** the code is *locally* excellent and *globally* incoherent. Individual
modules are well written. What is missing is the integration step — the wiring,
the end-to-end verification, and the deletion of what didn't make it. Quality
was measured per-file, and per-file it is fine. Nobody was measuring whether the
files formed a working product.

This is precisely what you would expect from many capable agents each given a
scoped task and no shared end-to-end test.

## 17. Recommended architectural improvements

### 17.1 Decide the persistence model — `stateJson` vs. relational

- **Why:** Seven Prisma models are dead, the two models disagree, and the
  disagreement already shipped a broken feature (§11.1). Every future
  server-side capability — collaboration, diffing, per-track sharing,
  server-side render — is blocked on this ambiguity.
- **Recommendation:** **Keep `stateJson`, delete the dead models.** The document
  model fits a DAW project well and the engine already round-trips it. Do not
  normalise; the relational schema was never load-bearing.
- **Impact:** Removes 7 models, clarifies every persistence discussion, deletes
  the legacy fallback path.
- **Risks:** Irreversible for any production row that has relational data —
  verify none exists first. Loses cheap server-side per-track queries; accept
  that, or add narrow projections later.
- **Dependencies:** A migration; confirmation that no deployed database has rows
  in those tables.

### 17.2 Adopt a reachability gate in CI

- **Why:** This is the fix for the root cause (§7.1). Dead code accumulated
  because nothing detected it. A lint rule closes the loop permanently.
- **Recommendation:** Add `knip` or `ts-prune` to CI with a baseline of the
  current 144 modules, and fail the build on *new* unreachable exports. Burn the
  baseline down over time.
- **Impact:** Makes "done" mean "reachable". Prevents recurrence.
- **Risks:** Low. Needs a baseline file so it doesn't block immediately.
- **Dependencies:** None.

### 17.3 Split `projectStore.ts` into slices

- **Why:** 4,860 lines and ~340 actions is the main obstacle to parallel work
  and the main source of re-render fan-out.
- **Recommendation:** Split into `transportSlice`, `tracksSlice`, `clipsSlice`,
  `selectionSlice`, `settingsSlice`, `persistenceSlice`, composed with Zustand's
  slice pattern so the public store surface is unchanged.
- **Impact:** Enables targeted subscriptions and independent testing.
- **Risks:** Medium — it is the highest-traffic file. Must be done in one
  mechanical pass with the store's public API held constant, behind tests.
- **Dependencies:** Store-level tests first (the jsdom project now supports them).

### 17.4 Drive the playhead from the audio clock

- **Why:** §7.6 — the visual playhead drifts from audio. In a DAW this is a
  correctness bug, not a polish item.
- **Recommendation:** Subscribe the render loop to `transportTick` /
  `getPreciseCurrentBeat()` and use rAF only to paint, never to advance time.
- **Impact:** Playhead becomes sample-accurate; removes a whole class of "my
  edit landed in the wrong place" bugs.
- **Risks:** Low; the correct value is already emitted.
- **Dependencies:** None.

### 17.5 Resolve the dormant Phase-3 DSP architecture

- **Why:** A second, disabled engine design is the most expensive kind of
  ambiguity — nobody knows whether to build on it.
- **Recommendation:** Either (a) commit: build the WASM artifacts, ship
  `public/wasm/`, and enable the worklet transport behind a real flag with a
  fallback; or (b) delete `engine/dsp/**` and `EngineBootstrap` and keep the
  Web-Audio-node engine. **Given no WASM has ever executed, (b) is the honest
  default** and (a) becomes a deliberate future project.
- **Impact:** Removes a large fork in the road.
- **Risks:** (b) discards real Rust work — but that work is in git and can
  return when there is a measured need for it.
- **Dependencies:** A decision, plus a performance benchmark if (a).

### 17.6 Wire or delete the finished-but-unreachable features

- **Why:** Flex Time/Pitch, comping, the plugin sandbox and the score editor are
  substantially built. They are either product or they are noise; right now they
  are noise that looks like product.
- **Recommendation:** Trial each against the actual product vision (§2). Wire
  the ones that serve a single-user DAW (comping, Flex Time). Delete the ones
  that serve the abandoned platform vision.
- **Impact:** Converts ~10k LOC from liability to feature, or removes it.
- **Risks:** Wiring untested engine code will surface latent bugs — expect real
  work per feature, not just an import.
- **Dependencies:** §17.2 to prevent regression.

### 17.7 Make feature flags real or remove them

- **Why:** §7.4. A flag file nobody reads is worse than none: it invites false
  confidence.
- **Recommendation:** Wire `isFeatureEnabled` into the surfaces it names and
  re-audit every value, or delete the file. Do not leave it as-is.
- **Impact:** Restores a single answer to "what ships?".
- **Risks:** Low.
- **Dependencies:** None.

## 18. Prioritised roadmap

**P0 — Trust (done in this pass).** Security holes closed, user-facing bugs
fixed, verification green. See §19.

**P1 — Stop the bleeding (next).**
1. Add the reachability gate to CI (§17.2) — *do this before any feature work,
   or the dead-code pile grows again.*
2. Triage the 19 npm advisories.
3. Drive the playhead from the audio clock (§17.4).
4. Decide `stateJson` vs. relational and execute (§17.1).
5. Add request size limits to `/api/project/save`.

**P2 — Consolidate.**
6. Resolve the Phase-3 DSP fork (§17.5).
7. Wire-or-delete the unreachable feature set (§17.6).
8. Split `projectStore` (§17.3).
9. Make feature flags real (§17.7).
10. Build store + component test coverage on the new jsdom project.

**P3 — Then, and only then, new features.**
11. Sound library and content (Phase 2) — the genuine differentiator and the
    least-started area.
12. LUFS/true-peak metering, multiband compression.
13. Server-side stem separation (needs infrastructure).

The ordering matters more than the contents. **Nothing in P3 should start until
P1 is finished**, because P1 items are what make P3 work verifiable.

---

## 19. Changes made in this pass

See `CHANGELOG-HANDOVER.md` for the complete list with rationale. Summary:

**Security (all verified by new tests):**
- New `lib/apiAuth.ts` — `requireUserId`, `requireAdminId`,
  `requireProjectOwner`, and `withApiHandler` for leak-free error handling.
- New `lib/rateLimit.ts` — fixed-window limiter; AI routes budgeted.
- Closed the save-route IDOR; added ownership checks to project read/update/delete.
- Removed the `|| 'user-1'` fallback from all six sites and from the client.
- Authenticated and rate-limited all five AI routes.
- Restricted bucket creation to admins.
- Stopped leaking stack traces and Prisma internals.
- Extended middleware to guard `/dashboard`, `/project`, `/admin`.

**Correctness:**
- Public sharing now reads `stateJson` (was: always-empty relational tables).
- Recording rolls the real transport (was: silence).
- Metronome connected end to end.
- Removed duplicate `ControlSurfaceAssignment`; guarded empty tempo track.

**Infrastructure:**
- jest split into `node` + `jsdom` projects; component testing now possible and
  proven with a first test. 252 → 276 tests.
- `npm run typecheck` / `test:node` / `test:ui` / `verify` scripts; CI generates
  the Prisma client before typecheck.

**Hygiene:**
- Deleted 21 Playwright/agent artifacts and a file literally named `{` from the
  repo root; `.gitignore` updated to prevent recurrence.
- Deleted unreferenced `legacy/` and `magic-pro-modules/` prototypes.
- Folded the one-file `src/` directory into `data/`.

**Verification after all changes:** `tsc` 0 errors · `jest` 276/276 ·
`next build` succeeds.

---

## 20. The one thing to take away

The engine is good. The security was not, and is now fixed. The real problem is
**not code quality — it is that 23% of the code was never connected to the
application, and the process that produced it defined "done" as "the file
exists."**

Fix the definition of done first (§17.2). Everything else follows.
