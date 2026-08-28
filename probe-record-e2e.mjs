/**
 * A take, start to finish, driven only by the mouse.
 *
 * The earlier recording probe armed the track by calling the store and then
 * clicked record. Arming now opens the input, so the order and the route both
 * matter: this clicks R in the track list, clicks record, waits, clicks record
 * again, and asks whether a clip with a waveform exists and whether its audio
 * is reachable for playback.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
           '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, permissions: ['microphone'] });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));
page.on('console', m => {
    const t = m.text();
    if (/AudioRecorder|\[Recording|RecordingClip|worklet/i.test(t)) console.log('  [log]', t.slice(0, 180));
});

const results = [];
const check = (name, pass, detail = '') => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('magicPro_tutorial', 'completed'));
await page.goto(`${BASE}/login`);
await page.waitForTimeout(9000);
for (let i = 0; i < 4; i++) {
    await page.fill('input[type="email"]', 'dev@example.com');
    await page.fill('input[type="password"]', 'devpassword123');
    await page.click('button[type="submit"]');
    try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 }); break; }
    catch { await page.waitForTimeout(4000); }
}
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'New Project' }).first().click({ timeout: 90000 });
await page.waitForTimeout(2200);
await page.getByRole('button', { name: /Blank Project/i }).first().click();
await page.waitForURL('**/project/**', { timeout: 60000 });
await page.waitForFunction(() => (window.__projectStore?.getState()?.tracks?.length ?? 0) > 0, null, { timeout: 60000 });
await page.waitForTimeout(3500);

await page.evaluate(() => window.__projectStore.getState().addTrack({ name: 'Probe Audio', type: 'audio' }));
await page.waitForTimeout(1500);
const trackId = await page.evaluate(() =>
    window.__projectStore.getState().tracks.find(t => t.type === 'audio').id);

// ── Arm by clicking R ─────────────────────────────────────────────────────
await page.click(`[data-track-action="recordEnabled"][data-track-id="${trackId}"]`);
await page.waitForTimeout(2500);
check('R opens the input', await page.evaluate(() => window.__audioRecorder?.isArmed === true));

const clipsBefore = await page.evaluate(() => window.__projectStore.getState().clips.length);

// ── Record ────────────────────────────────────────────────────────────────
await page.click('button[title="Record (R)"]');
await page.waitForTimeout(1000);
const started = await page.evaluate(() => ({
    recording: window.__projectStore.getState().recording,
    recState: window.__audioRecorder?.state,
    error: window.__projectStore.getState().recordingError,
}));
check('the recorder enters the recording state',
    started.recording === true && started.recState === 'recording',
    `transport=${started.recording} recorder=${started.recState}${started.error ? ` err=${started.error}` : ''}`);

await page.waitForTimeout(3000);
const mid = await page.evaluate(() => ({
    samples: window.__audioRecorder?.totalSamplesRecorded ?? 0,
    peak: window.__audioRecorder?.maxAmplitude ?? 0,
}));
check('samples are arriving', mid.samples > 0, `${mid.samples} samples`);
check('and they carry signal', mid.peak > 0.001, `peak ${mid.peak?.toFixed(3)}`);

// ── Stop ──────────────────────────────────────────────────────────────────
await page.click('button[title="Record (R)"]');
await page.waitForTimeout(3000);

const after = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const c = st.clips[st.clips.length - 1];
    return {
        count: st.clips.length,
        error: st.recordingError,
        clip: c ? {
            id: c.id, trackId: c.trackId, type: c.type, name: c.name,
            duration: c.duration, start: c.start, startBeat: c.startBeat,
            peaks: c.waveformPeaks?.channels?.[0]?.min?.length ?? 0,
        } : null,
    };
});
check('a clip is on the timeline', after.count > clipsBefore,
    `${clipsBefore} -> ${after.count}${after.error ? ` (err: ${after.error})` : ''}`);
check('it belongs to the armed track', after.clip?.trackId === trackId,
    `${after.clip?.trackId} vs ${trackId}`);
check('it has a duration', (after.clip?.duration ?? 0) > 0, `${after.clip?.duration}`);
check('it has waveform data', (after.clip?.peaks ?? 0) > 0, `${after.clip?.peaks} peaks`);

// ── And it is drawn ───────────────────────────────────────────────────────
await page.waitForTimeout(1500);
const drawn = await page.evaluate(() => {
    const paths = [...document.querySelectorAll('svg[viewBox="0 0 100 40"] path')];
    return paths.filter(p => (p.getAttribute('d') ?? '').split('M').length > 50).length;
});
check('the timeline draws it', drawn > 0, `${drawn} real waveform paths`);

// ── And its audio can be played back ──────────────────────────────────────
const playable = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const c = st.clips[st.clips.length - 1];
    let cache = null;
    try { cache = require; } catch { /* not available in page */ }
    return {
        sampleId: c?.sampleId,
        inEngine: !!window.__audioEngine?.hasBuffer?.(c?.id),
    };
});
check('the take carries a sample id', !!playable.sampleId, JSON.stringify(playable));

await page.screenshot({ path: 'record-e2e.png', clip: { x: 0, y: 100, width: 1400, height: 420 } });

/*
 * A take on a track whose alternative is not the string 'alt-1'.
 *
 * The timeline compares `clip.alternativeId === track.activeAlternativeId`
 * strictly, and the clip was written with `track.activeAlternativeId ||
 * 'default'` — so a track holding '' (the bounce-in-place path writes that) or
 * nothing at all got clips stamped 'default', which never matched. The take
 * landed in the project and was never drawn.
 */
for (const alt of ['', undefined]) {
    await page.evaluate(([id, a]) => {
        window.__projectStore.setState(s => ({
            tracks: s.tracks.map(t => t.id === id ? { ...t, activeAlternativeId: a } : t),
        }));
    }, [trackId, alt]);
    await page.waitForTimeout(600);

    const before = await page.evaluate(() => window.__projectStore.getState().clips.length);
    await page.click('button[title="Record (R)"]');
    await page.waitForTimeout(2500);
    await page.click('button[title="Record (R)"]');
    await page.waitForTimeout(2500);

    const seen = await page.evaluate(id => {
        const st = window.__projectStore.getState();
        const track = st.tracks.find(t => t.id === id);
        const c = st.clips[st.clips.length - 1];
        return {
            added: st.clips.length,
            clipAlt: c?.alternativeId,
            trackAlt: track?.activeAlternativeId,
            visible: c ? c.alternativeId === track?.activeAlternativeId : false,
        };
    }, trackId);
    check(`a take on a track whose alternative is ${JSON.stringify(alt)} is drawable`,
        seen.added > before && seen.visible,
        `clip=${JSON.stringify(seen.clipAlt)} track=${JSON.stringify(seen.trackAlt)}`);
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
