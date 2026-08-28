/**
 * Does the audio recording pipeline capture anything at all?
 *
 * Chrome's fake capture device emits a steady tone, so the samples that reach
 * the recorder are known-good and non-silent. Anything zero after this is the
 * app's own doing, not the hardware's. The take is driven by clicking the
 * transport's record button rather than by calling `startRecording`, because
 * the interesting failures are in the wiring between the two.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({
    args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--allow-file-access-from-files',
    ],
});
const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    permissions: ['microphone'],
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));
page.on('console', m => {
    const t = m.text();
    if (/AudioRecorder|Recording|RecordingEngine|worklet/i.test(t)) console.log('  [log]', t.slice(0, 170));
});

const results = [];
const check = (name, pass, detail = '') => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('magicPro_tutorial', 'completed'));
await page.goto(`${BASE}/login`);
// The form posts through React. Clicking before hydration submits it natively
// and lands back on /login?, which looks exactly like a rejected password.
await page.waitForTimeout(9000);
for (let attempt = 0; attempt < 4; attempt++) {
    await page.fill('input[type="email"]', 'dev@example.com');
    await page.fill('input[type="password"]', 'devpassword123');
    await page.click('button[type="submit"]');
    try {
        await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });
        break;
    } catch {
        console.log(`  [login] attempt ${attempt + 1} stayed on ${page.url()}, retrying`);
        await page.waitForTimeout(4000);
    }
}
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'New Project' }).first().click();
await page.waitForTimeout(2200);
await page.getByRole('button', { name: /Blank Project/i }).first().click();
await page.waitForURL('**/project/**', { timeout: 60000 });
await page.waitForFunction(() => (window.__projectStore?.getState()?.tracks?.length ?? 0) > 0, null, { timeout: 60000 });
await page.waitForTimeout(3500);

// ── The browser can see the fake input ────────────────────────────────────
const devices = await page.evaluate(async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    return list.filter(d => d.kind === 'audioinput').map(d => ({ id: d.deviceId, label: d.label }));
});
check('an input device is visible to the page', devices.length > 0,
    devices.map(d => d.label || d.id).join(', '));

// ── Arm an audio track, the way the UI does ───────────────────────────────
// A blank project has no audio track, and `beginAudioCapture` returns early
// when it finds none — so without this the recorder is never even constructed.
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    if (!st.tracks.some(t => t.type === 'audio')) {
        st.addTrack({ name: 'Probe Audio', type: 'audio' });
    }
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const audio = st.tracks.find(t => t.type === 'audio');
    if (audio) {
        st.toggleRecordEnable(audio.id);
        st.toggleInputMonitoring(audio.id);
        st.setFocusedTrack?.(audio.id);
    }
    return audio?.id;
});
await page.waitForTimeout(500);
const armed = await page.evaluate(() => {
    const t = window.__projectStore.getState().tracks.find(t => t.type === 'audio');
    return { id: t?.id, rec: t?.recordEnabled, mon: t?.inputMonitoring };
});
check('an audio track is armed and monitoring', !!armed.rec && !!armed.mon,
    `${armed.id} rec=${armed.rec} mon=${armed.mon}`);

// ── Input monitoring: is the monitor path actually open? ──────────────────
// The recorder builds a `monitorGain` and connects it to the destination, but
// its gain is set from `isMonitoring`, which only `setMonitoring()` changes.
const monBefore = await page.evaluate(() => {
    const r = window.__audioRecorder;
    return r ? { gain: r.monitorGain?.gain?.value ?? null, armed: r.isArmed } : 'no handle';
});
console.log('  monitor gain before record:', JSON.stringify(monBefore));

// ── Record for two seconds, by clicking ───────────────────────────────────
const clipsBefore = await page.evaluate(() => window.__projectStore.getState().clips.length);
await page.click('button[title="Record (R)"]');
await page.waitForTimeout(600);
const recState = await page.evaluate(() => ({
    recording: window.__projectStore.getState().recording,
    error: window.__projectStore.getState().recordingError,
}));
check('the transport enters record', recState.recording === true,
    recState.error ? `error: ${recState.error}` : 'rolling');

const monDuring = await page.evaluate(() => {
    const r = window.__audioRecorder;
    return r ? { gain: r.monitorGain?.gain?.value ?? null, state: r.state } : 'no handle';
});
console.log('  monitor gain during record:', JSON.stringify(monDuring));

await page.waitForTimeout(2500);

const captured = await page.evaluate(() => {
    const r = window.__audioRecorder;
    return r ? { samples: r.totalSamplesRecorded, peak: r.maxAmplitude, state: r.state } : 'no handle';
});
check('samples are reaching the recorder',
    typeof captured === 'object' && captured.samples > 0,
    typeof captured === 'object' ? `${captured.samples} samples` : String(captured));
check('and they are not silence',
    typeof captured === 'object' && captured.peak > 0.001,
    typeof captured === 'object' ? `peak ${captured.peak?.toFixed(4)}` : String(captured));

await page.click('button[title="Record (R)"]');
await page.waitForTimeout(2500);

// ── A clip with a waveform ────────────────────────────────────────────────
const after = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const newest = st.clips[st.clips.length - 1];
    return {
        count: st.clips.length,
        clip: newest ? {
            name: newest.name, type: newest.type, duration: newest.duration,
            // WaveformSVG reads channels[0].min/max — not a flat `peaks` array.
            peaks: newest.waveformPeaks?.channels?.[0]?.min?.length ?? 0,
            peakValue: (() => {
                const mx = newest.waveformPeaks?.channels?.[0]?.max;
                if (!mx) return 0;
                let p = 0;
                for (let i = 0; i < mx.length; i++) if (mx[i] > p) p = mx[i];
                return Math.round(p * 1000) / 1000;
            })(),
        } : null,
        error: st.recordingError,
    };
});
check('a clip was added to the timeline', after.count > clipsBefore,
    `${clipsBefore} -> ${after.count}${after.error ? ` (error: ${after.error})` : ''}`);
check('the clip has a duration', (after.clip?.duration ?? 0) > 0,
    JSON.stringify(after.clip));
check('the clip has waveform data', (after.clip?.peaks ?? 0) > 0,
    `${after.clip?.peaks ?? 0} peaks`);
check('the waveform is not a flat line', (after.clip?.peakValue ?? 0) > 0.01,
    `peak ${after.clip?.peakValue}`);

// ── And the timeline actually draws it ────────────────────────────────────
await page.waitForTimeout(1200);
const drawn = await page.evaluate(() => {
    // The placeholder squiggle WaveformSVG falls back to has a fixed first
    // path; a real waveform is a long run of M/L pairs.
    const paths = [...document.querySelectorAll('svg[viewBox="0 0 100 40"] path')];
    const real = paths.filter(p => (p.getAttribute('d') ?? '').split('M').length > 50);
    return { total: paths.length, real: real.length,
             sample: real[0]?.getAttribute('d')?.slice(0, 40) ?? '' };
});
check('the timeline draws a real waveform, not the placeholder', drawn.real > 0,
    `${drawn.real}/${drawn.total} paths — ${drawn.sample}`);

// ── The recorded audio is reachable for playback ──────────────────────────
const playable = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const clip = st.clips[st.clips.length - 1];
    const buf = window.__audioRecorder?.bufferManager;
    return { sampleId: clip?.sampleId, id: clip?.id, hasBufferMgr: !!buf };
});
check('the clip carries a sample id for the scheduler', !!playable.sampleId,
    JSON.stringify(playable));

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
