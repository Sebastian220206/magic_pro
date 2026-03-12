/* ═══════════════════════════════════════════════════════════
   SoundForge Studio — Global State Store
   ═══════════════════════════════════════════════════════════ */

const DAWStore = (() => {
  // ── Track Color Palette (Logic Pro X) ──
  const COLORS = [
    '#5B7FFF', '#8B6835', '#C4A034', '#6AAB2E',
    '#3EB59A', '#C74D8F', '#B25CDE', '#E06040',
    '#42A5D4', '#E0C040', '#D44E5C', '#6C6CE0',
    '#50B060', '#D87028'
  ];

  // ── Scale Definitions (semitone intervals from root) ──
  const SCALES = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10]
  };

  // ── Chord Definitions (semitone offsets from root) ──
  const CHORDS = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
    sus4: [0, 5, 7],
    sus2: [0, 2, 7]
  };

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // ── Initial State ──
  const state = {
    // Transport
    isPlaying: false,
    isRecording: false,
    loopEnabled: false,
    metronomeEnabled: false,
    bpm: 142,
    timeSignature: '4/4',
    currentBeat: 0,  // in beats
    loopStart: 4,
    loopEnd: 20,

    // Editor
    zoom: 40,          // pixels per beat
    scrollX: 0,
    scrollY: 0,
    snapValue: 0.25,   // quarter note
    selectedTrackId: null,
    selectedTool: 'select',  // 'select', 'draw', 'erase'

    // Piano Roll
    scale: 'major',
    rootNote: 0,  // C
    quantize: 0.25,
    snapToScale: true,

    // Tracks
    tracks: [],
    // Notes (piano roll)
    notes: [],

    // Playback timer
    _playTimer: null,
    _lastTime: 0,
  };

  // ── Demo Tracks ──
  function initDemoData() {
    state.tracks = [
      {
        id: 'trk-1', name: '808', type: 'audio', color: COLORS[0], volume: 0.85, pan: 0, muted: false, solo: false, recArmed: true,
        clips: [
          { id: 'c1a', name: 'Default', startBeat: 0, durationBeats: 16, color: COLORS[0], type: 'audio', waveform: null },
          { id: 'c1b', name: 'Default', startBeat: 24, durationBeats: 16, color: COLORS[0], type: 'audio', waveform: null },
          { id: 'c1c', name: 'Default', startBeat: 48, durationBeats: 16, color: COLORS[0], type: 'audio', waveform: null },
          { id: 'c1d', name: 'Default', startBeat: 80, durationBeats: 16, color: COLORS[0], type: 'audio', waveform: null },
        ], inserts: ['Alchemy', 'Channel EQ', 'L3 UltraMaximizer', 'Distortion'], sends: [0.3, 0], automation: []
      },
      {
        id: 'trk-2', name: 'KICK', type: 'audio', color: COLORS[1], volume: 0.8, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c2a', name: 'Graves_kick merged', startBeat: 0, durationBeats: 32, color: COLORS[1], type: 'audio', waveform: null },
          { id: 'c2b', name: 'Graves_kick merged_09.2', startBeat: 32, durationBeats: 16, color: COLORS[1], type: 'audio', waveform: null },
          { id: 'c2c', name: 'Graves_kick merged', startBeat: 64, durationBeats: 16, color: COLORS[1], type: 'audio', waveform: null },
          { id: 'c2d', name: 'Graves_kick merged_09.5', startBeat: 88, durationBeats: 16, color: COLORS[1], type: 'audio', waveform: null },
        ], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-3', name: 'SN LO', type: 'audio', color: COLORS[2], volume: 0.75, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c3a', name: 'ForeignTeck (Snare)', startBeat: 0, durationBeats: 16, color: COLORS[2], type: 'audio', waveform: null },
          { id: 'c3b', name: 'ForeignTeck (Snare)-24b', startBeat: 16, durationBeats: 16, color: COLORS[2], type: 'audio', waveform: null },
          { id: 'c3c', name: 'ForeignTeck (Snare)', startBeat: 48, durationBeats: 16, color: COLORS[2], type: 'audio', waveform: null },
          { id: 'c3d', name: 'ForeignTeck (Snare)-24b', startBeat: 80, durationBeats: 16, color: COLORS[2], type: 'audio', waveform: null },
        ], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-4', name: 'SN HI', type: 'audio', color: COLORS[3], volume: 0.72, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c4a', name: 'SONNY_D_snare', startBeat: 0, durationBeats: 16, color: COLORS[3], type: 'audio', waveform: null },
          { id: 'c4b', name: 'SONNY_D_snare merged_16.1', startBeat: 24, durationBeats: 12, color: COLORS[3], type: 'audio', waveform: null },
          { id: 'c4c', name: 'SONNY_D_snare', startBeat: 48, durationBeats: 12, color: COLORS[3], type: 'audio', waveform: null },
          { id: 'c4d', name: 'SONNY_D_snare merged_16.4', startBeat: 80, durationBeats: 16, color: COLORS[3], type: 'audio', waveform: null },
        ], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-5', name: 'CLAP', type: 'audio', color: COLORS[4], volume: 0.7, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c5a', name: 'Chunez (', startBeat: 0, durationBeats: 8, color: COLORS[4], type: 'audio', waveform: null },
          { id: 'c5b', name: 'Chunez (Clap)-24b', startBeat: 16, durationBeats: 16, color: COLORS[4], type: 'audio', waveform: null },
          { id: 'c5c', name: 'Chunez (Clap)', startBeat: 48, durationBeats: 16, color: COLORS[4], type: 'audio', waveform: null },
          { id: 'c5d', name: 'Chunez (Clap)-24b', startBeat: 80, durationBeats: 16, color: COLORS[4], type: 'audio', waveform: null },
        ], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-6', name: 'HH', type: 'audio', color: COLORS[5], volume: 0.68, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c6a', name: 'HiHat (Killinit)-24b', startBeat: 0, durationBeats: 16, color: COLORS[5], type: 'audio', waveform: null },
          { id: 'c6b', name: 'HiHat (KilIniti)-24b', startBeat: 16, durationBeats: 16, color: COLORS[5], type: 'audio', waveform: null },
          { id: 'c6c', name: 'HiHat (Killinit)-24b', startBeat: 48, durationBeats: 16, color: COLORS[5], type: 'audio', waveform: null },
          { id: 'c6d', name: 'HiHat (Killinit)-24b merged', startBeat: 80, durationBeats: 24, color: COLORS[5], type: 'audio', waveform: null },
        ], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-7', name: 'FX', type: 'audio', color: COLORS[6], volume: 0.6, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c7a', name: '2Lies (FX)', startBeat: 16, durationBeats: 8, color: COLORS[6], type: 'audio', waveform: null },
          { id: 'c7b', name: '2Lies (FX)-24b.2', startBeat: 32, durationBeats: 8, color: COLORS[6], type: 'audio', waveform: null },
          { id: 'c7c', name: '2Lies (FX)-24b.3', startBeat: 48, durationBeats: 8, color: COLORS[6], type: 'audio', waveform: null },
          { id: 'c7d', name: '2Lies (FX)-24b.4 (1)', startBeat: 64, durationBeats: 8, color: COLORS[6], type: 'audio', waveform: null },
        ], inserts: ['', '', '', ''], sends: [0.5, 0], automation: []
      },
      {
        id: 'trk-8', name: 'BELLS C HI', type: 'midi', color: COLORS[7], volume: 0.65, pan: 0.1, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c8a', name: 'BELLS', startBeat: 0, durationBeats: 8, color: COLORS[7], type: 'midi', notes: [] },
          { id: 'c8b', name: 'BEL', startBeat: 16, durationBeats: 8, color: COLORS[7], type: 'midi', notes: [] },
          { id: 'c8c', name: 'BEL', startBeat: 32, durationBeats: 8, color: COLORS[7], type: 'midi', notes: [] },
          { id: 'c8d', name: 'BEL', startBeat: 48, durationBeats: 8, color: COLORS[7], type: 'midi', notes: [] },
          { id: 'c8e', name: 'BEL', startBeat: 64, durationBeats: 8, color: COLORS[7], type: 'midi', notes: [] },
          { id: 'c8f', name: 'BEL', startBeat: 80, durationBeats: 8, color: COLORS[7], type: 'midi', notes: [] },
          { id: 'c8g', name: 'BEL', startBeat: 96, durationBeats: 8, color: COLORS[7], type: 'midi', notes: [] },
        ], inserts: ['', '', '', ''], sends: [0, 0.3], automation: []
      },
      {
        id: 'trk-9', name: 'BELLS C LO', type: 'audio', color: COLORS[8], volume: 0.7, pan: -0.1, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c9a', name: '808Mar', startBeat: 0, durationBeats: 4, color: COLORS[8], type: 'audio', waveform: null },
          { id: 'c9b', name: '808Mar', startBeat: 8, durationBeats: 4, color: COLORS[8], type: 'audio', waveform: null },
          { id: 'c9c', name: '808Mar', startBeat: 16, durationBeats: 4, color: COLORS[8], type: 'audio', waveform: null },
          { id: 'c9d', name: '808Mar_x_Southsid', startBeat: 32, durationBeats: 8, color: COLORS[8], type: 'audio', waveform: null },
          { id: 'c9e', name: '808Mar_x_Southside_134_BPM', startBeat: 80, durationBeats: 24, color: COLORS[8], type: 'audio', waveform: null },
        ], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-10', name: 'LOOP HI', type: 'audio', color: COLORS[9], volume: 0.6, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c10a', name: 'Loop Hi', startBeat: 0, durationBeats: 12, color: COLORS[9], type: 'audio', waveform: null },
          { id: 'c10b', name: 'Loop Hi Var', startBeat: 32, durationBeats: 12, color: COLORS[9], type: 'audio', waveform: null },
        ], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-11', name: 'LOOP HI TAPE STOP', type: 'audio', color: COLORS[10], volume: 0.55, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-12', name: 'LOOP LO', type: 'audio', color: COLORS[11], volume: 0.5, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [
          { id: 'c12a', name: '808 808', startBeat: 0, durationBeats: 8, color: COLORS[11], type: 'audio', waveform: null },
          { id: 'c12b', name: '808Maf', startBeat: 16, durationBeats: 8, color: COLORS[11], type: 'audio', waveform: null },
          { id: 'c12c', name: '808Maf_x_Southsid', startBeat: 48, durationBeats: 16, color: COLORS[11], type: 'audio', waveform: null },
          { id: 'c12d', name: '808Maf', startBeat: 80, durationBeats: 8, color: COLORS[11], type: 'audio', waveform: null },
          { id: 'c12e', name: '808Maf_x_Southsid', startBeat: 96, durationBeats: 12, color: COLORS[11], type: 'audio', waveform: null },
        ], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-13', name: 'Audio 10', type: 'audio', color: COLORS[12], volume: 0.65, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
      {
        id: 'trk-14', name: 'Stereo Out', type: 'audio', color: COLORS[13], volume: 0.9, pan: 0, muted: false, solo: false, recArmed: false,
        clips: [], inserts: ['', '', '', ''], sends: [0, 0], automation: []
      },
    ];

    // Generate waveform data for audio clips
    state.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.type === 'audio') {
          clip.waveform = WaveformUtil.generatePeaks(200);
        }
        if (clip.type === 'midi' && (!clip.notes || clip.notes.length === 0)) {
          clip.notes = generateDemoMidiNotes(clip, track);
        }
      });
    });

    // Generate piano roll notes from the first MIDI track's first clip
    const midiTrack = state.tracks.find(t => t.type === 'midi');
    if (midiTrack && midiTrack.clips.length > 0) {
      state.notes = midiTrack.clips[0].notes || [];
      state.selectedTrackId = midiTrack.id;
    }
  }

  function generateDemoMidiNotes(clip, track) {
    const notes = [];
    const scaleNotes = SCALES.major;
    const baseNote = 60; // middle C
    const numNotes = Math.floor(clip.durationBeats / 0.5);

    for (let i = 0; i < numNotes; i++) {
      const scaleIdx = Math.floor(Math.random() * scaleNotes.length);
      const octaveShift = Math.floor(Math.random() * 2) * 12;
      const pitch = baseNote + scaleNotes[scaleIdx] + octaveShift - 12;
      const startBeat = clip.startBeat + i * 0.5;
      const duration = [0.25, 0.5, 1.0][Math.floor(Math.random() * 3)];
      const velocity = 60 + Math.floor(Math.random() * 67);

      notes.push({
        id: `note-${clip.id}-${i}`,
        pitch: Math.max(36, Math.min(96, pitch)),
        startBeat,
        duration,
        velocity,
        color: track.color
      });
    }
    return notes;
  }

  // ── Listeners ──
  const listeners = new Set();

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify(changed) {
    listeners.forEach(fn => fn(state, changed));
  }

  // ── Actions ──
  function set(key, value) {
    state[key] = value;
    notify(key);
  }

  function togglePlay() {
    state.isPlaying = !state.isPlaying;
    notify('isPlaying');
  }

  function toggleRecord() {
    state.isRecording = !state.isRecording;
    if (state.isRecording && !state.isPlaying) {
      state.isPlaying = true;
      notify('isPlaying');
    }
    notify('isRecording');
  }

  function toggleLoop() {
    state.loopEnabled = !state.loopEnabled;
    notify('loopEnabled');
  }

  function toggleMetronome() {
    state.metronomeEnabled = !state.metronomeEnabled;
    notify('metronomeEnabled');
  }

  function stop() {
    state.isPlaying = false;
    state.isRecording = false;
    state.currentBeat = 0;
    notify('isPlaying');
    notify('isRecording');
    notify('currentBeat');
  }

  function rewind() {
    state.currentBeat = 0;
    notify('currentBeat');
  }

  function toggleTrackMute(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) { track.muted = !track.muted; notify('tracks'); }
  }

  function toggleTrackSolo(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) { track.solo = !track.solo; notify('tracks'); }
  }

  function toggleTrackRec(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) { track.recArmed = !track.recArmed; notify('tracks'); }
  }

  function setTrackVolume(trackId, vol) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) { track.volume = vol; notify('tracks'); }
  }

  function setTrackPan(trackId, pan) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) { track.pan = pan; notify('tracks'); }
  }

  function selectTrack(trackId) {
    state.selectedTrackId = trackId;
    // Load notes from first MIDI clip of selected track
    const track = state.tracks.find(t => t.id === trackId);
    if (track && track.type === 'midi' && track.clips.length > 0) {
      state.notes = track.clips[0].notes || [];
    }
    notify('selectedTrackId');
  }

  function addNote(note) {
    state.notes.push(note);
    notify('notes');
  }

  function removeNote(noteId) {
    state.notes = state.notes.filter(n => n.id !== noteId);
    notify('notes');
  }

  function generateChord(root, type, octave, startBeat) {
    const intervals = CHORDS[type] || CHORDS.major;
    const baseNote = root + (octave * 12) + 12;
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    const color = track ? track.color : COLORS[0];

    intervals.forEach((interval, i) => {
      state.notes.push({
        id: `note-chord-${Date.now()}-${i}`,
        pitch: baseNote + interval,
        startBeat: startBeat,
        duration: 2,
        velocity: 90,
        color
      });
    });
    notify('notes');
  }

  function generateMelody(numNotes = 8) {
    const scale = SCALES[state.scale] || SCALES.major;
    const root = state.rootNote;
    const startBeat = state.currentBeat;
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    const color = track ? track.color : COLORS[0];

    let prevPitch = 60 + root;
    for (let i = 0; i < numNotes; i++) {
      const scaleIdx = Math.floor(Math.random() * scale.length);
      const octave = Math.floor(Math.random() * 2) * 12;
      const pitch = 48 + root + scale[scaleIdx] + octave;
      const duration = [0.25, 0.5, 0.5, 1.0][Math.floor(Math.random() * 4)];

      state.notes.push({
        id: `note-mel-${Date.now()}-${i}`,
        pitch,
        startBeat: startBeat + i * 0.5,
        duration,
        velocity: 70 + Math.floor(Math.random() * 50),
        color
      });
      prevPitch = pitch;
    }
    notify('notes');
  }

  function humanizeNotes() {
    state.notes.forEach(note => {
      note.startBeat += (Math.random() - 0.5) * 0.06;
      note.velocity = Math.min(127, Math.max(20, note.velocity + Math.floor((Math.random() - 0.5) * 20)));
      note.duration *= 0.9 + Math.random() * 0.2;
    });
    notify('notes');
  }

  return {
    state, COLORS, SCALES, CHORDS, NOTE_NAMES,
    initDemoData, subscribe, set,
    togglePlay, toggleRecord, toggleLoop, toggleMetronome,
    stop, rewind,
    toggleTrackMute, toggleTrackSolo, toggleTrackRec,
    setTrackVolume, setTrackPan, selectTrack,
    addNote, removeNote,
    generateChord, generateMelody, humanizeNotes
  };
})();
