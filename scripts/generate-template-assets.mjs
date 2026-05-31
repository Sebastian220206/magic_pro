import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public/audio/templates');

const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function writeWav(filePath, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  const dataLen = samples.length * 2;
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLen, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
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
  console.log(`  ${path.basename(filePath)}  ${(dataLen / 1024).toFixed(0)}KB`);
}

function sine(freq, t) { return Math.sin(2 * Math.PI * freq * t); }
function sqr(freq, t) { return Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1; }
function saw(freq, t) { return 2 * ((freq * t) % 1) - 1; }
function noise() { return Math.random() * 2 - 1; }

function env(t, a, d, s, r, dur) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur - r) return s;
  if (t < dur) return s * (1 - (t - (dur - r)) / r);
  return 0;
}

function makeBeat(samples, bpm, pattern, fns) {
  const beatLen = Math.floor(SAMPLE_RATE * 60 / bpm);
  const totalBeats = pattern.length;
  const out = new Float32Array(totalBeats * beatLen);
  for (let b = 0; b < totalBeats; b++) {
    const hits = pattern[b];
    for (const h of hits) {
      const [fnIdx, subdiv] = h;
      const offset = Math.floor(beatLen * subdiv);
      const hit = fns[fnIdx];
      for (let i = 0; i < hit.length && offset + i < out.length; i++) {
        out[offset + i] += hit[i];
      }
    }
  }
  let max = 1;
  for (let i = 0; i < out.length; i++) {
    const a = Math.abs(out[i]);
    if (a > max) max = a;
  }
  for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
}

function kick(dur) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const o = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const e = env(t, 0.002, 0.06, 0, 0.04, dur);
    o[i] = sine(80 + 120 * (1 - t / dur), t) * e * 0.9 + noise() * 0.08 * e;
  }
  return o;
}

function snare(dur) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const o = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const e = env(t, 0.001, 0.06, 0.04, 0.04, dur);
    o[i] = sine(180, t) * e * 0.4 + noise() * 0.7 * e;
  }
  return o;
}

function clap(dur) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const o = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const e = env(t, 0.001, 0.04, 0, 0.06, dur);
    o[i] = noise() * 0.6 * e + sine(250, t) * 0.2 * e;
  }
  return o;
}

function hihat(dur) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const o = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const e = env(t, 0.001, 0.01, 0, 0.03, dur);
    o[i] = noise() * 0.35 * e;
  }
  return o;
}

function ride(dur) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const o = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const e = env(t, 0.001, 0.01, 0.3, 0.08, dur);
    o[i] = noise() * 0.25 * e + sine(800, t) * 0.15 * e;
  }
  return o;
}

function padNote(freq, dur, shape) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const o = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const e = env(t, 0.1, 0.3, 0.7, 0.5, dur);
    const detune = freq * 1.003;
    let s = 0;
    if (shape === 'saw') s = saw(freq, t) * 0.3 + saw(freq / 2, t) * 0.1;
    else if (shape === 'sqr') s = sqr(freq, t) * 0.2 + sqr(freq * 1.01, t) * 0.15;
    else s = sine(freq, t) * 0.3 + sine(detune, t) * 0.2;
    o[i] = s * e;
  }
  return o;
}

function chord(notes, dur, shape) {
  const parts = notes.map(f => padNote(f, dur, shape));
  const len = parts[0].length;
  const mix = new Float32Array(len);
  for (const p of parts) {
    for (let i = 0; i < len; i++) mix[i] += p[i];
  }
  let m = 1;
  for (let i = 0; i < len; i++) { const a = Math.abs(mix[i]); if (a > m) m = a; }
  for (let i = 0; i < len; i++) mix[i] /= m;
  return mix;
}

function riserSweep(dur, startFreq, endFreq) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const o = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const p = t / dur;
    const e = env(t, 0, 0, 1, 0.05, dur);
    const f = startFreq + (endFreq - startFreq) * (p * p);
    o[i] = (saw(f, t) * 0.15 + noise() * 0.2) * e * (0.3 + 0.7 * p);
  }
  let mx = 1;
  for (let i = 0; i < len; i++) { const a = Math.abs(o[i]); if (a > mx) mx = a; }
  for (let i = 0; i < len; i++) o[i] /= mx;
  return o;
}

