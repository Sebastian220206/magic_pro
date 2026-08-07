import type { Clip, FadeSettings, MidiNote } from '@/engine/timeline/types';
import {
  splitClip,
  splitClipsAtTime,
  duplicateClip,
  duplicateClips,
  trimClip,
  trimClipToRange,
  stretchClip,
  changePlaybackRate,
  pitchShift,
  reverseClip,
  isClipReversed,
  updateFade,
  calculateFadeGain,
  moveClip,
  moveClipsRelative,
  mergeClips,
  renameClip,
  toggleClipMute,
  setClipColor,
  transposeMidiClip,
  quantizeMidiClip,
  adjustMidiVelocity,
} from '@/engine/timeline/clipTools';

const defaultFade: FadeSettings = { duration: 0, curve: 'linear', gain: 1 };

function createAudioClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    trackId: 'track-1',
    type: 'audio',
    startTime: 0,
    duration: 8,
    offset: 0,
    name: 'Test Loop',
    color: '#888',
    muted: false,
    loop: false,
    fadeIn: { ...defaultFade },
    fadeOut: { ...defaultFade },
    playbackRate: 1.0,
    pitchOffset: 0,
    stretchMode: 'none',
    ...overrides,
  };
}

function createMidiNote(overrides: Partial<MidiNote> = {}): MidiNote {
  return {
    id: 'note-1',
    pitch: 60,
    velocity: 100,
    start: 0,
    duration: 1,
    ...overrides,
  };
}

function createMidiClip(overrides: Partial<Clip> = {}): Clip {
  return {
    ...createAudioClip({ type: 'midi', ...overrides }),
    notes: [
      createMidiNote({ id: 'n1', pitch: 60, start: 0, duration: 2 }),
      createMidiNote({ id: 'n2', pitch: 64, start: 2, duration: 1 }),
      createMidiNote({ id: 'n3', pitch: 67, start: 4, duration: 1.5 }),
    ],
  };
}

// ── Split Operations ──────────────────────────────────────────────────

describe('splitClip', () => {
  test('splits an audio clip at interior position', () => {
    const clip = createAudioClip();
    const result = splitClip(clip, 3);

    expect(result).not.toBeNull();
    if (!result) return;

    const [left, right] = result;
    expect(left.startTime).toBe(0);
    expect(left.duration).toBe(3);
    expect(right.startTime).toBe(3);
    expect(right.duration).toBe(5);
    expect(right.offset).toBe(3);
    expect(left.id).not.toBe(right.id);
  });

  test('returns null when splitting at edges', () => {
    const clip = createAudioClip();
    expect(splitClip(clip, 0)).toBeNull();
    expect(splitClip(clip, 8)).toBeNull();
  });

  test('splits a MIDI clip and distributes notes correctly', () => {
    const clip = createMidiClip();
    const result = splitClip(clip, 2.5);

    expect(result).not.toBeNull();
    if (!result) return;

    const [left, right] = result;
    // Note n1 (start=0, dur=2) starts and ends before split → stays in left
    expect(left.notes!.find(n => n.id === 'n1')?.duration).toBe(2);
    // Note n2 (start=2, dur=1) starts before split, crosses → truncated in left, new note in right
    const leftN2 = left.notes!.find(n => n.id === 'n2');
    const rightN2 = right.notes!.find(n => n.id === 'n2');
    expect(leftN2?.duration).toBe(0.5); // truncate to split
    expect(rightN2?.start).toBe(0); // rehomed to start of right clip
    expect(rightN2?.duration).toBe(0.5);
    // Note n3 (start=4) after split → moved to right with adjusted start
    const rightN3 = right.notes!.find(n => n.id === 'n3');
    expect(rightN3?.start).toBe(1.5); // 4 - 2.5
  });

  test('returns new clip IDs for split results', () => {
    const clip = createAudioClip();
    const [left, right] = splitClip(clip, 4)!;

    expect(left.id).not.toBe(clip.id);
    expect(right.id).not.toBe(clip.id);
    expect(left.id).not.toBe(right.id);
  });
});

