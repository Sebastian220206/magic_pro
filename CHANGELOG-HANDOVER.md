# Handover Changelog — Ownership Pass, 2026-08-04

Every change made while taking ownership of the project, with the reasoning.
Companion to `ASSESSMENT.md`.

**Verification after all changes:**
`tsc --noEmit` → 0 errors · `jest` → 505 passed / 42 suites · `next build` → success ·
DAW workspace verified loading in a real browser (Playwright).

> **Part 2 (§6) makes the DAW usable for writing music.** Before it, MIDI
> regions never played back, the transport's scheduling loop had never run, and
> opening any project crashed the workspace.

---

## 1. Security

### 1.1 New: `lib/apiAuth.ts`

Central authorization for API routes.

| Export | Purpose |
|---|---|
| `requireUserId()` | Session user id, or throws 401 |
| `requireAdminId()` | Same, plus `role === 'admin'`, or 403 |
| `requireProjectOwner(id)` | 401 / 404 / 403 as appropriate; returns owner id |
| `withApiHandler(ctx, fn)` | Wraps a route so `ApiError`s become responses and anything else is logged server-side and returned as a generic 500 |
| `ApiError`, `unauthorized()`, `forbidden()`, `notFound()`, `badRequest()` | Typed errors carrying HTTP status |

**Why:** authorization was being re-implemented inline in every route, and each
implementation was subtly different — some checked ownership, some didn't, and
all of them shared the same broken fallback. One helper makes the correct thing
the easy thing.

### 1.2 Fixed: IDOR in `POST /api/project/save` — **critical**

`prisma.project.upsert({ where: { id }, update: {...} })` had **no ownership
check on the update branch**. Any caller who knew or guessed a project id could
overwrite that project wholesale.

Now: if the project exists and belongs to somebody else, the request is
rejected with 403 before the upsert.

### 1.3 Fixed: no ownership check on `GET /api/project/[id]` — **critical**

The route computed `userId` and then never used it. Any caller could read any
project's complete state.

Now: `requireUserId()` plus an explicit owner comparison, 403 on mismatch.

### 1.4 Fixed: the `|| 'user-1'` auth bypass — **critical**

Six server sites and two components resolved identity as
`session?.user?.id || 'user-1'`. `prisma/seed.js` creates a user with exactly the
id `user-1`. So every unauthenticated request was silently executed **as a real
user** — listing, creating, reading, modifying and deleting that user's projects.

Removed from all eight sites. Anonymous callers now receive 401.

Also removed the now-misleading `userId` parameter from
`saveProject` / `saveAs` / `saveCopyAs` in `store/projectStore.ts` and from the
request body — ownership is a server-side fact and the client should not appear
to influence it. (`saveAs`/`saveCopyAs` were hardcoding `userId: 'user-1'`.)

### 1.5 Fixed: unauthenticated AI endpoints — **high**

`/api/ai/{chords,melody,lyrics,automix,stems}` had no authentication and no rate
limiting, while calling OpenAI on the project owner's key. Anyone who found the
URLs could spend the owner's money at will.

Now: `requireUserId()` on all five, plus a per-user rate limit (20/min) via the
new `lib/rateLimit.ts`. Inputs are also bounded — chord length, bar count, lyric
topic/context length, and the auto-mix track array are all clamped, because each
is interpolated into a model prompt.

### 1.6 Fixed: `/api/storage/ensure-bucket` privilege — **medium**

Any signed-in user could create a **public** Supabase bucket using the
service-role key. Now admin-only.

### 1.7 Fixed: error and log leakage — **medium**

- `POST /api/project/save` returned `err.stack` to the client.
- `GET /api/project/[id]` returned a serialised Prisma error object as `debug`.
- The save route logged session id, body user id and payload size on every call.

All replaced by `withApiHandler`, which logs server-side and returns
`{ error: 'Internal Server Error' }`.

### 1.8 Hardened: middleware coverage

`middleware.ts` matched only `/account`. Extended to `/dashboard`, `/project`
and `/admin`. API routes are deliberately excluded — they enforce their own
authorization and must answer 401/403 as JSON rather than redirect to a login
page.

### 1.9 Changed: `/api/ai/stems` responds 501 without reading the body

It previously parsed an entire multipart upload (up to 100 MB) only to return a
"not implemented" message. It now rejects before consuming the request.

---

## 2. Correctness

### 2.1 Fixed: public sharing has never worked

`GET /api/public/[shareId]` projected its response from `project.tracks` — the
**relational** tables. Nothing in the codebase writes those tables; all state
goes to `Project.stateJson`. Every shared link therefore rendered a project with
zero tracks.

Rewritten to project from `stateJson`. Plugin *settings* are deliberately
withheld from the public payload; only slot names are exposed.

### 2.2 Fixed: recording rolled the transport with no clips

```ts
// before
audioEngine.play(s.metronomeEnabled)   // boolean → startPlayback([], [], ...)
```

`AudioEngineAdapter.play()` accepted `AudioClip[] | boolean`. Passing a boolean
took a branch that started the scheduler with **empty clip and track lists** and
ignored the flag entirely. Recording therefore played nothing back — no existing
arrangement, no click.

`startRecording()` now goes through `get().play()`, which performs the full
routing, FX-chain and mix-state setup. The `boolean` overload was removed from
`play()` so the mistake cannot recur.

### 2.3 Fixed: the metronome was never connected

`engine/audioEngine/metronome.ts` is a complete, correct, self-scheduling click
generator — and **no file imported it**. The transport had a metronome button
and the store had metronome settings; no sound was ever produced.

Wired end to end:
- `AudioEngineAdapter` gained `setMetronomeEnabled`, `isMetronomeEnabled` and
  `configureMetronome`, and re-arms the click after the transport is anchored.
- `stop()` / `stopPlaybackAndReset()` silence it.
- New `syncMetronome()` helper in `projectStore` applies Logic's semantics —
  in simple mode `metronomeEnabled` is the only switch; in advanced mode
  playback and recording have independent toggles — and is called from `play`,
  `stop`, `startRecording`, `toggleMetronome` and `setMetronomeSetting` so the
  click responds immediately rather than at the next transport start.

### 2.4 Fixed: duplicate `ControlSurfaceAssignment` interface

Declared twice, identically, in `projectStore.ts`. TypeScript merges identical
interface declarations without complaint, so a clean typecheck hid it.

### 2.5 Fixed: crash on a project with an empty tempo track

`play()` did `globalTracks.tempo[idx].value` with no guard. New projects seed one
entry, so it never fired locally — but any restored project with an empty tempo
array would throw. Now optional-chained with a 120 BPM fallback.

### 2.6 Improved: removed an always-empty five-level join

`GET /api/project/[id]` joined `tracks → clips → notes`, `automation → points`,
`plugins` and `buses → sends` on every project open. Since nothing writes those
tables the join always returned nothing. The fast path now reads `stateJson`
directly; the join survives only as an explicit legacy fallback for rows written
before the blob migration.

---

## 3. Test infrastructure

### 3.1 jest now has two projects

`testEnvironment` was `node` and `testMatch` covered only `.ts` — so **no
component test could ever run**, which is why 43,000 lines of UI had zero
coverage.

Split into:
- **`node`** — engine, persistence, MIDI, lib, integration and smoke tests.
- **`ui`** — jsdom, for `components/**/*.test.tsx` and store tests.

`tests/setupUi.ts` stubs Canvas 2D, Web Audio, `ResizeObserver`,
`IntersectionObserver` and `matchMedia` — jsdom implements none of them, and DAW
components touch all of them on mount.

ts-jest needed an explicit `jsx: 'react-jsx'` override: the app's tsconfig uses
`jsx: 'preserve'` because Next.js does its own transform, but ts-jest emits the
final JS and would otherwise fail on the first `<`.

Added `jest-environment-jsdom`, `@testing-library/react`,
`@testing-library/jest-dom`, `@testing-library/user-event`.

### 3.2 New tests

| File | Covers |
|---|---|
| `lib/__tests__/apiAuth.test.ts` | Every authorization path: anonymous rejection (the `user-1` regression), non-owner 403, missing 404, admin gating, and that unexpected errors don't leak internals |
| `lib/__tests__/rateLimit.test.ts` | Limit enforcement, per-key isolation, window reset, 429 shape |
| `components/__tests__/Toast.test.tsx` | First component test — also proves the jsdom project works |
| `tests/integration/playback.test.ts` | Extended: click-track arming, silencing on stop, and that `startRecording` performs full transport setup (regression for §2.2) |

252 → 276 tests.

### 3.3 Scripts and CI

Added `typecheck`, `test:watch`, `test:node`, `test:ui` and `verify`
(`typecheck && lint && test`). CI now runs `prisma generate` before typecheck —
API routes import the Prisma client, so it must exist first.

---

## 4. Repository hygiene

- **Deleted 21 agent/Playwright artifacts** from the repo root: six `.yml`
  accessibility snapshots, thirteen `.png` screenshots, `after-create-click.md`,
  and a zero-byte file literally named `{` (a stray shell redirect, committed).
- **Deleted `legacy/` (14 files) and `magic-pro-modules/` (4 files)** —
  pre-Next.js vanilla-JS prototypes, confirmed unreferenced by import-graph
  analysis. Recoverable from git history.
- **Folded `src/` into `data/`** — `src/` held exactly one module
  (`loopLibrary.ts`) while every other module lives at the repo root. Import in
  `components/LoopBrowser.tsx` updated.
- **`.gitignore`** now ignores root-level `*.yml` / `*.png` / `*.log` (with
  `docker-compose.yml` and `vercel.json` excepted) so these artifacts stop
  returning.

## 5. Documentation

- **`ASSESSMENT.md`** (new) — the statement of record. Supersedes
  `PROJECT_REPORT.md`, `PROJECT_DETAILED.md` and `ROADMAP_TO_LOGIC_PARITY.md`,
  which are stale and mutually contradictory.
- **`docs/CONTINUITY.md`** (new) — how to work on this project across context
  resets without losing the plot.
- **`lib/featureFlags.ts`** — header added stating plainly that the module is
  advisory and enforced nowhere, with the two ways to resolve it.

---

## 6. Making the DAW actually usable for a song

