# Magic Pro — Manual Test Checklist

A by-hand pass over every feature that is actually reachable in the app.

Generated against the current build. Every control named here was verified to
exist in the source; where a feature is known to be broken it is marked rather
than omitted, so you do not waste time chasing a bug that is already recorded.

**Marking:** `- [x]` works · `- [F]` fails · `- [?]` unclear or blocked
Add a note on the line when something fails — what you did, what happened.

---

## 0. Before you start

- [ ] `npm run dev` is running, http://localhost:3000 responds
- [ ] Using **Chrome or Edge** — Safari has no Web MIDI, Firefox is patchy
- [ ] Test account works (`dev@example.com` / `devpassword123`, or your own)
- [ ] Browser console open — a red error during a test is a failure even if the UI looks fine
- [ ] Sound is on and audible from another app first

**Two habits that catch most silent failures:**

1. After anything that should make sound, confirm you *heard* it — not that a
   playhead moved.
2. After anything that should be saved, reload the page and look again.

---

## 1. Account and project lifecycle

- [ ] Sign up with a new email
- [ ] Log out, log back in
- [ ] Google sign-in (if configured)
- [ ] Dashboard lists your projects
- [ ] **New Project** → template picker appears
- [ ] Create from **Blank Project (starts with Drums + Piano)**
- [ ] Create from a content template (EDM, Steinway piano, …) — tracks and clips arrive
- [ ] Open an existing project from the dashboard
- [ ] Rename a project
- [ ] Delete a project
- [ ] Duplicate / Save As
- [ ] Reload mid-session — work is still there
- [ ] Share dialog produces a link; open it in a private window

---

## 2. Studio shell and layout

Control bar, far-left icon group (left to right): Library, Inspector, Quick Help,
Toolbar, │ Smart Controls, Mixer, Editors, Musical Typing.

- [ ] Each icon toggles its panel, and toggles it back off
- [ ] Panels remember their state when you switch views
- [ ] Window resize / smaller viewport does not break the layout
- [ ] Horizontal scroll never appears on the page body
- [ ] **Control bar dropdowns open above everything** — not clipped behind the toolbar or timeline
- [ ] App menu bar: File, Edit, Track, Navigate, Record, Mix, View, Window, Help all open
- [ ] Menu items either do something or are visibly disabled — none silently do nothing
- [ ] Right-click context menus in the track list and timeline

---

## 3. Transport and playhead

*Recently rewritten — test this properly.*

- [ ] **Space** starts and stops playback
- [ ] **Play** button matches Space
- [ ] **Stop** button stops
- [ ] **Go to Beginning** (leftmost transport arrow) returns the playhead to bar 1
- [ ] **Rewind** / **Forward** move by one bar
- [ ] Record button arms and rolls

**The regression that caused silence — check this explicitly:**

- [ ] Play from bar 1, stop, **Go to Beginning**, play again → *sound both times*
- [ ] Repeat four times in a row → still audible, still starts at bar 1
- [ ] Playback starts exactly where the playhead sits, not slightly after

- [ ] Click the ruler to move the playhead while stopped
- [ ] Click the ruler while playing — transport stops and the playhead lands there
- [ ] Playhead stays locked to what you hear (no visual drift over a long pass)
- [ ] LCD display counts bars/beats correctly
- [ ] LCD display-mode menu (Beats & Project / Beats & Time / Beats / Time / Custom)
- [ ] Click the **time signature** in the LCD → dropdown of signatures, selecting one applies it
- [ ] Click the **key signature** → same
- [ ] Tempo field accepts a new BPM and playback speed follows
- [ ] Cycle on/off; playback loops between the locators
- [ ] Drag the locators; cycle range follows
- [ ] Skip cycle
- [ ] Metronome toggle — clicks audible while rolling
- [ ] Count-in toggle → **clicks before the transport rolls** ⚠️ *newly implemented, never verified by ear*

---

## 4. Tracks

