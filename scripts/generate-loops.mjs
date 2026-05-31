import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function writeWav(filePath, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  const dataLen = samples.length * 2;

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLen, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20);  // PCM
  buffer.writeUInt16LE(NUM_CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE / 8, 28);
  buffer.writeUInt16LE(NUM_CHANNELS * BITS_PER_SAMPLE / 8, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLen, 40);

  for (let i = 0; i < samples.length; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  console.log(`  Created: ${filePath} (${(dataLen / 1024).toFixed(0)}KB)`);
}

function sine(freq, t) {
  return Math.sin(2 * Math.PI * freq * t);
}

function envelope(t, attack, decay, sustain, release, dur) {
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - (1 - sustain) * ((t - attack) / decay);
  if (t < dur - release) return sustain;
  if (t < dur) return sustain * (1 - (t - (dur - release)) / release);
  return 0;
}

function drumKick(dur, freqStart, freqEnd) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const freq = freqStart + (freqEnd - freqStart) * (t / dur);
    const env = envelope(t, 0.002, 0.05, 0, 0.05, dur);
    out[i] = sine(freq, t) * env * 0.8 + (Math.random() * 2 - 1) * 0.1 * env;
  }
  return out;
}

function drumSnare(dur) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, 0.001, 0.08, 0.05, 0.05, dur);
    out[i] = sine(200, t) * env * 0.5 + (Math.random() * 2 - 1) * 0.6 * env;
  }
  return out;
}

function drumHihat(dur, open) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const rel = open ? 0.15 : 0.04;
    const env = envelope(t, 0.001, 0.01, 0, rel, dur);
    out[i] = (Math.random() * 2 - 1) * 0.4 * env;
  }
  return out;
}

function bassNote(freq, dur) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, 0.01, 0.1, 0.7, 0.1, dur);
    out[i] = (sine(freq, t) + sine(freq * 2, t) * 0.3) * env * 0.7;
  }
  return out;
}

function melodicNote(freq, dur) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, 0.02, 0.15, 0.6, 0.2, dur);
    out[i] = (sine(freq, t) * 0.5 + sine(freq * 3, t) * 0.2 + sine(freq * 5, t) * 0.1) * env * 0.5;
  }
  return out;
}

function buildDrumPattern(kickPos, snarePos, hatInterval, dur) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(len);
  const beatLen = SAMPLE_RATE / 4; // 16th note at 120bpm

  // Kick
  for (const pos of kickPos) {
    const start = Math.floor(pos * beatLen);
    const kick = drumKick(0.2, 150, 40);
    for (let i = 0; i < kick.length && start + i < len; i++) {
      out[start + i] += kick[i] * 0.7;
    }
  }

  // Snare
  for (const pos of snarePos) {
    const start = Math.floor(pos * beatLen);
    const snare = drumSnare(0.15);
    for (let i = 0; i < snare.length && start + i < len; i++) {
      out[start + i] += snare[i] * 0.6;
    }
  }

  // Hi-hat
  for (let pos = 0; pos < dur * 4; pos += hatInterval) {
    const start = Math.floor(pos * beatLen);
    const hihat = drumHihat(0.05, false);
    for (let i = 0; i < hihat.length && start + i < len; i++) {
      out[start + i] += hihat[i] * 0.3;
    }
  }

  // Normalize
  let max = 0;
  for (let i = 0; i < len; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 1) for (let i = 0; i < len; i++) out[i] /= max;

  return out;
}

const BPM = 120;
const BEATS = 4; // One bar
const DUR = (BEATS * 60) / BPM;

console.log('Generating drum loops...');

writeWav('public/audio/loops/drums/drums_house_01.wav',
  buildDrumPattern([0, 2], [1, 3], 0.5, DUR));

writeWav('public/audio/loops/drums/drums_house_02.wav',
  buildDrumPattern([0, 1.5, 3], [1, 2.5], 0.5, DUR));

writeWav('public/audio/loops/drums/drums_lofi_01.wav',
  buildDrumPattern([0, 3], [1.5], 1, DUR));

writeWav('public/audio/loops/drums/drums_lofi_02.wav',
  buildDrumPattern([0, 2, 3.5], [1, 3], 1, DUR));

writeWav('public/audio/loops/drums/drums_trap_01.wav',
  buildDrumPattern([0, 2, 2.75, 3.5], [1, 3], 0.5, DUR));