Investigating "can I write a song in this?" surfaced three defects that, in
combination, made the answer no. All three are fixed.

### 6.1 MIDI regions never played back — **the headline bug**

`projectStore.play()` called `audioEngine.playRegion()` **once per clip**, at the
moment play was pressed. Inside `playRegion`, the MIDI branch triggered only the
notes whose span already contained the playhead:

```ts
clip.notes?.forEach((note) => {
    if (noteStartBeat <= positionBeat && positionBeat < noteStartBeat + note.duration) {
        this.triggerNote(...);   // and a setTimeout for note-off
    }
});
```

Nothing advanced MIDI after that. `advancedScheduler` contained no MIDI code at
all, and `MidiScheduler` — which exists in `engine/midi/midiScheduler.ts` — was
never constructed, because `initializeScheduler()` has no callers. So pressing
play on a MIDI arrangement produced at most one chord, then silence.

Audio clips were unaffected because they ride the scheduler as single buffer
sources, which is why the gap was easy to miss.

**Fix:** new `engine/audioEngine/midiSequencer.ts` — pure beat/second arithmetic
that resolves the notes starting inside a lookahead window into absolute
AudioContext times. `AdvancedScheduler` runs it on every tick beside audio
scheduling and hands the results to a `MidiSink`. It handles:

- clip position, per-clip and per-track transpose/velocity offsets, including
  the Summing-stack inheritance the old store code implemented
- notes clipped to their region's end, so an overhanging note stops with the region
- notes already sounding when playback starts or seeks into them — they begin
  immediately, truncated, rather than being skipped
- mute/solo, evaluated live against the routing engine
- de-duplication across overlapping windows

`AudioEngineAdapter` implements `MidiSink`. All three backends already accepted a
start time (`SoundFontInstrument.noteOn(note, vel, time)`,
`MultiSamplerEngine.playNote(note, vel, time)`, and `SynthVoice.start(time)`),
so **sequenced playback is sample-accurate, not timer-driven.** Added
`SynthEngine.scheduleNote(...)`, which keeps sequenced voices in their own set
rather than the pitch-keyed `activeVoices` map — otherwise a fast repeated note
inside one window would cancel itself.

Also fixed a latent bug in `SynthVoice.stop()`: its cleanup `setTimeout` was
measured from *now* rather than from the stop time, so a note scheduled to end
seconds in the future had its nodes disconnected almost immediately.

### 6.2 The scheduling loop had never run — **hard blocker**

```ts
const url = new Function('return new URL("./scheduler.worker.ts", import.meta.url)')();
```

`import.meta` is a SyntaxError inside a `Function` constructor body — the code is
not a module. This throws in **every** environment; verified in Node and in
Chrome. The `catch` returned `null`, `startSchedulingLoop()` bailed out, and
`tick()` never fired.

Consequences: no drift correction, no `transportTick` events, and only the first
~100 ms lookahead window was ever scheduled. Audio clips near the playhead still
played (they are scheduled as one long buffer source) which masked it; clips
later in the timeline never started, and MIDI could not work at all.

**Fix:** the worker is now built from an inlined Blob URL — self-contained, with
no bundler coupling — plus a `setInterval` fallback when Workers are
unavailable. Verified in-browser that the Blob worker ticks and that the old
pattern throws. Also fixed a stale-closure bug: the reused worker captured the
`clips`/`tracks` from the *first* playback, so later playbacks scheduled the
wrong project. Ticks now read `clipsCache`/`tracksCache`.

### 6.3 Opening any project crashed the workspace

```
TypeError: Failed to set the 'value' property on 'AudioParam':
The provided float value is non-finite.
    at RoutingEngine.setMasterVolume (routingEngine.ts:600)
```

`loadProject` did `settings: data.settings || get().settings` — a **replace**,
not a merge. The API returns `{ sampleRate, projectStart, projectEnd }` when a
project has no stored settings, which is truthy, so it wholesale replaced the
settings object and dropped `masterVolume`. `useAudioPlayer` then fed `undefined`
straight into an AudioParam.

**Fix:** both load paths now merge over the store defaults, so a partial or
older payload cannot strip fields the engine requires. `setMasterVolume` also
rejects non-finite input outright — an AudioParam should never be handed `NaN`
regardless of who calls it.

### 6.4 Tests added

| File | Covers |
|---|---|
| `engine/audioEngine/__tests__/midiSequencer.test.ts` | 17 tests: window selection, beat→time conversion, clip offsets, held notes across seeks, region clipping, mute/solo, transpose/velocity clamping |
| `engine/audioEngine/__tests__/schedulerMidi.test.ts` | 10 tests: end-to-end sequencing across a simulated transport run, no double-scheduling, note clearing on stop/seek/tempo, and that the tick loop keeps scheduling past the first window |
| `engine/audioEngine/__tests__/routing.test.ts` | Non-finite master volume is ignored rather than thrown |

276 → 307 tests.

### 6.5 The piano roll playhead never moved

The piano roll draws its cursor from midiStore's `isPlaying` / `currentBeat`, and
advanced them with **its own `requestAnimationFrame` timer** — a second,
independent transport. That timer only ran when `midiStore.isPlaying` was true,
and the only code that ever set it was `midiStore.play()`, which nothing calls.
So the main transport rolled while the editor's playhead sat at beat 0 forever.

Fixed by giving the app one clock:

1. **`AudioEngineAdapter.getCurrentBeat()`** exposes the scheduler's precise,
   AudioContext-derived beat.
2. **`projectStore`'s playback loop now reads that beat** instead of
   accumulating `tempo / 60 / 60` per frame. This also resolves the playhead
   drift recorded in `ASSESSMENT.md` §7.6 — the visible position can no longer
   diverge from what is being heard.
3. **`ProjectPianoRollAdapter` mirrors the project transport into midiStore.**
   That adapter already existed to bridge the two stores for notes; it simply
   never bridged the transport. Existing midiStore consumers (MIDI recorder
   position, step input, Go-To-Beat dialog) keep working unchanged.
4. **The piano roll's private rAF timer was deleted**, leaving only the
   auto-scroll follow behaviour.

`midiStore` gained a `setIsPlaying` action, since it previously had no way to
set that flag other than the dead `play()`.

Verified in a real browser with the piano roll open on a 16-note region:

| Sample | project playhead | midiStore beat | engine beat |
|---|---:|---:|---:|
| before play | 0 | 0 | 0 |
| +1.0 s | 2.142 | 2.142 | 2.218 |
| +2.5 s | 5.184 | 5.184 | 5.242 |

The editor playhead now tracks the transport exactly, and the transport tracks
the audio clock. A screenshot confirms the cursor rendering at the right bar.

### 6.6 Development-only store globals

`window.__magicPro` now exposes `{ projectStore, midiStore, audioEngine }`
outside production (`app/providers.tsx`). There was previously no way to inspect
transport or store state from the console, which made both live debugging and
browser-driven verification far harder than necessary.

### 6.7 Library instruments never sounded — everything played as synth

Loading a sound from the Library panel had no audible effect: every note, in the
piano roll and on the timeline, came out as the built-in synth.

**Cause: three parallel instrument registries that never talked to each other.**

| Registry | Written by | Read by |
|---|---|---|
| `engine/instruments/instrumentService` | Library panel → `useInstruments.loadSoundFont()` | **nothing in the playback path** |
| `lib/soundfontStore` `SoundFontManager` | a separate SoundFont selection flow | `AudioEngineAdapter.triggerNote` step 1 |
| `AudioEngineAdapter.samplerEngines` | `loadInstrument()` | `triggerNote` step 2 |

The Library wrote to the first; playback read the second and third. So note
resolution always fell through to `SynthEngine`.

A second, independent bug guaranteed the same outcome even for the sampler path:
`projectStore` called `audioEngine.triggerNote(trackId, pitch, velocity, repeatRate)`
without the fifth `instrument` argument, so the sampler branch — which is gated
on `instrument && samplerPresets[instrument]` — could never be entered.

Fixes:
1. `triggerNote`, `releaseNote` and `scheduleNote` now consult
   `instrumentService` **first**, since that is the registry the loading path
   actually populates. Sequenced playback therefore uses the selected instrument
   too, not just live keypresses.
2. `allNotesOff` clears instrumentService voices alongside the synth/sampler ones.
3. `projectStore` passes `targetTrack.instrument` through to the engine.
4. `InstrumentService` now routes instrument output through the **track's channel
   strip** instead of connecting straight to `ctx.destination`. Previously a
   loaded instrument bypassed the mixer entirely — track volume, pan, mute, solo
   and inserts had no effect on it, and it could not be bounced.

### 6.8 Six engine gaps closed

**Piano roll note offset.** Notes are stored clip-relative, but the editor draws
its grid, bar numbers, loop markers and playhead in absolute timeline beats.
`projectSync` passed offsets through unchanged, so a region not starting at bar 1
rendered its notes shifted left by the region's start. Now translated to absolute
on load and rebased on save, with a negative-offset guard so dragging a note
before its region cannot corrupt it. 6 round-trip tests.

**Tempo curves.** The scheduler held one scalar BPM, so the tempo track moved the
readout but never the audio. New `tempoMap.ts` integrates tempo over beats —
exact for step changes, and using the analytic integral `60·B·ln(r)/Δ` for linear
ramps. Clip *durations* are now measured across their own span too: a duration in
beats has no fixed length in seconds once a tempo track exists, and converting it
from beat 0 was only ever correct at constant tempo. 19 + 4 tests.

**Plugin delay compensation.** Did not exist. New `latencyCompensation.ts`
computes per-track padding so every track arrives at the master aligned with the
highest-latency one; `routingEngine` applies it through a `DelayNode` at the end
of each chain, ramped rather than stepped so changes don't click. Plugins may
self-report latency (how a WASM/third-party plugin declares its own), bypassed
plugins contribute nothing, and a runaway report is clamped. 17 + 6 tests.

**LUFS / true-peak metering.** `MasterOutput.tsx` rendered `Math.random()` — it
looked like a working meter and carried no signal at all — and was itself never
mounted. Its `MasterVolume` was local state that never reached the engine. Now:
`AudioEngineAdapter.startLoudnessMetering()` drives the real EBU R128 meter off
the master bus, a `LoudnessReadout` (M/S/I, LRA, true peak, target compliance)
is mounted in the Mixer, and the fader writes through to the store.

