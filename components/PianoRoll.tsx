"use client";

/**
 * PianoRoll.tsx
 * 
 * REFACTORED: Now a thin adapter wrapper around ProjectPianoRollAdapter.
 * 
 * The original monolithic piano roll has been split into:
 * - components/midi/PianoRoll.tsx (core editor, uses midiStore)
 * - components/adapters/ProjectPianoRollAdapter.tsx (project integration)
 * - engine/pianoRoll/projectSync.ts (sync layer)
 * 
 * This file exists for backward compatibility. New code should use:
 * - ProjectPianoRollAdapter for project-integrated editing
 * - components/midi/PianoRoll for standalone MIDI editing
 */

import { ProjectPianoRollAdapter } from "./adapters/ProjectPianoRollAdapter";
import { useProjectStore } from "@/store/projectStore";

export function PianoRoll() {
  const { pianoRollLinkMode } = useProjectStore();

  return (
    <ProjectPianoRollAdapter
      linkMode={pianoRollLinkMode}
      autoSave={true}
    />
  );
}

export default PianoRoll;
