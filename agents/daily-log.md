# Daily Log

## 2026-06-14 — Pencil Tool Fix & Test Results

### Changes Made
1. **`engine/interactions/RegionCreationController.ts:94`** — Changed `alternativeId: ''` → `alternativeId: track?.activeAlternativeId || ''`. Fixes new clips not rendering in timeline because they had empty `alternativeId` but tracks use `'alt-1'`.

2. **`engine/editor/InteractionManager.ts:15`** — Changed `'pencil': 'pencil'` → `'pencil': 'draw'`. PencilTool registers with id `'draw'`, so the store value `'pencil'` must map to `'draw'`.

3. **`components/GlobalKeyHandler.tsx:393`** — Changed `'2': 'pencil'` → `'2': 'draw'`.

4. **`components/GlobalKeyHandler.tsx`** — Added letter key tool bindings (line 402-409): `p`→draw, `t`→pointer, `c`→scissors, `e`→erase, `z`→zoom, `m`→mute.

5. **`components/GlobalKeyHandler.tsx:259`** — Added null guard: `globalSettings?.keyCommands?.find()` prevents crash when `keyCommands` is undefined.

### Verified
- **Pencil tool region creation**: ✅ Click on timeline after scrolling past existing clips creates a clip with `alternativeId: 'alt-1'` that renders in the DOM.
- **MIDI note creation**: ✅ Clicking inside a MIDI clip creates a MIDI note within that clip.
- **Keyboard shortcuts**: ✅ 'p' and '2' activate pencil tool, 't' for pointer, 'c' for scissors, etc.
- **GlobalKeyHandler crash**: ✅ Fixed — no more `Cannot read properties of undefined (reading 'keyCommands')` errors.

### Not Tested / Blocked
- **Automation point creation**: Lo-fi Beat template has no automation lanes. Need to enable Automation mode via bottom toolbar, but 929px viewport hides it.
- **Undo/redo**: History snapshots are created but not persisted to IndexedDB. Works within a single session only.
- **Layout**: Viewport is 929×861px. Timeline container is only 49px visible — layout is squeezed by track header panel. Full resolution testing needed.
