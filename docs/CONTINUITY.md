# Working on Magic Pro DAW Across Context Resets

This project is ~128,000 lines. **No agent or engineer will ever hold it all in
working memory.** That is not a problem to solve — it is a constraint to design
around.

This document is the design. Read it first, every session.

---

## Why this document exists

23% of this codebase — roughly 29,500 lines — is unreachable from any entry
point. It was written by capable agents who each did good work in a fresh
context, marked a task complete, and lost the context before wiring it in. The
next session started clean, saw the file existed, and moved on.

**Context loss did not degrade code quality here. It degraded integration.** Every
individual file is fine. The product is what broke.

So the rules below are not about remembering more. They are about making the
work *survive* being forgotten.

---

## The three rules

### Rule 1 — A feature is not done until something imports it

Creating `engine/audio/FlexTime.ts` is not shipping Flex Time. The definition of
done is:

1. The module is imported by a reachable component or engine path, **and**
2. A user can trigger it through the UI, **and**
3. A test exercises it, **and**
4. You verified it in the running app.

If you complete 1–3 and run out of context before 4, say so explicitly in your
final message. Do not mark it complete.

**Enforcement:** run the reachability check (below) before you claim anything is
finished. This is the single highest-value habit in this repo.

### Rule 2 — Leave the repo verifiable, not just compiling

`tsc` passing proves almost nothing here — all 29,500 dead lines typecheck
perfectly. Before ending a session:

```bash
npm run verify      # typecheck + lint + test
npm run build       # catches route/SSR problems tests miss
```

Both must pass. If you leave them failing, say so in your final message with the
exact error — a future session that discovers a broken build with no explanation
will waste its first hour re-deriving what you already knew.

### Rule 3 — Write findings down at the moment you find them

If you discover something non-obvious — a bug, a wrong assumption in the docs, a
module that isn't wired — record it in `ASSESSMENT.md` **before** continuing.
A finding held only in context is a finding that will be lost, and then
rediscovered at full cost.

---

## Session start: the 10-minute onboarding

Do this in order. It is cheaper than exploring.

```bash
# 1. Ground truth — never trust the docs on these
npm run verify
git log --oneline -15
git status
```

```
# 2. Read, in this order (~15 min of reading, and it is worth it)
ASSESSMENT.md            ← the statement of record. Start here, always.
CHANGELOG-HANDOVER.md    ← what the last ownership pass changed and why
docs/CONTINUITY.md       ← this file
```

```bash
# 3. Only then, explore the specific area you were asked about
```

**Do not read** `PROJECT_REPORT.md`, `PROJECT_DETAILED.md` or
`ROADMAP_TO_LOGIC_PARITY.md` for facts. They are historical artifacts, mutually
contradictory, and wrong about build status, AI features, CI and what is
"complete". They are retained for the vision discussion only.

---

## The reachability check

The most important tool in this repo. Run it before claiming a feature is done,
and after any refactor.

```bash
python3 scripts/find-unreachable.py
```

It walks the static import graph from `app/` entrypoints and lists every module
nothing imports. Compare against the baseline in the script's header.

- **Your new module appears in the output** → it is not wired. Not done.
- **The count went up** → you created dead code. Fix it now.
- **The count went down** → good. Note it in your final message.

---

## Map of the codebase

Enough to navigate without reading everything.

### Where things live

| Concern | Location | Notes |
|---|---|---|
| Audio playback | `engine/audioEngine/scheduler.ts` | The clock. Correct — don't "fix" it without reading §6 of ASSESSMENT |
| Engine entry point | `engine/AudioEngineAdapter.ts` | Facade. **All UI→audio calls go through here** |
| Application state | `store/projectStore.ts` | 4,860 lines. The single source of truth |
| Signal routing | `engine/audioEngine/routingEngine.ts` | Track/bus/send graph |
| MIDI editing | `engine/midi/midiEditor.ts` | |
| Persistence | `engine/persistence/projectPersistence.ts` | IndexedDB + serialization |
| API authorization | `lib/apiAuth.ts` | **Every route must use this** |
| Main DAW page | `app/project/[projectId]/page.tsx` | Composes ~40 components |

### The load-bearing invariants

Break these and things fail in ways that are hard to trace:

1. **`AudioContext.currentTime` is the master clock.** The scheduler anchors
   `startTime` once and derives beat position from elapsed audio time. Never
   accumulate beats per frame, and never introduce a second clock.