writeWav('public/audio/loops/drums/drums_trap_02.wav',
  buildDrumPattern([0, 1.75, 3, 3.75], [1, 2.75], 0.25, DUR));

writeWav('public/audio/loops/drums/drums_techno_01.wav',
  buildDrumPattern([0, 1, 2, 3], [1, 3], 0.25, DUR));

writeWav('public/audio/loops/drums/drums_techno_02.wav',
  buildDrumPattern([0, 0.75, 2, 2.75], [1, 3], 0.25, DUR));

writeWav('public/audio/loops/drums/drums_hiphop_01.wav',
  buildDrumPattern([0, 2.5, 3.5], [1, 3], 1, DUR));

writeWav('public/audio/loops/drums/drums_hiphop_02.wav',
  buildDrumPattern([0, 2, 3], [1.5, 3.5], 1, DUR));

writeWav('public/audio/loops/drums/drums_funk_01.wav',
  buildDrumPattern([0, 1.5, 2.5, 3.5], [1, 2, 3], 0.5, DUR));

writeWav('public/audio/loops/drums/drums_rock_01.wav',
  buildDrumPattern([0, 2], [1, 3], 0.5, DUR));

console.log('Generating bass loops...');

const bassNotes = [55, 55, 49, 55]; // A1, A1, D1, A1
writeWav('public/audio/loops/bass/bass_deep_01.wav', (() => {
  const len = Math.floor(SAMPLE_RATE * DUR);
  const out = new Float32Array(len);
  const noteDur = DUR / bassNotes.length;
  for (let n = 0; n < bassNotes.length; n++) {
    const start = Math.floor(n * noteDur * SAMPLE_RATE);
    const note = bassNote(bassNotes[n], noteDur);
    for (let i = 0; i < note.length && start + i < len; i++) {
      out[start + i] = note[i];
    }
  }
  return out;
})());

writeWav('public/audio/loops/bass/bass_deep_02.wav', (() => {
  const notes = [65.41, 65.41, 73.42, 65.41]; // C2, C2, D2, C2
  const len = Math.floor(SAMPLE_RATE * DUR);
  const out = new Float32Array(len);
  const noteDur = DUR / notes.length;
  for (let n = 0; n < notes.length; n++) {
    const start = Math.floor(n * noteDur * SAMPLE_RATE);
    const note = bassNote(notes[n], noteDur);
    for (let i = 0; i < note.length && start + i < len; i++) out[start + i] = note[i];
  }
  return out;
})());

writeWav('public/audio/loops/bass/bass_walking_01.wav', (() => {
  const notes = [55, 65.41, 73.42, 82.41, 55, 65.41, 73.42, 82.41];
  const len = Math.floor(SAMPLE_RATE * DUR);
  const out = new Float32Array(len);
  const noteDur = DUR / notes.length;
  for (let n = 0; n < notes.length; n++) {
    const start = Math.floor(n * noteDur * SAMPLE_RATE);
    const note = bassNote(notes[n], noteDur);
    for (let i = 0; i < note.length && start + i < len; i++) out[start + i] = note[i];
  }
  return out;
})());

writeWav('public/audio/loops/bass/bass_sub_01.wav', (() => {
  const notes = [49, 49, 55, 49, 49, 49, 55, 49];
  const len = Math.floor(SAMPLE_RATE * DUR);
  const out = new Float32Array(len);
  const noteDur = DUR / notes.length;
  for (let n = 0; n < notes.length; n++) {
    const start = Math.floor(n * noteDur * SAMPLE_RATE);
    const note = bassNote(notes[n], noteDur);
    for (let i = 0; i < note.length && start + i < len; i++) out[start + i] = note[i];
  }
  return out;
})());

writeWav('public/audio/loops/bass/bass_electro_01.wav', (() => {
  const notes = [65.41, 73.42, 65.41, 82.41, 65.41, 73.42, 65.41, 97.99];
  const len = Math.floor(SAMPLE_RATE * DUR);
  const out = new Float32Array(len);
  const noteDur = DUR / notes.length;
  for (let n = 0; n < notes.length; n++) {
    const start = Math.floor(n * noteDur * SAMPLE_RATE);
    const note = bassNote(notes[n], noteDur);
    for (let i = 0; i < note.length && start + i < len; i++) out[start + i] = note[i];
  }
  return out;
})());

console.log('Generating melodic loops...');