**Track freeze.** The freeze button flipped a boolean nothing acted on. New
`trackRender.ts` renders a track offline through `renderSongOffline` — the same
renderer as export, so a frozen track sounds like the exported file. Source clips
are muted rather than destroyed, so unfreezing is lossless; the render is dry, so
fader, pan, mute and solo stay live.

**Bounce in Place.** Created an audio clip with no buffer behind it — bounced
tracks were silent. Now renders real audio and attaches it via `sampleId`.

**Flex Time / Flex Pitch.** The DSP existed but nothing called it, so
`flexEnabled` / `flexTimeFactor` / `flexPitchOffset` did nothing. New
`flexRender.ts` applies WSOLA stretching and stretch-then-resample pitch
shifting, cached by settings hash because WSOLA is far too slow for the
scheduling loop. 20 tests.

**Comping / take folders.** Nothing resolved a take folder to a take, so folders
played silence and comping had no effect. New `takeResolver.ts` resolves the
active take (or comp) and repositions it onto the folder's timeline slot — takes
are recorded at beat 0 but the folder may sit anywhere. 16 tests.

Tests: 312 → 399. Dead-code baseline: 144 → 143 files.

### 6.9 Library instruments were destroyed by closing the Library panel

§6.7 made `triggerNote` consult `instrumentService`, but instruments still did
not sound. The remaining cause was **lifetime, not routing**.

`useInstruments()` was mounted by exactly one component — `LibraryPanel` — and
its cleanup called `service.dispose()`, which disposes every instrument adapter,
clears all assignments and resets `initialized`. The panel is rendered as
`{showLibrary && <LibraryPanel/>}`, so it unmounts whenever the Library is
closed. With `reactStrictMode: true` the mount/unmount/mount cycle also fired
`dispose()` immediately after the first load. Either way the instrument was gone
by the time a key was pressed, and playback fell back to the synth.

A UI panel owning the audio graph's lifetime is the underlying design error.
Fixed by:

1. **New `engine/instruments/instrumentBootstrap.ts`** — `ensureInstrumentService()`
   and `initializeInstruments()`, memoised and idempotent, with a failed attempt
   clearing the memo so it can retry once the context is unlocked. It lives in
   the engine layer so the store and UI can both call it without a circular
   import.
2. **Initialised at app boot** (`providers.tsx`), giving the instrument graph
   application lifetime.
3. **`useInstruments` no longer disposes on unmount.** Teardown belongs to
   `AudioEngineAdapter.dispose()`.
4. **`loadSoundFont` awaits `ensureInstrumentService()`** first —
   `setCustomInstrument` returns `false` silently when the service is not
   initialised, which looked like a successful load that produced no sound.
5. **`applyPatch` now actually loads the instrument.** It previously only set
   `track.instrument`, which renames what a track claims to be without
   registering anything, so any non-SoundFont Library preset was inaudible.

Verified in a real browser against a live project:

| Check | Result |
|---|---|
| `assignInstrument` succeeds | ✅ |
| Adapter `triggerNote` routes to the instrument | ✅ |
| Store path (piano roll preview) routes to the instrument | ✅ |
| Instrument survives closing the Library panel | ✅ |

10 regression tests in `engine/instruments/__tests__/instrumentBootstrap.test.ts`,
including one asserting the module exposes no disposal at all.

**Note on the earlier failed verification:** a first browser run reported the
instrument path was never reached. That was a stale `next dev` process still
holding port 3000 and serving old code — the new server had silently started on
3001. `next build` and `next dev` also corrupt each other's `.next`. Both traps
are recorded in `docs/CONTINUITY.md`.

### 6.10 MIDI keyboards were never detected

A connected MIDI keyboard did not appear in Settings → MIDI → Inputs. Four
separate faults, any one of which was enough:

1. **The device scan was gated behind a sub-tab that could never be active.**
   `refreshMidiDevices()` only ran when `globalSettings.midi.activeSubTab ===
   'Inputs'`, but `globalSettings.midi` defaults to `{}` — and is persisted that
   way — so `activeSubTab` was `undefined` for every existing project. Opening
   Settings → MIDI showed sub-tab buttons above an empty body, and no scan ever
   ran. Fixed with a `midiSubTab` fallback of `'General'`, and by scanning
   whenever the dialog opens rather than on one specific tab.

2. **Failures were invisible.** Every `requestMIDIAccess` call logged to the
   console and left the list empty, so "permission denied", "browser has no Web
   MIDI" and "nothing plugged in" were indistinguishable — all three rendered
   the same *"No MIDI input devices detected"*. The Inputs panel now shows the
   actual status, colour-coded, with a **Rescan** button.

3. **Five competing `requestMIDIAccess` calls.** Providers, the preferences
   dialog, the audio adapter, the control-surface engine and the MIDI recorder
   each held their own `MIDIAccess`, their own `onstatechange` and their own
   copy of the device list. New `engine/midi/midiDeviceService.ts` owns a single
   access object, tracks status (`idle` / `requesting` / `granted` / `denied` /
   `unsupported` / `error`), and publishes device changes to subscribers. It
   requests `{ sysex: false }` deliberately — sysex triggers a stricter prompt
   and nothing here needs it.

4. **Hot-plugged keyboards produced no sound even once listed.**
   `AudioEngineAdapter.setupMidiInput()` bound `onmidimessage` once at
   construction, so a device connected after page load had no handler. It now
   re-binds whenever the device list changes.

14 tests in `engine/midi/__tests__/midiDeviceService.test.ts` cover permission
denial, unsupported browsers, hot-plug, subscriber notification, and the
"no re-prompt once granted" guarantee.

**If a keyboard still does not appear:** Web MIDI requires a secure context
(localhost counts) and Chrome or Edge — Safari and stock Firefox have no Web MIDI
at all, which the panel now states explicitly rather than showing an empty list.

### 6.11 A connected MIDI keyboard made no sound — there was no note path

Once devices were detected (§6.10), playing keys still produced silence.

**There was no MIDI-note-to-instrument path anywhere in the codebase.**
`AudioEngineAdapter` delivered messages to its listeners, but the only listener
was `GlobalKeyHandler`, which matches messages against control-surface *command*
assignments (play, stop, cycle…). Every note a keyboard sends matched no
assignment and was discarded. Nothing ever called `triggerNote` from MIDI input.

New `engine/midi/midiInputRouter.ts` (pure, 21 tests) decodes messages and
routes notes:

- **Note On with velocity 0 is treated as Note Off.** Most keyboards send this
  instead of a real Note Off; reading `0x90` as unconditionally "on" would leave
  every note sounding forever.
- **Note Off releases on the track the note started on**, not the currently
  armed one — otherwise changing tracks mid-hold strands a voice.
- **Re-pressing a held note restarts it** rather than stacking voices.
- Messages from a device unticked in Settings are ignored; a device the user has
  never seen is allowed rather than silently dropped.

`engine/midi/liveMidiInput.ts` wires it to project state at boot, resolving the
target track as: record-armed → focused → first instrument track.

### 6.12 Feature: live MIDI notes highlight in the piano roll

`PianoKeyboard` gained an `activeKeys` prop, rendered in a distinct colour that
takes precedence over the existing scale-highlight overlay so the two never read
alike. The piano roll subscribes via `subscribeToActiveNotes()`.

That subscription is module-level rather than on the router instance
deliberately: the router only exists after boot, so a component that mounts
first would otherwise subscribe to nothing and never retry.

### 6.13 Plugin host — plugins now process audio

Groundwork for a plugin ecosystem (Web Audio Modules). Before this, **no plugin
in the DAW processed any audio**:

- `routingEngine.createEffectNode()` built a pass-through `GainNode` and never
  read `effect.type`.
- `updateTrackPlugins()` only recomputed PDC latency — it created no nodes.
- `AudioEngineAdapter.updatePluginParams()` was a bare `console.log`.
- `store.updatePluginParams` never wrote to the store either, so
  `PluginSetting.params` was permanently `{}` — knob moves were dropped on
  **both** ends.

**New `engine/audioEngine/insertChain.ts`** owns the segment between a track's
input and its fader:

- Diffs by **instance id**, so reordering reuses existing nodes rather than
  rebuilding — preserving each plugin's DSP state (filter memory, reverb tails)
  and avoiding a load spike per drag.
- Bypassed plugins stay instantiated but leave the signal path, so their latency
  correctly drops to zero for compensation.
- Relinks behind a short gain fade. Web Audio has no atomic relink; without the
  fade, reordering during playback clicks.
- Rebuilds are serialised through a promise queue so rapid edits can't interleave.
- Typed against `BaseAudioContext`, not `AudioContext`, so the same class will
  build chains inside an `OfflineAudioContext` for bounce/export.

**New `engine/plugins/processorFactory.ts`** adapts the effects in
`engine/effects/plugins/` — ~2,800 lines of working compressor/EQ/reverb/delay/
limiter DSP that had **zero importers**. They already shared an
`input`/`output`/`setBypass`/`getState`/`dispose` contract, so each wrapper is thin.

**New `engine/plugins/pluginIds.ts`** resolves the id-namespace split that made
manifest lookups always miss: the store wrote `'comp'`/`'eq'`, manifests were
keyed `'magic_wasm_comp'`/`'magic_wasm_eq'`. Both now resolve to one canonical
id, with no data migration — saved projects keep their original spelling.

`PluginSetting` gained optional `format` / `insertPoint` / `latencySamples` /
`state` / `wam` fields. All optional, so existing `stateJson` blobs load
unchanged, and they round-trip for free.

Latency is reported **synchronously** from the declaration, then refined once the
chain resolves — but only if every spec was realised, since trusting a partial
chain would under-compensate the track.

**Two pre-existing crashes surfaced and fixed** in `createHistorySnapshot`:
`state.environment.layers` and `channelStripCopyBuffer.plugins` were mapped
unguarded. `GET /api/project/[id]` returns `environment: {}` — truthy but empty —
so **undo crashed** for any project without an environment.

Verified in a real browser: adding a Channel EQ builds an actual `EQPlugin`
(state reports `lowShelf`/`midPeak`/`highShelf`/`bypass`), parameters persist in
the store, and reorder/remove both work. 18 new chain tests; 444 → 462 total.