- [ ] **New Track** dialog opens and is fully colour-themed (no black-and-white panel)
- [ ] Create: Audio, Software Instrument, Drummer, External MIDI
- [ ] Instrument dropdown in the dialog cascades and is not clipped to a few rows
- [ ] Pattern-track instrument dropdown likewise
- [ ] Track appears with the right type, colour and icon
- [ ] Rename a track (double-click the name)
- [ ] Reorder tracks by dragging
- [ ] Delete a track
- [ ] Duplicate a track
- [ ] **M** mutes, **S** solos, and solo silences everything else
- [ ] **R** arms for recording (turns solid red)
- [ ] Volume fader and pan knob change what you hear
- [ ] Track colour palette applies, and the clip and waveform follow the colour
- [ ] Track stacks: create a Summing stack, folder open/close
- [ ] Freeze a track, then play — audio still correct; unfreeze
- [ ] Hide / show tracks
- [ ] Track header config dialog changes which buttons show

---

## 5. Library and instruments

- [ ] Library opens; **"Loading SoundFonts…"** clears within ~5 s ⚠️ *known slow — server parses a 30 MB bank*
- [ ] SoundFont list shows the bundled fonts
- [ ] Click **GeneralUser-GS** → 287 presets load
- [ ] Select **Grand Piano** → track instrument updates, plays as a piano
- [ ] Select **Brass Section** → clearly different timbre
- [ ] Select **Slow Strings** → clearly different again
- [ ] Play the same phrase on all three — they must not sound identical
- [ ] Preset choice survives a page reload
- [ ] Category presets (non-SoundFont) also load and play
- [ ] Search box filters the list
- [ ] Patch merging area toggles

**Pitch accuracy — the octave-4 bug:**

- [ ] Play a chromatic run C3 → C5 on the piano — no note is wildly out of tune
- [ ] Play C4, D4, E4, F4, G4, A4, B4 in sequence — the intervals sound right
- [ ] Play the black keys around C4 — in tune with their neighbours

---

## 6. MIDI recording

*Every item here was broken and has just been fixed. Test all of it.*

### On-screen (Musical Typing)

Keys: `a w s e d f t g y h u j` = C C♯ D D♯ E F F♯ G G♯ A A♯ B · `z`/`x` change octave.

- [ ] Musical Typing panel opens
- [ ] Keys make sound
- [ ] Octave up/down works
- [ ] Arm a track, press Record, play four notes, stop
- [ ] **Notes are spread across the bar** — not stacked on beat 1
- [ ] **Note lengths match how long you held each key** — not all minimum stubs
- [ ] The region is labelled **MIDI**, not Audio
- [ ] Go to Beginning → Space → **you hear the recording back**
- [ ] Play the *same* key twice in one take — both notes keep their own length

### Hardware MIDI keyboard

- [ ] Preferences → MIDI lists your device, status `granted`
- [ ] Playing the keyboard makes sound
- [ ] Piano roll highlights keys as you hold them
- [ ] Arm, Record, play a phrase, stop → **notes are captured** *(this was the "sounds but never records" bug)*
- [ ] Note lengths match how long you held them
- [ ] Sustain pedal / CC behaves
- [ ] Velocity is captured — play soft vs hard, check the note colours differ
- [ ] Unplug and replug the keyboard mid-session — it still works

### Recording behaviour

- [ ] Record while already playing (punch in by ear)
- [ ] Autopunch: set punch in/out, record — only that range is captured
- [ ] Count-in before recording ⚠️ *unverified*
- [ ] Discard Live Recording (Shift+D)
- [ ] Recording over an existing region ⚠️ *known gap: merge / replace / take-folder modes are audio-only, MIDI just drops another region on top*
- [ ] Cycle recording ⚠️ *known gap: no MIDI take folders*
- [ ] Step input keyboard enters notes at the playhead

---

## 7. Audio recording

- [ ] Preferences → Audio lists an input device
- [ ] Arm an audio track, monitor input
- [ ] Record → waveform appears and is drawn in the track colour
- [ ] Play back — you hear it
- [ ] Take folders: record twice over the same range → folder created
- [ ] Open the folder, swipe-comp between takes
- [ ] Autopunch on an audio track

---

## 8. Piano roll