function noiseBurst(dur, amount) {
  const len = Math.floor(SAMPLE_RATE * dur);
  const o = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const e = env(t, 0.01, 0.05, 0.1, 0.1, dur);
    o[i] = noise() * amount * e;
  }
  return o;
}

// ── LO-FI ─────────────────────────────────────────────────
console.log('\nLo-fi Beat:');

// Lofi drums — 78 BPM, 2 bars (8 beats), kick/snare/hihat
{
  const bpm = 78;
  const k = kick(0.25);
  const s = snare(0.2);
  const h = hihat(0.06);
  const r = ride(0.15);
  const pattern = [
    [[0, 0], [2, 0.5]],   // beat 0: kick(0), hihat(0.5)
    [[2, 0]],               // beat 1: hihat(0)
    [[2, 0.5]],             // beat 1.5: hihat(0.5)
    [[1, 0], [2, 0.5]],    // beat 2: snare(0), hihat(0.5)
    [[2, 0.5]],             // beat 2.5: hihat(0.5)
    [[2, 0]],               // beat 3: hihat(0)
    [[0, 0], [2, 0.75]],   // beat 4: kick(0), hihat(0.75)
    [[2, 0.5]],             // beat 4.5: hihat(0.5)
    [[2, 0]],               // beat 5: hihat(0)
    [[1, 0], [2, 0.5]],    // beat 6: snare(0), hihat(0.5)
    [[3, 0.25]],            // beat 6.25: ride(0.25)
    [[2, 0.5]],             // beat 6.5: hihat(0.5)
    [[2, 0]],               // beat 7: hihat(0)
    [[0, 0], [3, 0.5]],    // beat 8: kick(0), ride(0.5)
  ];
  const beat = makeBeat(SAMPLE_RATE, bpm, pattern, [k, s, h, r]);
  writeWav(path.join(OUT, 'lofi/drums.wav'), beat);
}

// Lofi atmosphere — Cmaj7 pad, 2 bars
{
  const dur = 16 * 60 / 78; // seconds for 16 beats at 78 BPM
  const c = chord([261.63, 329.63, 392.00, 493.88], dur, 'saw');
  writeWav(path.join(OUT, 'lofi/atmosphere.wav'), c);
}

// Vinyl noise
{
  const dur = 2;
  const n = noiseBurst(dur, 0.15);
  writeWav(path.join(OUT, 'lofi/vinyl.wav'), n);
}

// ── PODCAST ────────────────────────────────────────────────
console.log('Podcast:');
// Short silence placeholder for voice track
{
  const dur = 0.25;
  const silent = new Float32Array(Math.floor(SAMPLE_RATE * dur));
  writeWav(path.join(OUT, 'podcast/voice_placeholder.wav'), silent);
}

// ── EDM ────────────────────────────────────────────────────
console.log('EDM:');

// EDM drums — 126 BPM, 4 beats, kick/clap/hihat
{
  const bpm = 126;
  const k = kick(0.3);
  const c = clap(0.2);
  const h = hihat(0.05);
  const r = ride(0.2);
  const pattern = [
    [[0, 0], [2, 0.5]],             // 1: kick, hihat +
    [[2, 0.25], [2, 0.75]],         // 1+ hihat x2
    [[1, 0], [2, 0.5]],             // 2: clap, hihat +
    [[2, 0.25], [2, 0.75]],         // 2+ hihat x2
    [[0, 0], [2, 0.5]],             // 3: kick, hihat +
    [[2, 0.25], [2, 0.75]],         // 3+ hihat x2
    [[1, 0], [2, 0.5], [3, 0.75]], // 4: clap, hihat +, ride
    [[2, 0.25], [3, 0.25]],         // 4+ hihat + ride
  ];
  const beat = makeBeat(SAMPLE_RATE, bpm, pattern, [k, c, h, r]);
  writeWav(path.join(OUT, 'edm/drums.wav'), beat);
}

// EDM riser — 2 beats
{
  const dur = 2 * 60 / 126; // 2 beats at 126 BPM ≈ 0.95s
  const r = riserSweep(dur, 100, 2000);
  writeWav(path.join(OUT, 'edm/riser.wav'), r);
}

console.log('\nDone — all template assets generated.\n');