Next: the WAM backend slots into `processorFactory` behind the same
`InsertProcessor` interface — the chain doesn't change.

### 6.14 Web Audio Modules — third-party plugins load and run

Native VST cannot run in a browser. **Web Audio Modules 2.0** is the open
browser-native equivalent ("VSTs for the Web"), AudioWorklet-based so it works in
real time. It plugs into the `InsertProcessor` interface from §6.13 — the insert
chain did not change at all.

**Added:**
- `engine/plugins/wam/wamHost.ts` — installs `WamEnv`/`WamGroup` via the SDK's
  `initializeWamHost`. Memoised **per AudioContext**: `reactStrictMode` mounts
  effects twice and a second init throws, while offline render genuinely needs
  its own environment. One rule covers both.
- `engine/plugins/wam/wamLoader.ts` — loads a plugin module and validates
  `isWebAudioModuleConstructor`. Uses `new Function('url','return import(url)')`
  because **webpack rewrites `import(variable)` into a build-time context module**
  that cannot resolve a runtime URL.
- `engine/plugins/wam/wamProcessor.ts` — adapts a `WamNode` to `InsertProcessor`.
  `input` and `output` are the same node, so the chain needs no special case.
  `getCompensationDelay()` feeds the existing PDC unchanged.
- `app/api/wam/[...path]/route.ts` — the proxy. `COEP: require-corp` blocks
  cross-origin plugin code, and plugins are **directories with relative imports**,
  so the path is *mirrored* rather than passed as a query parameter — otherwise
  `index.js` importing `./gui.js` resolves to nothing.
- `app/api/wam-registry/route.ts` — catalogue, rewriting every path to a proxied
  URL so the client never chooses an upstream host.
- `components/plugins/PluginBrowser.tsx` and `WamGuiMount.tsx` — catalogue UI and
  a host for the plugin's own DOM GUI, with create/destroy balanced against
  StrictMode double-mounting.

**Two things that cost real debugging time**, both recorded here so nobody
repeats them:
1. The catalogue lives at `/community/plugins.json` but its assets are served
   from `/community/**plugins**/<path>`. Resolving asset paths against the
   index's own directory 404s on every plugin.
2. `WamInsertProcessor.getState()` returns `undefined` until its async capture
   lands, so it is **not** a valid "did this load?" probe. Ask the chain via
   `routingEngine.getInsertProcessor()` instead.

**Security.** Proxied plugin code is served from our origin and therefore runs
with full page privilege — it can read cookies and call authenticated routes.
WAM 2.0 has no sandbox for this. `engine/plugins/wam/allowlist.ts` enforces an
HTTPS host allowlist and rejects traversal, credential smuggling and lookalike
hosts (17 adversarial tests). The proxy also requires a session, caps response
size, sets explicit `Content-Type` (a mislabelled script served same-origin is
an execution risk) and adds `nosniff`. **If this is ever exposed to untrusted
plugins, serve the proxy from a separate origin.**

Verified in a real browser: the catalogue returns 58 plugins (5 instruments),
the proxy serves a 157 KB module with the right MIME and CORP headers, and
**Simple Distortion instantiates and inserts into the track's audio chain**.

479 tests pass; build clean.

### 6.15 Plugins now apply to exports, and WAM instruments play

**Offline render.** `OfflineRenderer` built only `input → gain → pan → master`,
so a bounce dropped every plugin — an export silently differed from playback,
which is worse than having no plugins at all.

It now builds a real `InsertChain` per track on the `OfflineAudioContext`. This
is why `InsertChain` was typed against `BaseAudioContext` in §6.13: the same
class, and the same `processorFactory`, are reused verbatim.

Delay compensation had to be inverted for offline use. Live playback pads every
track up to the worst-case latency; applying that unchanged would shift the
whole export late by that amount. So the same `computeCompensation()` is applied
for **relative** alignment between tracks, and `projectLatencySamples()` is then
trimmed off the head of the rendered buffer — giving identical inter-track
alignment with no absolute offset.

Failure policy is explicit: a plugin that cannot be instantiated offline leaves
its track **dry**, and `onPluginFailure` surfaces it as a toast naming the
tracks. Silently shipping a different mix is not acceptable.

Freeze (`trackRender.ts`) now bakes inserts in — freeing their CPU is the point
of freezing — while fader, pan, mute and solo stay live so a frozen track is
still mixable.

**WAM instruments.** A WAM with `isInstrument: true` reports
`hasAudioInput: false`, so it cannot join an insert chain. New
`engine/plugins/wam/wamInstrumentHost.ts` connects it to the track's **input**,
the same target `triggerNote`, `scheduleNote` and `instrumentService` already
use — which places it ahead of the inserts automatically.

Both MIDI sources needed **zero changes**, as expected:
- `midiInputRouter` already funnels live keys through `triggerNote`/`releaseNote`.
- `midiSequencer` already emits absolute AudioContext times through
  `MidiSink.scheduleNote`, which is exactly what `scheduleEvents` wants — so
  sequenced notes stay sample-accurate rather than being fired by a timer.

A priority-0 WAM branch was added to each, mirroring the existing
`instrumentService` check. `allNotesOff()` sends CC123 and CC120 to every WAM
instrument so nothing is left ringing after a stop.

`engineRebuilder` reloads a track's WAM instrument on project open — it is
fetched from a URL rather than reconstructed from state, so it must be
re-requested.

Verified in a browser: **Synth-101 loads onto a track, is stored for reload, and
plays a note**; Simple Distortion still instantiates into the insert chain.

479 tests · typecheck, lint and build clean.

### 6.16 Instrument selection has a home

There was **no instrument slot anywhere in the UI**. A track's instrument could
only be changed from the Library panel, or — after §6.14 — from the Audio FX
menu, which is the wrong place: instruments are not effects, and nothing showed
what a track was currently playing.

The Inspector now has an **Instrument** field for MIDI, software-instrument and
drummer tracks, showing the current instrument (or "None") and opening the
catalogue filtered to instruments.

The plugin browser gained a `mode` (`all` / `instrument` / `effect`) so the two
actions stay separate: the Inspector slot offers instruments (which *replace*
what the track plays), the mixer's Audio FX menu offers effects (which *add* to
the insert chain). Each retitles itself accordingly.

Verified in a browser: the slot renders as `Instrument: None`, clicking it opens
in instrument mode listing all 5 instruments and **excluding every effect**.

### 6.17 SoundFonts on disk are now usable — General MIDI support

You need piano, brass, bass and strings. That is a **content** problem: the
SoundFont engine already worked, but nothing on disk could reach it.

Two blockers, both fixed:

1. **`/api/soundfonts` only read the database.** Rows are created solely by the
   admin Supabase upload flow, so the 10 `.sf2` files sitting in
   `public/soundfonts/` — two grand pianos, a guitar pack, drum kits, violin,
   organ — were served statically by Next and yet invisible in the app.
2. **`/api/soundfonts/[id]/presets` could only download from Supabase.** Even a
   registered local font could not have its instruments enumerated.

New `lib/localSoundfonts.ts` discovers fonts in `public/soundfonts/` directly —
no upload, no database row, no seed step. Ids are prefixed `local:` so they can
never collide with a database cuid, and are validated against traversal because
they become filesystem paths (12 tests, mostly adversarial).

The listing merges both sources and categorises by filename (Piano & Keys,
Drums & Percussion, Strings, Brass & Winds, Organ…), sorting any **General MIDI**
bank to the top. The preset route reads local *or* uploaded fonts and memoises
the parse — a GM bank is tens of megabytes and its preset list never changes.

**General MIDI is the answer to the original question.** One GM bank contains all
128 programs — pianos, brass, strings, basses, organs, guitars, woodwinds,
percussion — and since the app enumerates every preset in a font, one file
becomes a complete instrument list. `npm run soundfont:gm` downloads one
(`npm run soundfont:list` shows the options); it is not committed because
`.gitignore` excludes `*.sf2` and a 30 MB binary does not belong in git history.

Verified live: the library now lists **18 fonts** correctly categorised, and
presets parse from local files — "Various synths" → 34 presets in 30 ms,
"Jeux14" → 204 presets in 478 ms, with real instrument names.

**Note on bank choice:** MuseScore_General is deliberately excluded. Its `.sf2`
is 215 MB, far too heavy for a browser, and its `.sf3` stores samples as Ogg
Vorbis, which `SoundFontParser` does not decode. GeneralUser GS (~30 MB) is the
default; FluidR3 (~148 MB) is the higher-quality option.

**GeneralUser GS is installed** (30.8 MB) and verified: **287 presets** parse in
~1.6 s, covering everything the DAW was missing —

| | |
|---|---|
| Piano | Grand Piano, Bright Grand, Electric Grand |
| Brass | Trumpet, Trombone, Tuba |
| Bass | Acoustic Bass, Finger Bass, Pick Bass |
| Strings | Violin, Viola, Cello |
| Organ | Tonewheel, Percussive, Rock |
| Guitar | Nylon, Steel, Jazz |

A truncated font (interrupted download) lists but fails its preset parse with a
clear 422 rather than corrupting anything — worth knowing, since the first
attempt here did time out mid-transfer.

**Deployment note:** `.gitignore:102` excludes `public/soundfonts/`, so the bank
is local-only and will not reach a deployment. Either commit this one file as an
exception, run `npm run soundfont:gm` as a build step, or serve it from a CDN.

### 6.18 Known WAM limitations

- **Plugin state is not captured on save.** `PluginSetting.state` round-trips if
  present, and `getState()` refreshes a cache in the background, but nothing
  calls `captureState()` at save time — so a plugin's internal state (beyond its
  numeric parameters) is not yet persisted. Wire it into the save path.
- **WAM parameters aren't automatable.** They are set directly rather than
  through `AutomationLane`, and `wam-automation` events from a plugin's own GUI
  are not yet pushed back into the store.
- **Offline WAM fidelity is unverified.** Rendering is faster than real time; a
  plugin whose DSP leans on wall-clock time will render incorrectly. The
  dry-and-warn path exists for this, but no community plugin has been checked
  bar-for-bar against playback.
- **No plugin-to-plugin MIDI** (`connectEvents`), no sidechain input, and
  inserts are pre-fader only.

