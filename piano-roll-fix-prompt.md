# Piano Roll Fix Prompt

Paste this into your AI coding assistant along with the relevant files
(`PianoRoll.tsx`, `midiStore.ts`, `midiEditor.ts`, `PianoRollTools.tsx`,
`NavigationEngine.ts`, `VelocityLane.tsx`, `types.ts`) to work through the
fixes in order. Do it in phases — don't ask for everything at once, since
later fixes depend on earlier ones being correct.

---

## Phase 1 — Critical: Wire up dragging (blocks everything else)

```
My piano roll has a complete drag state system in midiStore.ts
(startDrag/updateDrag/endDrag) but PianoRoll.tsx never calls it — there
are no mousemove/mouseup handlers registered, only mousedown for
click-tool actions. Fix this:

1. Add mousemove and mouseup handlers to the canvas (or window, if drag
   needs to continue outside canvas bounds) that:
   - On mousedown over a note: determine if it's a move, resize-left, or
     resize-right based on hit position, then call startDrag with the
     correct mode and the note's ORIGINAL values (startBeat, duration,
     pitch) captured at drag start — not live values that could already
     be mutated.
   - On mousemove while dragging: call updateDrag with the current
     pointer position/delta. This should update a live preview (either
     by mutating a draft note or rendering an offset directly in the
     renderer) without committing to the store until mouseup.
   - On mouseup: call endDrag to commit the final position.

2. Fix endDrag itself (midiStore.ts) — currently it computes final
   position as `targetNote.startBeat + deltaBeats` and
   `targetNote.duration + deltaBeats`, using LIVE note values. Change
   this to use `dragState.originalStartBeat + deltaBeats` and
   `dragState.originalDuration + deltaBeats` (the values captured when
   the drag started), so multi-step or interrupted drags compute
   correctly.

3. Replace the local hitTestNote function in PianoRoll.tsx with the
   store's hitTest from midiEditor.ts, which already correctly detects
   resize-left/resize-right edge zones with tolerance. Wire its result
   into the drag-mode decision in step 1.

4. Enforce a minimum note duration during resize (e.g. Math.max(0.01,
   newDuration)) both in the live preview and in endDrag's commit, so a
   note can't be dragged to zero or negative length.

Show me the full updated mousedown/mousemove/mouseup handlers and the
corrected endDrag function.
```

---

## Phase 2 — Critical: Undo/Redo

```
Before implementing undo/redo from scratch in midiStore.ts, check
whether my project already has a global history system — I recall
projectStore.ts keeps history snapshots for other state. If that system
exists:
- Wire PianoRoll's note operations (add, delete, move, resize, velocity
  change, paste, quantize, transform) to push snapshots into that
  existing history store instead of building a parallel one.
- Pass canUndo/canRedo/onUndo/onRedo from that store into
  PianoRollTools, which already expects these props but currently gets
  nothing.

If no such system exists, or if MIDI note edits are too high-frequency
to snapshot the whole project on every change, implement a scoped
undo/redo history local to midiStore.ts:
- A stack of note-array snapshots (or command objects with
  do/undo functions — prefer commands if snapshots would be memory-heavy
  with large clips).
- Push a new entry on every completed operation (note add/delete/move/
  resize/paste/quantize/transform) — NOT on every intermediate drag
  frame, only on commit (mouseup / endDrag).
- Wire canUndo/canRedo/onUndo/onRedo into PianoRollTools.

Either way, verify: undo after a multi-note drag restores ALL selected
notes to their original position, not just one. Redo restores the exact
same state with no property drift.
```

---

## Phase 3 — Major: Playback cursor, keyboard shortcuts, boundaries

```
Fix these three issues in PianoRoll.tsx:

1. PLAYBACK CURSOR: isPlaying and currentBeat exist in the store but
   nothing draws a cursor line during playback. Add cursor rendering to
   the canvas render loop, converting currentBeat to an x-coordinate
   using the same beat-to-pixel conversion used elsewhere in the
   component, and redraw it every animation frame while isPlaying is
   true.

2. KEYBOARD SHORTCUTS: PianoRollTools advertises shortcuts (S=Select,
   B=Draw, E=Erase, V=Velocity, Q=Quantize, Cmd/Ctrl+Z=Undo,
   Cmd/Ctrl+Shift+Z=Redo, Cmd/Ctrl+G=Snap toggle) but no keydown listener
   exists anywhere. Add a useEffect in PianoRoll.tsx that registers a
   keydown listener (cleaned up on unmount), ignores keystrokes when an
   input/textarea is focused, and maps each key to its corresponding
   store action.

3. CLIP BOUNDARY ENFORCEMENT: addNote and moveSelectedNotes don't check
   against clip.durationBeats, so notes can be created or dragged past
   the end of the clip, where they render but never play. Add a clamp in
   both functions so a note's startBeat + duration never exceeds
   clip.durationBeats, and startBeat never goes below 0.

Show me the updated code for each fix separately.
```