describe('splitClipsAtTime', () => {
  test('splits only clips that span the split time', () => {
    const clips = [
      createAudioClip({ id: 'c1', startTime: 0, duration: 4 }),
      createAudioClip({ id: 'c2', startTime: 4, duration: 4 }),
    ];
    const result = splitClipsAtTime(clips, 2);

    expect(result.length).toBe(3);
    const ids = result.map(c => c.id);
    expect(ids.filter(id => id !== 'c2').length).toBe(2); // c1 was split, c2 untouched
  });

  test('returns original clips when split is outside all clips', () => {
    const clips = [
      createAudioClip({ id: 'c1', startTime: 0, duration: 4 }),
      createAudioClip({ id: 'c2', startTime: 4, duration: 4 }),
    ];
    const result = splitClipsAtTime(clips, 10);
    expect(result.length).toBe(2);
  });
});

// ── Duplicate Operations ──────────────────────────────────────────────

describe('duplicateClip', () => {
  test('creates a copy at the default offset of 4 beats', () => {
    const clip = createAudioClip({ startTime: 2 });
    const dup = duplicateClip(clip);

    expect(dup.startTime).toBe(6);
    expect(dup.trackId).toBe(clip.trackId);
    expect(dup.id).not.toBe(clip.id);
    expect(dup.duration).toBe(clip.duration);
  });

  test('creates a copy on a different track when specified', () => {
    const clip = createAudioClip();
    const dup = duplicateClip(clip, 4, 'track-2');

    expect(dup.trackId).toBe('track-2');
    expect(dup.isSelected).toBe(false);
  });

  test('increments name to indicate duplicate', () => {
    const clip = createAudioClip({ name: 'Kick' });
    const dup = duplicateClip(clip);
    expect(dup.name).toBe('Kick (2)');
  });

  test('handles names that already end with (N)', () => {
    const clip = createAudioClip({ name: 'Kick (3)' });
    const dup = duplicateClip(clip);
    expect(dup.name).toBe('Kick (2)');
  });
});

describe('duplicateClips', () => {
  test('preserves relative positions between clips', () => {
    const clips = [
      createAudioClip({ id: 'c1', startTime: 0 }),
      createAudioClip({ id: 'c2', startTime: 4 }),
    ];
    const dups = duplicateClips(clips, 8);

    expect(dups).toHaveLength(2);
    expect(dups[0].startTime).toBe(8);
    expect(dups[1].startTime).toBe(12);
  });

  test('returns empty for empty input', () => {
    expect(duplicateClips([])).toEqual([]);
  });
});

// ── Trim Operations ───────────────────────────────────────────────────

describe('trimClip', () => {
  test('updates start time, duration, and offset', () => {
    const clip = createAudioClip({ startTime: 2, offset: 0 });
    const trimmed = trimClip(clip, {
      clipId: clip.id,
      edge: 'left',
      newStartTime: 3,
      newDuration: 4,
      newOffset: 1,
    });

    expect(trimmed.startTime).toBe(3);
    expect(trimmed.duration).toBe(4);
    expect(trimmed.offset).toBe(1);
  });
});

describe('trimClipToRange', () => {
  test('trims to the intersection of clip and range', () => {
    const clip = createAudioClip({ startTime: 2, duration: 8, offset: 0 });
    const trimmed = trimClipToRange(clip, 4, 8);

    expect(trimmed).not.toBeNull();
    if (!trimmed) return;
    expect(trimmed.startTime).toBe(4);
    expect(trimmed.duration).toBe(4);
    expect(trimmed.offset).toBe(2);
  });

  test('returns null when clip does not overlap range', () => {
    const clip = createAudioClip({ startTime: 10, duration: 4 });
    expect(trimClipToRange(clip, 0, 4)).toBeNull();
  });
});