### 6.16 Still needed before this is a comfortable songwriting tool

Not blockers for hearing a song, but the next things a user will hit:

- **Loop/cycle playback for MIDI.** Audio loops via the scheduler; MIDI needs the
  cycle wrap to re-arm notes.
- **Tempo curves still do not affect scheduled audio** (`ASSESSMENT.md` §7.7).
- **`engine/pianoRoll/projectSync.ts` places notes at clip-relative positions on
  a grid drawn in absolute timeline beats.** For a region starting at bar 1 the
  two agree; for a region starting later they do not, so its notes will appear
  shifted. Not addressed here — flagged while tracing the playhead.
- **Hydration warnings** on the workspace in dev — pre-existing, non-blocking,
  but they clutter the console and should be traced.

## 7. SoundFont / General MIDI: the SF2 parser was mis-reading the file format

**Reported symptom:** "the GeneralUser GS presets are not loading properly in
the piano roll."

They loaded. They just played the wrong samples, many at once. Four independent
bugs in `SoundFontParser` compounded into that, and three more in the playback
path made what survived sound wrong.

### 7.1 Every last zone swallowed the rest of the file

`parseZones` bounds a zone's generator list with the *next* bag record's index.
For the final zone of each preset and each instrument it instead used the end of
the whole `pgen`/`igen` chunk:

```ts
const nextGenIndex = i < zoneCount - 1
    ? this.readWord(zoneStartOffset + (i + 1) * 4)
    : genSize / 4;                                  // ← end of the entire chunk
```

So the last zone of "Low" absorbed every generator belonging to "High" and every
instrument after it — hundreds of them, from unrelated samples. The bag chunks
always carry one terminal record past the last zone, so the next record always
exists; `parseZones` now takes the bag chunk start and total record count and
reads it.

### 7.2 A real generator was being treated as a terminator

```ts
if (genOper === 0) break;
```

`genOper` 0 is `startAddrsOffset`, and generators are stored in ascending opcode
order, so it is always *first* when present. Any zone using a start-address
offset was truncated to a single generator and then dropped for having no
`sampleID`. Removed — with correct counts there is nothing to terminate on. This
break was also the only thing stopping §7.1's runaway read from consuming the
entire chunk.

### 7.3 Preset ranges were overridden instead of intersected

The big one. SF2 §9.4 defines how a preset zone combines with the instrument
zones it points at, and it is not "instrument wins":

| Generator | Correct rule | What the code did |
|---|---|---|
| `keyRange`, `velRange` | **intersect**; empty intersection drops the zone | instrument value replaced the preset's |
| everything else | preset value is an **offset added** to the instrument's | instrument value replaced the preset's |
| sample addressing, `sampleModes`, `exclusiveClass`, `overridingRootKey`, `keynum`, `velocity` | ignored at preset level | added into the merge |
| first zone with no `instrument`/`sampleID` gen | **global zone** — defaults for its siblings | emitted as a zone, then dropped |

Discarding the preset's range filter means every instrument zone answers every
key. A preset that layers "low half → instrument A, high half → instrument B"
had both halves respond to all 128 notes.

### 7.4 Signed generator amounts read as unsigned

`readWord` is unsigned, but almost every generator amount is a signed 16-bit
value. Every negative pan, tuning offset and envelope time came through as
roughly 65535 — e.g. `fineTune −35` became `65501`. Only `instrument`,
`sampleID`, `keyRange` and `velRange` are genuinely unsigned; the rest now read
signed.

### 7.5 The terminal `inst` record was parsed as an instrument

`phdr` correctly dropped its terminal "EOP" record (`/38 - 1`); `inst` did not
(`/22`), so the bank reported 325 instruments where it has 324.

### 7.6 Playback-path bugs found while tracing this

In `SamplePlayer`:

- **Every sample started at its loop point.** `sampleOffset` was computed as
  `loopStart − header.start`, so playback skipped straight past the attack —
  no hammer on a piano, no pluck on a guitar. Now starts at the top of the slice.
- **Loop modes were inverted.** The test was `sampleModes > 1`, which loops mode
  2 (unlooped) and leaves mode 1 (loop continuously — the common one) dry. Now
  `=== 1 || === 3`, and the default is the spec's 0 rather than 1.
- **Start/end address offsets were computed and discarded.** `loadPreset`
  calculated `sampleStart`/`sampleEnd` but only stored the loop points, so the
  slice always ran header-start to header-end.
- **Hard-right pan folded back to centre.** `panValue >= 500 ? (panValue-500)/500 : panValue/500`
  maps +500 (hard right) to 0. SF2 pan is a signed −500…+500; now a clamped divide.
- **`scaleTuning` was resolved and never used**, so drum kits mapped with
  `scaleTuning 0` were pitched by key like a melodic instrument.
- **`fineTune` replaced the sample header's `pitchCorrection`** instead of adding
  to it.
- **Velocity fallback stacked a whole velocity split.** When no layer matched, it
  played *every* zone tied at the minimum distance. Now ties break to the lowest
  velocity floor — one layer, not eight.
- Sample slicing used `new Float32Array(pool.buffer, start*4, len)`, which
  ignores a non-zero `byteOffset` on the pool. Now `subarray`, and the buffer
  cache key includes the slice bounds.

### 7.7 Preset switching re-downloaded the whole bank

`SoundFontLoader.loadFromPath` does an unconditional `fetch`, and the load path
built a fresh `SoundFontInstrument` per selection — so every preset click
re-fetched and re-parsed 30.8 MB.

- New `engine/instruments/soundfont/fontCache.ts` — parsed-font cache (memory +
  IndexedDB) with in-flight de-duplication. Failures are not cached.
- New `engine/instruments/soundfont/loadSoundFontForTrack.ts` — module-level, so
  it does not depend on a mounted component and can be exercised from tests.
  Selecting another preset from a bank the track already holds is now a zone
  reload only: no network, no parse.
- `hooks/useInstruments.ts` reduces to a thin wrapper over it.

### 7.8 Measured effect

| | before | after |
|---|---|---|
| presets silent for every note | 1 | **0** |
| presets firing >4 voices for one key | 184 / 287 | **1** (Full Orchestra, genuinely layered) |
| worst single key | 32 voices | **5** |
| presets with no zone covering middle C | 35 | **0** |
| preset zones parsed (bank total) | 20,755 | 12,618 |
| "Grand Piano" zones | 1,057 | 200 |
| instruments | 325 | 324 |

The voices-per-key distribution is now what a correct SF2 renderer produces:
117 presets mono, 124 stereo pairs, the rest deliberately layered.

### 7.9 Tests

- `engine/instruments/soundfont/__tests__/soundFontParser.test.ts` — 11 tests
  built from synthetic SF2 bytes (no 30 MB asset needed), pinning each rule
  above: bag bounding, range intersection, global zones, additive preset
  generators, ignored preset-level generators, signed amounts, `genOper 0`,
  terminal-record exclusion.
- `tests/smoke/gmRuntimeAudit.test.ts` — drives all 287 presets through the real
  `SoundFontInstrument` with a mock AudioContext and asserts each one selects,
  sounds, produces a non-degenerate buffer and a sane playback rate, with ≤8
  voices per key. Self-skips when the font is absent.
- `tests/smoke/gmPresetAudit.test.ts`, `tests/smoke/gmVoiceAudit.test.ts` —
  diagnostic reports (zone-level and voice-level) kept for the next bank.

**Verification:** `tsc --noEmit` → 0 errors · `jest` → 505 passed / 42 suites ·
`next build` → success.

---

## 7b. Notes never stopped

**Reported after the parser fix:** "the presets are now sounding good but the
notes are sustaining."

### 7b.1 `Voice.start` erased the note it had just been given

`SamplePlayer` assigns the voice's identity and *then* starts it:

```ts
voice.note = note;
voice.velocity = velocity;
voice.start({ ... }, time);
```

`start()` opened with `this.cleanup()`, and `cleanup()` ended with
`this.note = -1; this.velocity = 0;`. So every live voice reported note −1.
`findVoicesForNote` matched nothing, `releaseNote` released nothing, and **every
note rang until its buffer ran out — or forever, if the zone looped.**

The same wipe zeroed `velocity` before `start` derived its peak gain from it, so
`baseGain` was always 0; the old envelope only escaped silence because it ramped
attack to a hard-coded `1` instead of to the note's own peak.

Split into `teardown()` (drops audio nodes only, used by `start`) and `stop()`
(teardown plus identity reset).

### 7b.2 Absolute times treated as relative delays

`AudioEngineAdapter.scheduleNote` passes absolute AudioContext times — its own
doc comment says so — straight into `noteOn`/`noteOff`. `Voice` added them to
`currentTime`:

```ts
const absNoteOn = now + noteOnDelay;      // now + 1234 s
```

A note-off at absolute time 1234 was scheduled 1234 seconds *after now*. `Voice`
now takes absolute times throughout (0 = "now"), matching every caller.

### 7b.3 A release was pre-scheduled at note-on

`start()` called `scheduleADSR` with `noteOffTime` set to the sample buffer's
duration, so the envelope began releasing after one buffer length whether or not
the key was still down — a looped organ or pad could not sustain at all. Note-on
now schedules attack → hold → decay → sustain and nothing more; the release is
scheduled only when something releases the voice.

### 7b.4 `sustainVolEnv` was read inverted

SF2 generator 37 is **attenuation in centibels below peak**: 0 = full level,
1000 = −100 dB. The code read it as a 0…1 fraction (`value / 1000`), so
full-sustain zones came out silent and heavily-attenuated ones came out held
wide open. Now `10^(−cB/200)`.

Also in the same conversion: `timecentsToSeconds` special-cased `0` to mean
zero seconds. 0 timecents is **one second**; the "instant" value is the −12000
default. And `holdVolEnv` was ignored entirely — now part of the envelope.

### 7b.5 Release started from a stale gain value

The release read `outputNode.gain.value`, which reports the level *now* — wrong
whenever a release is scheduled ahead of time. Since attack/hold/decay is
deterministic, `envelopeLevelAt()` computes the exact level at the release
instant instead. `scheduleAttack` uses a linear decay ramp so the two agree.

### 7b.6 Exclusive-class choking never fired