- [ ] Double-click a MIDI region → piano roll opens with that region's notes
- [ ] Draw a note with the pencil
- [ ] Drag a note to move it; drag its edge to resize
- [ ] Delete a note
- [ ] Marquee-select several notes; move them together
- [ ] Copy / paste / duplicate
- [ ] Velocity edit lane
- [ ] Quantize selected notes
- [ ] Transpose selected notes
- [ ] Mute / unmute selected notes
- [ ] Snap setting changes the grid
- [ ] **Grid lines are clearly visible** — bar lines stronger than beat lines
- [ ] Scale quantize / scale highlight
- [ ] Fold mode
- [ ] Ruler in seconds
- [ ] Zoom in/out; zoom to selection
- [ ] Keyboard on the left plays notes when clicked
- [ ] Loop range inputs
- [ ] ⚠️ *Known broken: the piano roll's **own** play/stop/go-to-start buttons make no sound — use the main transport*

### Editor tabs

- [ ] **Piano Roll** tab — works
- [ ] **Step Sequencer** tab — drum lanes, steps toggle, edits reach the real region
- [ ] **Score** tab ⚠️ *known broken: shows the piano roll*
- [ ] **Smart Tempo** tab ⚠️ *known broken: shows the piano roll*
- [ ] Event List shows the region's real events (not five invented notes)
- [ ] Event List row count matches the note count

---

## 9. Timeline and clip editing

- [ ] Clips render in their track colour with visible names
- [ ] Audio waveforms drawn in the track colour, not black
- [ ] Drag a clip along the timeline and between tracks
- [ ] Trim from either edge
- [ ] Split at the playhead
- [ ] Join / merge
- [ ] Copy, paste, duplicate, delete
- [ ] Loop a clip
- [ ] Fade in / fade out handles
- [ ] Gain / clip volume
- [ ] Transpose and velocity offset on a MIDI region
- [ ] Snap modes: bar, half, quarter, eighth, sixteenth
- [ ] Zoom horizontal and vertical
- [ ] Marquee select across tracks
- [ ] Undo / redo across all of the above
- [ ] Markers: create, rename, navigate to
- [ ] Global tracks: tempo, key, time signature, markers
- [ ] Tempo changes and ramps actually alter playback speed

---

## 10. Mixer

- [ ] Mixer opens and shows a strip per track
- [ ] Faders and pans match the track list, both directions
- [ ] Meters move while playing, and **green → amber → red** as level rises
- [ ] Mute / solo per strip
- [ ] Insert an effect on a strip
- [ ] Sends to a bus; bus strip appears and carries the signal
- [ ] Output routing per strip
- [ ] Group slot (mute/solo groups) — grouping actually links the tracks
- [ ] VCA faders: create one, assign tracks, move it — member levels follow
- [ ] Master strip controls overall level
- [ ] Sidechain source selection

---

## 11. Plugins and effects

- [ ] Plugin browser opens and lists built-in effects
- [ ] Insert an effect — it audibly changes the sound
- [ ] Plugin editor window opens, controls respond
- [ ] Bypass
- [ ] Reorder inserts
- [ ] Remove an insert
- [ ] Channel EQ: curve draws, bands respond, audible
- [ ] Third-party WAM plugin loads (if you have one)
- [ ] Plugin latency compensation — a latent plugin does not push the track out of time
- [ ] Smart Controls panel maps to something real

---

## 12. Automation

- [ ] Show automation on a track
- [ ] Draw points on volume
- [ ] Playback follows the curve audibly
- [ ] Switch parameter (pan, plugin parameter)
- [ ] Delete points; move points
- [ ] Latch / touch write modes if present

---

## 13. Audio processing

- [ ] Flex Time: stretch a clip, playback follows, pitch unchanged
- [ ] Audio quantize
- [ ] Audio → MIDI on an audio region → a MIDI region with plausible pitches
- [ ] Stem separation
- [ ] Drum replacement dialog
- [ ] Selection-based processing
- [ ] Spot erase
- [ ] Normalize / gain operations
- [ ] ⚠️ *Absent: Flex Pitch (module exists, nothing imports it)*
- [ ] ⚠️ *Absent: spectral editing (same)*

---

## 14. Live Loops and browsers