// ── Stretch / Rate Operations ─────────────────────────────────────────

describe('changePlaybackRate', () => {
  test('halving rate doubles duration', () => {
    const clip = createAudioClip({ duration: 4, playbackRate: 1 });
    const stretched = changePlaybackRate(clip, 0.5);

    expect(stretched.playbackRate).toBe(0.5);
    expect(stretched.duration).toBe(8);
  });

  test('doubling rate halves duration', () => {
    const clip = createAudioClip({ duration: 8, playbackRate: 1 });
    const stretched = changePlaybackRate(clip, 2);

    expect(stretched.playbackRate).toBe(2);
    expect(stretched.duration).toBe(4);
  });
});

describe('pitchShift', () => {
  test('accumulates pitch offset', () => {
    const clip = createAudioClip({ pitchOffset: 0 });
    const shifted = pitchShift(clip, 5);
    expect(shifted.pitchOffset).toBe(5);

    const shiftedAgain = pitchShift(shifted, -2);
    expect(shiftedAgain.pitchOffset).toBe(3);
  });
});

describe('stretchClip', () => {
  test('updates duration and playback rate', () => {
    const clip = createAudioClip();
    const stretched = stretchClip(clip, { clipId: clip.id, newDuration: 16, newPlaybackRate: 0.5 });

    expect(stretched.duration).toBe(16);
    expect(stretched.playbackRate).toBe(0.5);
    expect(stretched.stretchMode).toBe('time');
  });
});

// ── Reverse Operations ────────────────────────────────────────────────

describe('reverseClip / isClipReversed', () => {
  test('reverseClip sets negative playback rate', () => {
    const clip = createAudioClip({ playbackRate: 1 });
    const reversed = reverseClip(clip);
    expect(reversed.playbackRate).toBeLessThan(0);
  });

  test('isClipReversed detects reversed clips', () => {
    expect(isClipReversed(createAudioClip({ playbackRate: -1 }))).toBe(true);
    expect(isClipReversed(createAudioClip({ playbackRate: 1 }))).toBe(false);
  });
});

// ── Fade Operations ──────────────────────────────────────────────────

describe('updateFade', () => {
  test('updates fade-in settings', () => {
    const clip = createAudioClip();
    const updated = updateFade(clip, 'in', { duration: 2, curve: 'exponential' });

    expect(updated.fadeIn.duration).toBe(2);
    expect(updated.fadeIn.curve).toBe('exponential');
    expect(updated.fadeOut.duration).toBe(0); // untouched
  });

  test('updates fade-out settings', () => {
    const clip = createAudioClip();
    const updated = updateFade(clip, 'out', { duration: 1.5 });

    expect(updated.fadeOut.duration).toBe(1.5);
    expect(updated.fadeIn.duration).toBe(0);
  });
});