SF2 `exclusiveClass` is how a closed hi-hat silences an open one. The lookup was
`findVoicesForNote(note)` — only voices on the *same* note, which by definition
excludes the voice it needs to cut. Now scans all voices in the class, and cuts
them with a new `Voice.choke()` that ramps over 8 ms rather than stopping dead
(a hard stop clicks on every hat).

### 7b.7 Voice pool and transport stop

- `acquireVoice` only reused `Idle` voices, never `Done` ones, so the pool
  filled with spent voices and new notes stole sounding ones.
- `stealOldestVoice` only considered `Playing` voices; it now prefers one
  already fading out, so exhaustion cuts a tail rather than a held note.
- `releaseAll` released voices whose note-on had not happened yet. Because a
  release clamps to the note's own start, a stopped transport still blipped out
  everything it had queued. Those are now cancelled outright.

### 7b.8 Tests

`engine/instruments/soundfont/__tests__/voiceLifecycle.test.ts` — 17 tests over
`Voice`, `VoiceAllocator` and the envelope conversion: identity survives
`start`, start/stop times are absolute, a looping voice actually stops, peak
scales with velocity, no release is pre-scheduled, a second note-off is ignored,
finished voices are recycled, releasing voices are stolen first, queued voices
are cancelled on stop, sustain reads as centibels, 0 timecents is one second,
and the analytic envelope matches at each stage.

**Verification:** `tsc --noEmit` → 0 errors · `jest` → 522 passed / 43 suites ·
`next build` → success · all 287 presets re-audited through the rewritten voice
path (0 silent, max 5 voices per key).

---

## 7c. Volume envelopes were linear in amplitude, not in decibels

**Reported after the note-off fix:** "there is too much reverb in all the
GeneralUser GS instruments."

Nothing in the signal path adds reverb — the SoundFont voices run straight into
the track's input gain. The wash was the decay and release stages, ramped as
straight amplitude lines.

**SF2 volume envelopes are linear in decibels over a 100 dB span**
(SF2 2.04 §8.1.2; FluidSynth uses the same model at 960 cB). `decayVolEnv` is
the time to fall 100 dB, not the time to reach zero on a straight line.

GeneralUser gives its Grand Piano a **18.6 s decay to a −100 dB sustain**. That
is an ordinary piano tail in dB: −5 dB after a second, −16 dB after three,
inaudible by eleven. Ramped linearly in amplitude, the same envelope sits at
**95% a second in and half volume after nine** — every note bleeding into the
next few bars. Across the bank the median zone has a 7 s decay, so this affected
essentially every instrument, which is why it read as a global reverb rather
than a broken preset.

Rewrote the envelope around the dB model:

| | before | after |
|---|---|---|
| decay | linear amplitude ramp to sustain over the full nominal time | `exponentialRamp`, 100 dB per `decayVolEnv` second, stopping when it reaches sustain |
| decay duration | always the nominal time | `decay × (sustainAttenuationDb / 100)` — a −6 dB sustain is reached in 6% of it |
| release | linear ramp to 0 over the nominal time | dB-linear from wherever the envelope had actually got to, so a part-decayed note finishes proportionally sooner |
| attack | linear | linear (unchanged — only decay and release are dB-linear) |

`envelopeLevelAt` and the new `releaseLevelAfter` mirror the scheduled curves
exactly, so a release or a choke scheduled mid-decay starts from the right
level.

### Measured effect — audible tail after note-off (−60 dB), middle C held 1 s

| preset | level still held @1 s | tail |
|---|---|---|
| Grand Piano | 0.54 | 0.64 s |
| Tonewheel Organ | 1.00 | 0.10 s |
| Trumpet | 1.00 | 0.15 s |
| Violin | 1.00 | 0.28 s |
| Nylon Guitar | 0.54 | 0.40 s |
| Acoustic Bass | 0.21 | 0.52 s |
| Flute | 1.00 | 0.16 s |
| Warm Pad | 1.00 | 2.72 s |

Sustaining instruments hold full level while the key is down and stop within a
few hundred milliseconds; plucked and struck ones decay naturally; a pad keeps
its tail. Only 61 of 287 presets now ring longer than 3 s, and they are the ones
that should — Marimba, Tubular Bells, Timpani, Sweep Pad, Atmosphere, Taiko.

**Verification:** `tsc --noEmit` → 0 errors · `jest` → 525 passed / 43 suites ·
`next build` → success · all 287 presets re-audited (0 silent, max 5 voices per
key).

---

## 7d. The instrument did not survive a reload

**Reported:** "it worked but when I refreshed the website it's not working."

`Track` recorded only `instrument?: string` — the preset's **display name**.
Nothing stored which bank the preset came from or its index, so there was
nothing to rebuild from. After a refresh the track still read "Grand Piano"
while the engine had no SoundFont attached, and playback fell through to the
built-in synth. The UI looked correct, which is why it read as "not working"
rather than as a missing instrument.

Worse, `rebuildEngine`'s step 4 ran `loadInstrument(track.id, track.instrument)`
for every track carrying an instrument name — so "Grand Piano" was looked up in
the *built-in* registry and whatever it matched was attached instead.

`wamInstrument` already had exactly this treatment (persisted reference,
re-fetched by the rebuilder); SoundFonts simply never got it.

- `models/Track.ts` — new optional
  `soundFont?: { id?, url, presetIndex, presetName? }`. Optional, so existing
  `stateJson` blobs load unchanged. `serializeStoreState` passes `tracks`
  through wholesale, so no serializer change was needed.
- `hooks/useInstruments.ts` — writes it on a successful load, clears it (and the
  cached font binding) on remove.
- `engine/persistence/engineRebuilder.ts` — restores it beside the WAM branch,
  and step 4 now skips any track owning a SoundFont or WAM instrument.
- `engine/instruments/instrumentBootstrap.ts` — same skip, so the boot-time pass
  cannot race the rebuild and attach a built-in on top.

The 30 MB bank is not re-downloaded on reload: `fontCache` serves it from
IndexedDB.

### Tests

`engine/persistence/__tests__/engineRebuilder.test.ts` — 6 tests: the preset is
reloaded from the persisted bank and index; no built-in is attached over a
SoundFont or WAM track; ordinary tracks still load built-ins; a missing bank
does not fail the rebuild; and `soundFont` survives a serialize/deserialize
round trip.

**Verification:** `tsc --noEmit` → 0 errors · `jest` → 531 passed / 44 suites ·
`next build` → success.

> **Not verified:** proven through the real engine code with a mock
> AudioContext, not by listening in a browser — this session had no browser
> driver. Worth an ear check on a sustained pad, a piano and a hi-hat pattern,
> and a reload to confirm the instrument comes back.

## 7e. Workflow audit: making a beat, end to end

Driven as an audit of the whole "write a simple track" workflow — setup, drums,
chords, bass, melody, arrangement, editing, mixing, mastering, export — with a
test that exercises each step through the real store and engine.

New: `tests/integration/beatWorkflow.test.ts` (30 tests). Only the audio output
layer is mocked; all sequencing, arrangement and mix logic is the real code.

First run: **14 of 25 passing.** Six of the failures were real gaps.

### 7e.1 Key and time signature could not be changed

`timeSignature` and `keySignature` are top-level state, read by the piano roll,
the ruler and the metronome — but `updateProjectSettings` only ever merged into
`settings`, and no setter existed. They could be set once, at project creation,
and never again.

Added `setTimeSignature` and `setKeySignature`. The former validates the
`n/d` form and ignores malformed input rather than letting it reach
`timeSignature.split('/')` downstream, and re-syncs the metronome so the accent
lands on the new bar 1.

### 7e.2 MIDI regions could not be split

```ts
if (!clip || clip.type !== 'audio') return;
```

`splitClipAtTime` bailed on anything that was not audio — so the region you
actually cut when arranging a programmed part could not be cut at all. It now
splits MIDI too, partitioning notes by start, rebasing the second half onto its
new region start, and shortening a note that straddles the cut instead of
duplicating it into both halves.

### 7e.3 No way to quantize a region

The piano roll could quantize a *selection* (`midiStore.quantizeSelected`), but
tightening a whole recorded or programmed part from the arrangement had no entry
point. Added `quantizeClipNotes(clipId, division, strength, swing)`, snapping in
timeline beats — not clip-relative ones — so a region that does not itself start
on the grid still lands its notes on it. Grid sizes come from the existing
`engine/midi/quantization` so there is one definition.

### 7e.4 Sends existed everywhere except where you could make one

`Track.sends` was in the model, `routingEngine` built a gain node per send, and
`loadChannelStripSetting` could restore them — but **no action created one**, so
the reverb/delay send a mix is built on was unreachable.

Worse, the two halves disagreed on the field name: the model declares
`{ busId, level }` and the routing engine read `send.amount`. Every send's gain
came out `undefined`. `TrackSend` now documents `level` as canonical, keeps
`amount` as a legacy alias, and a `sendLevel()` helper clamps whichever arrives.

Added `setTrackSend` / `removeTrackSend`.

### 7e.5 No master insert chain

`addPlugin` only ever wrote to a track, so the mastering step — light bus
compression and limiting across the mix — had nowhere to live.

The engine already had `masterGain → outputNode`, which is exactly the head and
tail an `InsertChain` needs, so the chain drops straight in between them:
mastering plugins sit after every track and before the master fader.

- `routingEngine.updateMasterPlugins` / `getMasterProcessor`
- `audioEngine.updateMasterFXChain`
- store: `masterPlugins` state plus `addMasterPlugin`, `removeMasterPlugin`,
  `toggleMasterPlugin`, `updateMasterPluginParams`
- persisted in `projectPersistence` and rebuilt by `engineRebuilder`, so a
  mastered project does not reopen with the bus compression gone

### 7e.6 Export produced nothing

```ts
exportAsAudioFiles: (settings) => {
    console.log('Exporting with settings:', settings);
    set({ showExportDialog: null });
},
```

The final step of writing a track was a `console.log` that closed the dialog.

The export dialog *did* render, through `bounceEngine` — but it hardcoded
`effects: []` and `sends: []`, so **no plugin ever reached the file**, and it
read `c.startBeat`, a field project clips do not have, so **every region
exported stacked at beat 0**.