- [ ] Live Loops grid opens
- [ ] Add a cell, trigger it, stop it
- [ ] Record into a cell
- [ ] Scene launch
- [ ] Loop browser lists loops; preview plays
- [ ] Drag a loop to a track — it lands and plays
- [ ] File browser / Browsers panel navigates
- [ ] Note Pad saves text and survives reload

---

## 15. Bounce and export

- [ ] Bounce Track → file downloads and plays correctly elsewhere
- [ ] Bounce All Tracks
- [ ] Bounce Regions
- [ ] Export dialog: format, sample rate, bit depth options
- [ ] Exported audio matches what you heard — same length, same mix
- [ ] Bounce in place

---

## 16. Preferences

Tabs: General, Audio, Recording, MIDI, Score, Movie, Automation, Control
Surfaces, View, My Info, Advanced.

- [ ] Every tab opens without an error
- [ ] Audio: output device selection changes where sound goes
- [ ] MIDI: input devices listed, enable/disable a device is honoured
- [ ] Recording settings persist
- [ ] Control surfaces: a connected surface is detected
- [ ] Settings survive a reload
- [ ] Key commands editor; rebinding takes effect

---

## 17. Persistence and reliability

- [ ] Save, reload, everything returns — tracks, clips, notes, mixer, instruments
- [ ] Undo history across a long session
- [ ] Project alternatives: create, switch, changes are isolated
- [ ] Import project
- [ ] Import audio file by drag-and-drop
- [ ] Offline / reconnect indicator is truthful
- [ ] Autosave does not lose work
- [ ] No console errors on load ⚠️ *known issue: a React hydration warning fires on every studio load*

---

## 18. Cross-cutting

- [ ] **Every dropdown and dialog opens on top of the UI** — nothing hidden behind a panel
- [ ] Text is readable everywhere; no dark-on-dark
- [ ] Keyboard shortcuts do not fire while typing in a text field
- [ ] Long session (~15 min) — no audio degradation, no runaway memory
- [ ] Nothing anywhere shows invented placeholder data

---

## Known broken — expected failures

Do not spend time on these; they are recorded and unfixed.

| Area | Problem |
|---|---|
| Piano roll transport | Its own play/stop/go-to-start make no sound — driven by a scheduler with no instruments registered |
| Score tab | Shows the piano roll |
| Smart Tempo tab | Shows the piano roll |
| Flex Pitch | Module exists, nothing imports it |
| Spectral editing | Same |
| Smart Tempo engine | Absent |
| MTC / external sync | Code present, no settings control, needs hardware to verify |
| MIDI over-recording | Merge / replace / take-folder modes are audio-only |
| Cycle record (MIDI) | No take folders |
| Input quantize | Absent |
| Library open | ~5 s "Loading SoundFonts…" on first open |
| Studio load | React hydration warning in the console |
| Flex algorithm option | `FlexTimeOptions.algorithm` is accepted and never read |

---

## Recently fixed — re-verify these first

If any of these fail, it is a regression and worth reporting immediately.

- [ ] Play → stop → return to start → play again **still makes sound** (was silent from the second play on)
- [ ] Playback begins exactly at the playhead (was drifting later each time)
- [ ] **Go to Beginning** button exists and works (previously hidden and wired to stop)
- [ ] Rewind and Forward do something (previously dead buttons)
- [ ] MIDI recording lands notes on the beats played (was all stacked on beat 1)
- [ ] Recorded note lengths match how long keys were held (were all minimum stubs)
- [ ] Recorded region is typed MIDI and plays back (was typed audio and silent)
- [ ] A hardware keyboard's playing is **recorded**, not just heard
- [ ] Repeating a pitch in one take does not corrupt the earlier note
- [ ] Grand Piano sounds like a piano (was falling back to a synth oscillator)
- [ ] Octave 4 and its black keys are in tune (font sample rates were misread)
- [ ] Count-in produces clicks before the transport rolls ⚠️ *never verified by ear*

---

## Reporting

For each failure note:

1. What you clicked, in order
2. What you expected
3. What happened
4. Any console error, copied verbatim
5. Whether it reproduces on a reload