describe('calculateFadeGain', () => {
  const fade: FadeSettings = { duration: 4, curve: 'linear', gain: 1 };

  test('fade-in starts at 0 and ends at 1', () => {
    expect(calculateFadeGain(fade, 0, 'in')).toBeCloseTo(0);
    expect(calculateFadeGain(fade, 4, 'in')).toBeCloseTo(1);
  });

  test('fade-out starts at 1 and ends at 0', () => {
    expect(calculateFadeGain(fade, 0, 'out')).toBeCloseTo(1);
    expect(calculateFadeGain(fade, 4, 'out')).toBeCloseTo(0);
  });

  test('midpoint of linear fade-in is 0.5', () => {
    expect(calculateFadeGain(fade, 2, 'in')).toBeCloseTo(0.5);
  });

  test('exponential fade curves produce squared values', () => {
    const expFade: FadeSettings = { duration: 4, curve: 'exponential', gain: 1 };
    expect(calculateFadeGain(expFade, 2, 'in')).toBeCloseTo(0.25);
  });

  test('logarithmic fade curves produce sqrt values', () => {
    const logFade: FadeSettings = { duration: 4, curve: 'logarithmic', gain: 1 };
    expect(calculateFadeGain(logFade, 2, 'in')).toBeCloseTo(Math.sqrt(0.5));
  });

  test('S-curve at midpoint is 0.5', () => {
    const sFade: FadeSettings = { duration: 4, curve: 'scurve', gain: 1 };
    expect(calculateFadeGain(sFade, 2, 'in')).toBeCloseTo(0.5);
  });

  test('zero-duration fade returns boundary value', () => {
    const zeroFade: FadeSettings = { duration: 0, curve: 'linear', gain: 1 };
    expect(calculateFadeGain(zeroFade, 0, 'in')).toBe(0);
    expect(calculateFadeGain(zeroFade, 0, 'out')).toBe(1);
  });

  test('applies gain multiplier', () => {
    const gainFade: FadeSettings = { duration: 4, curve: 'linear', gain: 0.7 };
    expect(calculateFadeGain(gainFade, 2, 'in')).toBeCloseTo(0.35);
  });

  test('clamps position to valid range', () => {
    const f: FadeSettings = { duration: 4, curve: 'linear', gain: 1 };
    expect(calculateFadeGain(f, -1, 'in')).toBeCloseTo(0);
    expect(calculateFadeGain(f, 10, 'in')).toBeCloseTo(1);
  });
});

// ── Move Operations ───────────────────────────────────────────────────

describe('moveClip', () => {
  test('changes start time', () => {
    const clip = createAudioClip({ startTime: 0 });
    const moved = moveClip(clip, 8);
    expect(moved.startTime).toBe(8);
  });

  test('changes track when specified', () => {
    const clip = createAudioClip();
    const moved = moveClip(clip, 4, 'track-2');
    expect(moved.trackId).toBe('track-2');
  });
});

describe('moveClipsRelative', () => {
  test('shifts all clips by delta', () => {
    const clips = [
      createAudioClip({ id: 'c1', startTime: 0 }),
      createAudioClip({ id: 'c2', startTime: 4 }),
    ];
    const moved = moveClipsRelative(clips, 2);
    expect(moved[0].startTime).toBe(2);
    expect(moved[1].startTime).toBe(6);
  });
});

// ── Merge Operations ──────────────────────────────────────────────────

describe('mergeClips', () => {
  test('merges adjacent clips on same track', () => {
    const clips = [
      createAudioClip({ id: 'c1', startTime: 0, duration: 4 }),
      createAudioClip({ id: 'c2', startTime: 4, duration: 4 }),
    ];
    const merged = mergeClips(clips);
    expect(merged).not.toBeNull();
    if (!merged) return;
    expect(merged.startTime).toBe(0);
    expect(merged.duration).toBe(8);
  });

  test('returns null for clips on different tracks', () => {
    const clips = [
      createAudioClip({ id: 'c1', startTime: 0, trackId: 'track-1' }),
      createAudioClip({ id: 'c2', startTime: 4, trackId: 'track-2' }),
    ];
    expect(mergeClips(clips)).toBeNull();
  });

  test('returns null when gap exists between clips', () => {
    const clips = [
      createAudioClip({ id: 'c1', startTime: 0, duration: 4 }),
      createAudioClip({ id: 'c2', startTime: 6, duration: 4 }),
    ];
    expect(mergeClips(clips)).toBeNull();
  });

  test('returns the clip itself for single clip input', () => {
    const clip = createAudioClip();
    expect(mergeClips([clip])?.id).toBe(clip.id);
  });

  test('returns null for empty input', () => {
    expect(mergeClips([])).toBeNull();
  });
});

// ── Utility Operations ────────────────────────────────────────────────

describe('renameClip', () => {
  test('updates the clip name', () => {
    const clip = createAudioClip({ name: 'Old Name' });
    expect(renameClip(clip, 'New Name').name).toBe('New Name');
  });
});