New `engine/export/projectExport.ts` assembles render inputs from project state
and goes through `renderSongOffline` — the same offline path used for freeze and
bounce, which applies insert chains and PDC. Reports tracks rendered dry rather
than shipping a file that quietly differs from playback, refuses an empty range
instead of writing silence, and says so when MP3 falls back to WAV rather than
handing back a mislabelled file. `ExportDialog` now uses it.

### 7e.7 Result

All 30 workflow steps pass. Full suite 573 passed / 46 suites.

| Step | Before | After |
|---|---|---|
| 1. Setup — tempo, key, time signature, sample rate, metronome | key/time unsettable | ✅ |
| 2. Drums — program a loop, cycle it, schedule it | ✅ | ✅ |
| 3. Chords — 4-chord progression | ✅ | ✅ |
| 4. Bass — roots locked to the kick | ✅ | ✅ |
| 5. Melody / audio track, record-armed | ✅ | ✅ |
| 6. Arrange — duplicate, move, mute, mark sections | ✅ | ✅ |
| 7. Edit — quantize, split, crossfade | no quantize; MIDI unsplittable | ✅ |
| 8. Mix — levels, pan, EQ, compression, sends | no sends; send gain `undefined` | ✅ |
| 9. Master — bus compression, limiting | did not exist | ✅ |
| 10. Export — render and save | `console.log` | ✅ |

### 7e.8 Tests

- `tests/integration/beatWorkflow.test.ts` — 30, the whole workflow
- `engine/export/__tests__/projectExport.test.ts` — 12, render-input assembly:
  per-region start beats, plugin chains carried through, fades/mute/rate,
  project span, track filtering, empty-range refusal, degraded-track reporting,
  MP3 notice, filename sanitising

**Verification:** `tsc --noEmit` → 0 errors · `jest` → 573 passed / 46 suites ·
`next build` → success.

> **Not verified:** `renderSongOffline` needs an `OfflineAudioContext`, so the
> export tests mock it and assert the inputs rather than the rendered audio. The
> render path itself is unchanged and already covered. Master plugins and track
> sends have store and engine support but **no UI yet** — they are reachable
> from code, not from the mixer.

## 7f. Production-session audit: a full record, setup to delivery

Audited against a complete 9-session workflow -- a 3.5-minute, 124 BPM, A-minor
pop/electronic track -- with `tests/integration/productionSession.test.ts`
(38 tests) driving the real store and engine.

First run: **21 of 38 passing.** The failures split into two kinds, and the
second kind is the interesting one.

### 7f.1 The bus tree could not be built

`Track.outputBusId` was in the model. `engineRebuilder` restored it. The routing
engine acted on it. **Nothing in the store could set it.** So the entire Session
6 structure -- `Drums to Mix to Master`, FX return busses, parallel compression
-- was unreachable, and every track fed the master directly.

Added `routeTrackTo(trackId, busId)`, which refuses to route a track into
itself and walks the destination chain to reject anything that would close a
feedback loop.

### 7f.2 More islands: built, tested, unreachable

The assessment's "build-without-wiring" pattern again. These modules exist and
import each other, but nothing in the store, UI or adapter reaches them:

| Module | Importers outside its own island |
|---|---|
| `engine/audioEngine/sidechain.ts` | 0 |
| `engine/audioEngine/sidechainRouter.ts` | 0 |
| `engine/export/stemExporter.ts` | 0 |
| `engine/audioEngine/masteringChain.ts` | 0 |

Rather than wire modules whose contracts had never been exercised, the
capabilities were rebuilt on the paths that are already proven -- the shared
offline renderer, the existing per-track analyser, the `InsertChain`.

### 7f.3 What was missing, by session

| Session | Gap | Fix |
|---|---|---|
| 1 | No bit-depth setting | `settings.bitDepth` |
| 1 | Reference track could not bypass the master chain | `setTrackMonitorMode(id, 'direct')`, routing straight to the output node |
| 1 | No RMS match for gain-matching a reference | `gainToMatchRms` |
| 1 | `addMarker` hardcoded a 4-beat length, so a section marker always claimed one bar | `addMarker(time, text, duration)` |
| 2 | No per-track delay for layering width (clap behind snare) | `setTrackDelay`, on its own delay node so PDC cannot overwrite it |
| 2, 6 | Bus tree unbuildable | `routeTrackTo` (see 7f.1) |
| 4 | No way to repeat a loop across a range | `duplicateClipAcross` |
| 4 | Automation was **write-only** -- points could be recorded, never read back | `automationValueAt`, interpolating between points |
| 5 | Comping worked only on a take folder that already existed; nothing created one | `createTakeFolder(trackId, clipIds)` |
| 7 | No sidechain | `setSidechainSource` -- envelope follower on the source driving the target's fader |
| 7 | No mono-sum for a phase check | `setMonitorMode('mono')`, folding at the monitor only |
| 7 | No level readout | `getBusPeakDb`, from the analyser each track chain already had |
| 8 | No stereo widener | `magic.widener` plugin id |
| 8 | **No offline LUFS or true-peak measurement** | new `engine/metering/offlineLoudness.ts` |
| 9 | No stem export | new `engine/export/stemExport.ts` |
| 9 | No delivery metadata | `ExportMetadata` (title, artist, ISRC...) on the export result |

### 7f.4 Offline loudness

Both existing meters are realtime `AnalyserNode` wrappers that push updates to
the UI. Neither can answer what a mastering pass actually asks -- *what is this
bounced file's integrated LUFS and true peak?* -- because that needs the whole
signal at once.