writeWav('public/audio/loops/melodic/melodic_keys_01.wav', (() => {
  const chords = [
    [261.63, 329.63, 392.00], // C4 E4 G4
    [261.63, 329.63, 392.00],
    [220.00, 277.18, 349.23], // A3 C#4 F4
    [261.63, 329.63, 392.00],
  ];
  const len = Math.floor(SAMPLE_RATE * DUR);
  const out = new Float32Array(len);
  const chordDur = DUR / chords.length;
  for (let c = 0; c < chords.length; c++) {
    const start = Math.floor(c * chordDur * SAMPLE_RATE);
    for (let n = 0; n < chords[c].length; n++) {
      const note = melodicNote(chords[c][n], chordDur);
      for (let i = 0; i < note.length && start + i < len; i++) {
        out[start + i] += note[i] * 0.5;
      }
    }
  }
  let max = 0;
  for (let i = 0; i < len; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 1) for (let i = 0; i < len; i++) out[i] /= max;
  return out;
})());

writeWav('public/audio/loops/melodic/melodic_keys_02.wav', (() => {
  const melody = [
    440, 440, 493.88, 523.25, 493.88, 440, 392, 440,
    440, 440, 493.88, 523.25, 493.88, 440, 392, 440,
  ];
  const len = Math.floor(SAMPLE_RATE * DUR);
  const out = new Float32Array(len);
  const noteDur = DUR / melody.length;
  for (let n = 0; n < melody.length; n++) {
    const start = Math.floor(n * noteDur * SAMPLE_RATE);
    const note = melodicNote(melody[n], noteDur);
    for (let i = 0; i < note.length && start + i < len; i++) out[start + i] = note[i] * 0.6;
  }
  return out;
})());

writeWav('public/audio/loops/melodic/melodic_guitar_01.wav', (() => {
  const melody = [
    392, 392, 440, 392, 523.25, 587.33, 523.25, 440,
    392, 392, 440, 392, 587.33, 523.25, 440, 392,
  ];
  const len = Math.floor(SAMPLE_RATE * DUR);
  const out = new Float32Array(len);
  const noteDur = DUR / melody.length;
  for (let n = 0; n < melody.length; n++) {
    const start = Math.floor(n * noteDur * SAMPLE_RATE);
    const note = melodicNote(melody[n], noteDur);
    for (let i = 0; i < note.length && start + i < len; i++) out[start + i] = note[i] * 0.45;
  }
  return out;
})());

writeWav('public/audio/loops/melodic/melodic_strings_01.wav', (() => {
  const chords = [
    [261.63, 329.63, 392.00, 523.25],
    [293.66, 369.99, 440.00, 587.33],
    [329.63, 415.30, 493.88, 659.25],
    [261.63, 329.63, 392.00, 523.25],
  ];
  const len = Math.floor(SAMPLE_RATE * DUR);
  const out = new Float32Array(len);
  const chordDur = DUR / chords.length;
  for (let c = 0; c < chords.length; c++) {
    const start = Math.floor(c * chordDur * SAMPLE_RATE);
    for (let n = 0; n < chords[c].length; n++) {
      const note = melodicNote(chords[c][n], chordDur);
      for (let i = 0; i < note.length && start + i < len; i++) {
        out[start + i] += note[i] * 0.35;
      }
    }
  }
  let max = 0;
  for (let i = 0; i < len; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 1) for (let i = 0; i < len; i++) out[i] /= max;
  return out;
})());

writeWav('public/audio/loops/melodic/melodic_ambient_01.wav', (() => {
  const pad = [
    [261.63, 392.00, 523.25],
    [261.63, 392.00, 523.25],
    [220.00, 349.23, 440.00],
    [261.63, 392.00, 523.25],
  ];
  const len = Math.floor(SAMPLE_RATE * DUR * 2); // 2 bars
  const out = new Float32Array(len);
  const chordDur = DUR * 2 / pad.length;
  for (let c = 0; c < pad.length; c++) {
    const start = Math.floor(c * chordDur * SAMPLE_RATE);
    for (let n = 0; n < pad[c].length; n++) {
      const note = melodicNote(pad[c][n], chordDur);
      for (let i = 0; i < note.length && start + i < len; i++) {
        out[start + i] += note[i] * 0.25;
      }
    }
  }
  let max = 0;
  for (let i = 0; i < len; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 1) for (let i = 0; i < len; i++) out[i] /= max;
  return out;
})());

console.log('\nDone! Generated 22 loop WAV files.');