---

## Phase 4 — Medium: Dead/broken UI pieces

```
Fix these:

1. VelocityLane is imported in PianoRoll.tsx but never rendered — an
   empty div is used instead, and onVelocityChange/
   onVelocityChangeSelected are never passed to anything. Wire it up:
   render <VelocityLane> with the current clip's notes, selection state,
   and pass the change handlers through to the store's velocity-update
   actions.

2. The scrollbar drag handler has `window.addEventListener('mousemove',
   handleScrollBarMouseMove as any)` — the `as any` is hiding a real type
   mismatch. handleScrollBarMouseMove expects a React.MouseEvent and
   calls e.currentTarget.getBoundingClientRect(), but a native
   window-level MouseEvent's currentTarget is window, not the scrollbar
   div. Fix by either (a) capturing the scrollbar element's
   getBoundingClientRect() once at drag start and using that fixed rect
   for the whole drag, or (b) rewriting the handler to accept a native
   MouseEvent and reference the stored element ref instead of
   e.currentTarget. Remove the `as any` cast entirely once types are
   correct.

3. midiStore.ts has its own viewport/zoomLevel/scrollPosition state, but
   NavigationEngine.ts has a separate pianoRollNavigation viewport that
   the canvas renderer actually reads from. These are never synced —
   calling the store's zoomIn/zoomOut/setScrollPosition does nothing
   visible. Pick ONE source of truth (recommend NavigationEngine's
   pianoRollNavigation, since the renderer already depends on it) and
   either remove the duplicate state from midiStore or make the store's
   methods delegate to pianoRollNavigation instead of maintaining
   parallel state.

Show me each fix with enough surrounding context that I can see exactly
where it plugs into the existing code.
```

---

## Phase 5 — Low priority cleanup (batch these together)

```
Quick fixes, low risk, can be done together:

1. addNote has no minimum duration guard on its input — add
   Math.max(0.01, duration) at the top of the function.

2. Velocity drag in endDrag currently sets the SAME absolute velocity on
   all selected notes. Change it to apply the velocity DELTA to each
   note's existing velocity instead, clamped to the valid 0-127 range,
   so relative differences between notes are preserved.

3. Note IDs use `note-${Date.now()}-${random}` which has a theoretical
   collision risk under rapid note creation. Replace with crypto.randomUUID()
   if available in the target runtime, or a monotonic counter combined
   with Date.now() as a fallback.

4. globalSpatialNoteCache.buildCache(clipData.notes) is called on every
   render frame in PianoRoll.tsx — move this into a useEffect keyed on
   clipData.notes (or a hash/version of it) so it only rebuilds when
   notes actually change.

5. PianoRoll.tsx has two separate useMidiStore() calls causing two
   independent subscriptions/re-renders. Combine into a single selector
   call that returns everything needed, or use a shallow-equal selector
   to avoid redundant re-renders.

6. The useEffect that creates `new PitchGridRenderer(ctx)` and `new
   MidiRenderer(ctx)` never disposes them on cleanup or when clipId
   changes. Add a cleanup function that calls a dispose()/destroy()
   method on each renderer (add one if it doesn't exist) before creating
   new instances.

7. Verify the `@/store/midiStore` import path in MidiRenderer.ts actually
   resolves — check tsconfig.json / jsconfig.json for the `@/*` paths
   mapping. If missing, either add the mapping or switch to a relative
   import.

Show me each fix individually so I can review before applying.
```

---

## After all phases: regression check

```
Now that Phases 1-5 are done, walk back through the original test
checklist and confirm each of these explicitly:

- Drag-move and drag-resize (both edges) work and respect minimum
  duration
- Undo/redo correctly restores multi-note operations
- Playback cursor tracks currentBeat accurately during playback and loop
- Keyboard shortcuts fire correctly and are ignored while typing in an
  input field
- Notes cannot be created or dragged past clip boundaries
- VelocityLane renders and updates the correct note's velocity, even
  with overlapping notes
- Scrollbar drag produces correct scroll position at all zoom levels
- Zoom/scroll state is now consistent between the store and the renderer
  (no more dual state)

Report any of these that still fail.
```