describe('toggleClipMute', () => {
  test('toggles the muted flag', () => {
    expect(toggleClipMute(createAudioClip({ muted: false })).muted).toBe(true);
    expect(toggleClipMute(createAudioClip({ muted: true })).muted).toBe(false);
  });
});

describe('setClipColor', () => {
  test('sets the clip color', () => {
    expect(setClipColor(createAudioClip({ color: '#888' }), '#ff0').color).toBe('#ff0');
  });
});

// ── MIDI Operations ───────────────────────────────────────────────────

describe('transposeMidiClip', () => {
  test('transposes all notes by semitones', () => {
    const clip = createMidiClip();
    const transposed = transposeMidiClip(clip, 5);

    transposed.notes!.forEach(note => {
      expect(note.pitch).toBeGreaterThanOrEqual(0);
      expect(note.pitch).toBeLessThanOrEqual(127);
    });
    expect(transposed.notes![0].pitch).toBe(65);
    expect(transposed.notes![1].pitch).toBe(69);
  });

  test('clamps notes to valid MIDI range', () => {
    const clip = createMidiClip();
    clip.notes = [createMidiNote({ id: 'low', pitch: 3 })];
    const transposed = transposeMidiClip(clip, -5);
    expect(transposed.notes![0].pitch).toBe(0); // clamped
  });

  test('returns non-MIDI clips unchanged', () => {
    const clip = createAudioClip();
    expect(transposeMidiClip(clip, 5)).toBe(clip);
  });
});

describe('quantizeMidiClip', () => {
  test('snaps note starts to grid at full strength', () => {
    const clip = createMidiClip();
    // 0.4 / 0.25 = 1.6 → round(1.6) = 2 → 2 * 0.25 = 0.5
    clip.notes = [createMidiNote({ id: 'n1', start: 0.4 })];

    const quantized = quantizeMidiClip(clip, 0.25, 1.0);
    expect(quantized.notes![0].start).toBe(0.5);
  });

  test('partial strength moves note partway to grid', () => {
    const clip = createMidiClip();
    clip.notes = [createMidiNote({ id: 'n1', start: 0.3 })];

    const quantized = quantizeMidiClip(clip, 0.25, 0.5);
    // round(0.3/0.25)*0.25 = 0.25, diff = -0.05, 0.3 + (-0.05*0.5) = 0.275
    expect(quantized.notes![0].start).toBe(0.275);
  });

  test('returns non-MIDI clips unchanged', () => {
    const clip = createAudioClip();
    expect(quantizeMidiClip(clip, 0.25)).toBe(clip);
  });
});

describe('adjustMidiVelocity', () => {
  test('adds delta to all note velocities', () => {
    const clip = createMidiClip();
    clip.notes = [
      createMidiNote({ id: 'n1', velocity: 100 }),
      createMidiNote({ id: 'n2', velocity: 80 }),
      createMidiNote({ id: 'n3', velocity: 100 }),
    ];
    const adjusted = adjustMidiVelocity(clip, 10);

    expect(adjusted.notes![0].velocity).toBe(110);
    expect(adjusted.notes![1].velocity).toBe(90); // 80 + 10
  });

  test('clamps velocity to 1-127 range', () => {
    const clip = createMidiClip();
    clip.notes = [createMidiNote({ id: 'n1', velocity: 5 })];
    const adjusted = adjustMidiVelocity(clip, -10);
    expect(adjusted.notes![0].velocity).toBe(1);

    const clip2 = createMidiClip();
    clip2.notes = [createMidiNote({ id: 'n2', velocity: 120 })];
    const adjusted2 = adjustMidiVelocity(clip2, 20);
    expect(adjusted2.notes![0].velocity).toBe(127);
  });

  test('returns non-MIDI clips unchanged', () => {
    const clip = createAudioClip();
    expect(adjustMidiVelocity(clip, 10)).toBe(clip);
  });
});