New `offlineLoudness.ts` implements ITU-R BS.1770-4: K-weighting (two biquads,
re-derived for the session's sample rate), 400 ms blocks at 75% overlap, the
two-stage gate (absolute -70 LUFS, then relative -10 LU), true peak via 4x
oversampling, and compliance against a target.

One bug caught by its own tests: loudness range is a **different measurement**
from integrated loudness -- EBU Tech 3342 runs it on short-term blocks with a
-20 LU gate, not momentary blocks at -10 LU. Reusing the integrated gate
collapsed LRA to zero, because the quiet half of a dynamic programme is exactly
what that tighter gate discards.

### 7f.5 Stems

`exportStems` renders one file per bus through the shared offline renderer, so a
stem matches what the mix does. `tracksFeeding()` walks the bus tree to collect
everything feeding each bus, tolerating a cycle rather than recursing forever.
Every stem shares one start and end beat, so they drop into another session
frame-aligned with no trimming.

### 7f.6 Result

All 38 session steps pass; full suite 629 passed / 48 suites.

| Session | Status |
|---|---|
| 1 Setup -- rate, depth, tempo, key, reference, markers | PASS |
| 2 Sound selection -- layers, kick bus, tuning, width, template | PASS |
| 3 Writing -- chords, bass, drum programming | PASS |
| 4 Arrangement -- 128 bars, subtraction, automation, FX | PASS |
| 5 Vocals -- take folder, comping, doubles | PASS |
| 6 Edit and prep -- quantize, bus tree, FX returns | PASS |
| 7 Mix -- HPF, sidechain, parallel, sends, mono check, metering | PASS |
| 8 Master -- EQ/comp/widen/limit, LUFS and true peak | PASS |
| 9 Delivery -- master, instrumental, stems, metadata | PASS |

### 7f.7 Tests

- `tests/integration/productionSession.test.ts` -- 38, the whole session arc
- `engine/metering/__tests__/offlineLoudness.test.ts` -- 18: level tracking and
  scale correctness, silence gating, digital black, sub-block buffers, true peak
  >= sample peak, loudness range on steady vs dynamic programme, compliance and
  tolerance, RMS matching

**Verification:** `tsc --noEmit` -> 0 errors, `jest` -> 629 passed / 48 suites,
`next build` -> success.

> **Not verified / deliberately scoped:**
> - Sidechain ducking is an envelope follower at control rate driving the
>   target's fader, not sample-accurate sidechain DSP. Web Audio's
>   `DynamicsCompressorNode` has no sidechain input; this is how the effect is
>   normally built in a browser and is inaudible at the 30-200 ms releases it is
>   used for. It is not a substitute for a true sidechain compressor.
> - True peak uses 4x linear-interpolated oversampling, not a polyphase
>   resampler. It catches the overshoots a sample-peak reading misses, but a
>   compliance-grade meter would resample properly.
> - `renderSongOffline` needs an `OfflineAudioContext`, so the export and stem
>   tests assert render *inputs*, not rendered audio.
> - **None of this has UI.** Sends, master inserts, bus routing, sidechain,
>   monitor modes, stems and loudness analysis are all reachable from code and
>   covered by tests, but the mixer has no controls for them yet. That is the
>   next piece of work, and it is larger than what is described here.
> - Metadata is carried through the export result but not yet written into the
>   WAV file's chunks.
> - Vocal tuning, transient alignment, de-breathing and click removal (Session
>   5's editing half) are not implemented at all.

## 7g. Closing the gaps: UI, delivery, and the vocal editing pass

Everything §7f listed as "not done" -- with one deliberate exception noted at
the end.

### 7g.1 The mixer could not reach any of it

§7e and §7f built sends, bus routing, master inserts, sidechain and monitor
modes into the store and engine. None of it had a control. Worse, the mixer's
Sends slot was a hardcoded `Bus 1` label with no handler, and the Output row
only *displayed* `outputBusId`, so both looked implemented while doing nothing.

New `components/mixer/RoutingControls.tsx`:

| Control | What it does |
|---|---|
| `SendsSlot` | Live send list with per-send level and remove; the add menu offers only busses that would not create a loop |
| `OutputRouting` | Real bus picker, replacing the read-only label |
| `SidechainPicker` | Key input for dynamics plugins, shown on compressor and gate slots |
| `MonitorControls` | Mono-sum phase check, and a chip per reference track bypassing the master chain |

The master strip's insert rack read `track?.plugins` -- always `undefined`,
since the master has no `Track` -- so it rendered empty however many plugins
the master chain held. It now reads `masterPlugins`, and its add/bypass
handlers, previously `noop`, are wired to the master actions.

### 7g.2 Delivery

- **Stems** and **metadata** are now in the export dialog: a stems checkbox that
  downloads one aligned file per bus, plus title, artist and ISRC fields.
- **Tags reach the file.** Metadata was carried on the export *result* and never
  written, so a delivered master arrived untagged. New
  `engine/export/wavMetadata.ts` inserts a RIFF `LIST`/`INFO` chunk before
  `data` and corrects the RIFF size. It refuses to touch a buffer that is not a
  valid WAV -- a bad tag should never cost someone their bounce.
- **Every bounce measures itself.** A mastering target only means something if
  the delivered file can be checked against it, so `exportProjectAudio` now
  returns the render's integrated LUFS and true peak, and the dialog reports
  them (in red when true peak is over -1 dBTP).

### 7g.3 True peak is now polyphase

The 4x oversampling was linear interpolation, which **cannot** read above the
higher of two adjacent samples -- so it reports the sample peak and calls a
clipping master compliant. Replaced with a windowed-sinc polyphase
interpolator (Blackman-Harris, 12 taps per phase).

A test pins the difference: a half-Nyquist sine landing between samples now
reads a true peak strictly above its sample peak.

Writing that test surfaced a second point worth recording: a *hard-edged* block
genuinely does overshoot when reconstructed -- that is Gibbs ringing, not a bug
-- so the "no inflation" test uses a faded signal, which is what a real bounce
looks like.

### 7g.4 The vocal editing pass

New `engine/audio/vocalEditing.ts` -- Session 5's second half, which had no
implementation at all. Pure functions over sample data, so they are testable
without an AudioContext and reusable offline.

| Function | Notes |
|---|---|
| `detectPitch` | YIN, not plain autocorrelation. Autocorrelation octave-errors on vocals because the half-period peak is often as strong as the true one; YIN's cumulative mean normalisation is what suppresses that |
| `analysePitchCurve` | Returns the measured and target pitch per frame, so the curve can be drawn and edited rather than applied as a black box |
| `applyPitchCurve` | TD-PSOLA. Formants stay put, so it still sounds like the singer -- a plain resample does not |
| `alignmentOffset` | Envelope cross-correlation. Two takes are never phase-coherent, so raw sample correlation locks onto the wrong period |
| `detectBreaths` | Level *and* zero-crossing rate: level alone cannot tell a breath from quiet singing |
| `attenuateBreaths` | Ducks with a ramp rather than gating -- a hole where a breath was sounds worse than the breath |
| `detectClicks` / `repairClicks` | Second-difference detection, linear bridge repair |

Two settings exist because tuning to 100% sounds robotic: `strength` (0.8 by
default) and `retuneSeconds`, which ramps the correction in after a note change
so a scoop or slide into a note survives.

Two bugs the tests caught:

1. **PSOLA was time-stretching, not retuning.** Read and write pointers each
   advanced at their own rate, so grains drifted apart and the take changed
   duration. Corrected to walk the *output* and read the analysis grain at the
   same absolute time, which is what keeps duration fixed while the period
   changes.
2. **`alignmentOffset` returned the measured lag, not the correction** -- the
   opposite sign from what its own contract promised, so applying it would have
   doubled the error.

Store actions `tuneVocalClip`, `alignClipTo` and `cleanVocalClip` make them
reachable; tuning takes its scale from the project key signature, so it follows
the song rather than being set twice.

### 7g.5 Tests

- `engine/audio/__tests__/vocalEditing.test.ts` -- 37: pitch detection across the
  vocal range and its resistance to octave errors, unvoiced rejection, scale
  snapping across octave boundaries, correction strength and scoop preservation,
  PSOLA moving the pitch without clipping, known-lag alignment and its
  round-trip, breath detection vs quiet singing, ducking without gating, click
  detection and repair
- `engine/export/__tests__/wavMetadata.test.ts` -- 12: tag round-trip, RIFF
  validity and size correction, audio still findable and intact, ordering,
  refusal on non-WAV input
- Two added to `offlineLoudness.test.ts` for polyphase true peak

**Verification:** `tsc --noEmit` -> 0 errors, `jest` -> 678 passed / 50 suites,
`next build` -> success.

> **Still not done, and deliberately:**
> - Sidechain remains an envelope follower driving the target's fader, not
>   sample-accurate sidechain DSP. Doing it properly needs an AudioWorklet
>   compressor with a second input -- a real piece of work, and a different
>   thing from wiring what exists.
> - The vocal DSP is monophonic by nature. Applied to a chord or a stacked
>   harmony it produces artefacts rather than a result.
> - `tuneVocalClip` and `cleanVocalClip` edit the cached buffer in place. The
>   take folder preserves the original, but there is no per-edit undo yet.
> - None of the vocal editing has UI -- it is reachable from the store, not from
>   a menu.
> - MP3 export still falls back to WAV; no encoder is bundled.

## 7h. A real sidechain compressor

The last item §7g left open. Sidechain ducking was an envelope follower reading
an `AnalyserNode` on `requestAnimationFrame` and writing the target's **fader**.
That is wrong in three ways, not just imprecise:

- It ran at frame rate (~60 Hz), so the shape of the duck was whatever the main
  thread happened to be doing.
- It had no ratio, threshold or knee. It scaled by peak and called it 3 dB.
- It fought the mixer for ownership of `mainGain`, so moving the fader during a
  duck lost one or the other.

`DynamicsCompressorNode` has one input, which is why the fake existed. The fix
is an `AudioWorkletProcessor` with **two** — input 0 the signal, input 1 the key.

### 7h.1 One implementation, not two

The repo convention is a `.js` file under `public/worklets/`. That would fork
the maths between the shipped processor and anything tested, and the two would
drift silently — a wrong compressor still makes sound.

Instead the DSP lives in `engine/audioEngine/dsp/sidechainCompressorCore.ts` as
ordinary exported functions, and `buildSidechainWorkletSource()` serialises them
with `Function.prototype.toString()` into a Blob module. Same technique
`@webaudiomodules/sdk` uses for `addFunctionModule`, already used by
`wamHost.ts`.

So the tests exercise the exact code that runs on the audio thread. A test
asserts the generated source still parses as JavaScript and carries no
TypeScript syntax, which would catch it if annotation erasure ever changed.

The processor *shell* — parameter descriptors, input wiring, port plumbing — is
a plain string, because it contains no DSP and so has nothing to drift.

### 7h.2 The compressor

Feed-forward, log-domain, which is the standard modern topology:

| Stage | Notes |
|---|---|
| Detector | Peak across the key's channels |
| Static curve | Soft knee per Reiss & McPherson; quadratic interpolation of the ratio across the knee, tested for continuity at both edges and for monotonicity |
| Smoother | Branching, **in dB**. Smoothing linear gain instead would make attack and release times level-dependent |
| Lookahead | Optional delay line on the signal but not the detector, so reduction is already in place when a transient lands. Reported as latency, so PDC compensates for it |
| Mix | Below 1 is parallel compression |

With nothing patched into input 1 it keys off its own input — an ordinary
compressor, rather than going silent or passing through untouched.

### 7h.3 Wiring

- `sidechainCompressorNode.ts` — module loading (memoised per context in a
  `WeakMap`; `addModule` throws on a second registration of the same name, and
  offline render contexts each need their own), node construction, and an
  `InsertProcessor` wrapper so it drops into an ordinary insert chain.
- `routingEngine.setSidechainSource` now patches the key track's **pre-fader**
  output into input 1, so riding the source's fader does not change how hard it
  ducks.
- `restoreSidechainKeys` re-patches after a chain rebuild. `InsertChain.setSpecs`
  disposes and recreates processors, so adding an unrelated plugin would
  otherwise silently drop the key.
- New `magic.sidechain` plugin id, in the mixer's plugin menu alongside the
  limiter and widener that were also missing from it.
- The store refuses to key a plugin that has no key input, rather than recording
  a source that could never take effect. The production-session test was doing
  exactly that against a plain compressor and passing.

### 7h.4 Tests

- `sidechainCompressorCore.test.ts` — 33: the static curve (ratio maths, knee
  continuity, monotonicity, limiter behaviour at high ratio), smoothing
  coefficients, dB conversion and its floor, then block processing — ducking
  from the key rather than the main signal, attack reaching deeper over time,
  release recovering, attack faster than release, makeup gain, mix 0 as a
  bypass, mix 0.5 as parallel, lookahead delaying an impulse by exactly the
  right number of samples, and no non-finite output under extreme settings
- `sidechainCompressorNode.test.ts` — 22: module registered once per context and
  separately per context, blob revoked on success *and* failure, a failed load
  retryable rather than cached, key patched to input **1**, previous key
  disconnected first, failed connection not remembered, parameters ramped not
  stepped, lookahead sent over the port and reported as latency, state
  round-trip, inert after dispose

**Verification:** `tsc --noEmit` -> 0 errors, `jest` -> 735 passed / 52 suites,
`next build` -> success.

> **Not verified:** the DSP is tested exhaustively as pure functions, and the
> host wiring against doubles, but no test runs it through a real
> `AudioWorkletGlobalScope` — jsdom has no AudioWorklet. The generated source is
> checked for parseability, not for behaviour in the browser. Worth an ear check
> on a kick and sub before relying on it.

## 8. Deliberately not done

Flagged rather than fixed, because each needs a product decision or carries
risk that shouldn't be absorbed silently:

| Item | Why deferred |
|---|---|
| Deleting the 7 dead Prisma models | Destructive migration; needs confirmation no deployed DB has rows |
| Deleting ~29,500 LOC of unreachable code | Several modules are near-complete features; wire-or-delete is a product call (§17.6) |
| Splitting `projectStore.ts` | Highest-traffic file; wants store tests in place first |
| Resolving the dormant Phase-3/WASM architecture | Genuine fork in the road (§17.5) |
| `npm audit` (4 critical, 13 high) | Fixes may be breaking; needs its own verified pass |
| Playhead → audio clock | Behavioural change to the transport; deserves isolated verification |
| UI for the vocal editing pass | The DSP and store actions exist and are tested (§7g); no menu reaches them |
| Per-edit undo for destructive vocal edits | The take folder holds the original, but an edit cannot be stepped back individually |
| Shipping the GM bank | `.gitignore:102` excludes `public/soundfonts/`, so GeneralUser-GS.sf2 is local-only and the deployed app has no default bank. Needs a hosting decision (LFS, object storage, or fetch-on-first-use) — see §7 |