2. **All UI→audio traffic goes through `AudioEngineAdapter`.** Do not import
   `advancedScheduler` or `routingEngine` from a component.
3. **Project state persists as `Project.stateJson`, one blob.** The relational
   `Track`/`Clip`/`Note`/`Automation`/`Plugin`/`Bus`/`Send` models are **dead** —
   nothing writes them. Reading them returns empty. This already caused a shipped
   bug; don't repeat it.
4. **Ownership is a server-side fact.** Never trust a `userId` from a request
   body. Use `requireUserId()` / `requireProjectOwner()`.
5. **`lib/featureFlags.ts` gates nothing.** It is advisory. Don't assume a
   `false` flag means a feature is hidden.

### Known traps

| Trap | Reality |
|---|---|
| `ENABLE_PHASE3_TRANSPORT` | `false`. An entire second DSP architecture (`engine/dsp/**`, WASM, worklet transport) is dormant behind it. It has never run |
| `public/wasm/` | Does not exist. The Rust DSP core has never been built or shipped |
| `store/mixerStore.ts`, `store/clipEditingStore.ts` | Unreferenced. Editing them changes nothing |
| Roadmap "✅" marks | Mean "a file exists", not "a user can do this" |
| `components/filesystem/ExportDialog.tsx` | Dead. The live one is `components/ExportDialog.tsx` |
| `midiStore.play()` / `initializeScheduler()` | Dead. midiStore's transport is *mirrored in* by `ProjectPianoRollAdapter`; it does not drive anything |
| `showBottomPanel` | Derived (`showSmartControls \|\| showMixer \|\| showEditors`), not a store field. Set `showEditors` to open the piano roll |

### Instrument lifetime

The instrument graph is owned by the **application**, not by any component.
`engine/instruments/instrumentBootstrap.ts` brings it up at boot. Never call
`instrumentService.dispose()` from a component's cleanup — a panel unmounting
must not destroy loaded instruments. That bug cost three debugging rounds
because the symptom (everything plays as the built-in synth) looks like a
routing problem, not a lifetime one.

### Running the app locally

`next build` and `next dev` share `.next` and will corrupt each other's output —
the symptom is 404s on `/_next/static/*` and on every `/api/auth/*` route, which
looks alarmingly like an auth regression. If you see that, stop the server,
delete `.next`, and restart. Don't debug it as a code problem.

**Check the port before trusting a browser test.** If something is already on
3000, `next dev` silently starts on 3001 and your test drives the *old* server —
producing confident, wrong results. Confirm with `grep "Local:" <devlog>` and
kill stale processes first:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'next' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

In development `window.__magicPro` exposes `{ projectStore, midiStore,
audioEngine }` for console inspection and browser-driven tests.

---

## Handling a large task without losing the thread

**Write the plan to a file before you start**, not just to the todo list. A
`docs/wip/<task>.md` with the goal, the steps, and a running log of decisions
survives a context reset; a todo list plus your working memory does not.

Structure long work so each step lands in a verifiable state:

- ✅ *"Wire Flex Time into the clip inspector, with a test, verified in the app"* —
  survivable. If context dies after this, the repo is coherent.
- ❌ *"Refactor the store, wire Flex Time, add comping, update the mixer"* —
  a context reset mid-way leaves a repo nobody can reason about.

**Commit at each verified checkpoint.** A commit is the most durable form of
memory available, and the message is a note to the next session.

---

## Ending a session

Your final message is the handoff. It is the only thing guaranteed to be read.
Include:

1. **What actually changed** — files and behaviour, not intentions.
2. **Verification state** — the real output of `npm run verify` and
   `npm run build`. If something fails, the exact error.
3. **What you learned that isn't in the code** — wrong assumptions, dead ends,
   surprises. This is the highest-value part and the easiest to omit.
4. **The next concrete step**, specific enough to act on without re-deriving
   context. Not "continue the refactor" — "split `transportSlice` out of
   `projectStore.ts:1400-1700`, tests in `store/__tests__/transport.test.ts`".

If a finding is durable, put it in `ASSESSMENT.md` too. Final messages scroll
away; the assessment doesn't.

---

## For the human maintaining this

The failure mode that produced 29,500 lines of dead code was **process, not
capability**. If you take one action to prevent recurrence, make it this:

Add a reachability gate to CI (`knip` or `ts-prune`, baselined at the current
count, failing on increase). It mechanically enforces Rule 1 for every future
contributor — human or agent — without anyone having to remember this document.

That single check is worth more than any amount of discipline you can ask of a
system that forgets.
