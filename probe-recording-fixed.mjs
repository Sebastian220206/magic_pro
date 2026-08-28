/**
 * The recording pipeline, after the fixes.
 *
 * The three things that made a take silent and invisible:
 *
 *   1. `setMonitoring()` had no callers, so `monitorGain` was created at 0 and
 *      stayed there. Arming a track and switching monitoring on lit two
 *      buttons and opened no signal path.
 *   2. `arm()` only ran inside `beginAudioCapture`, so the input did not open
 *      until record was pressed — nothing to monitor, nothing to meter.
 *   3. `deviceId: { exact }` with a stored id that no longer resolves threw
 *      OverconstrainedError out of `arm()`. The transport rolled, the record
 *      light came on, and `recordingError` was set to the empty string,
 *      because that exception carries no message. Nothing rendered it anyway.
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
// The dashboard is the project chooser now: a New Project category with an
// Empty Project tile, and Choose to create it.
await page.click('[data-section="new"]', { timeout: 90000 });
await page.waitForTimeout(500);
await page.click('[data-tile="empty"]');
await page.click('[data-choose]');
await page.waitForURL('**/project/**', { timeout: 60000 });
// Empty Project means empty — it creates no tracks. Seed the two these
// probes assume, rather than waiting forever for tracks nothing adds.
await page.waitForFunction(() => !!window.__projectStore, null, { timeout: 60000 });
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    if (st.tracks.length === 0) {
        st.addTracks([
            { name: 'Drums', type: 'drummer', color: '#f59e0b' },
            { name: 'Piano', type: 'software-instrument', color: '#34d399', instrument: 'piano' },
        ]);
    }
});
await page.waitForFunction(() => (window.__projectStore?.getState()?.tracks?.length ?? 0) > 0, null, { timeout: 60000 });
await page.waitForTimeout(3500);

await page.evaluate(() => window.__projectStore.getState().addTrack({ name: 'Probe Audio', type: 'audio' }));
await page.waitForTimeout(1200);
const trackId = await page.evaluate(() =>
    window.__projectStore.getState().tracks.find(t => t.type === 'audio').id);

// ── Arming alone opens the input ──────────────────────────────────────────
await page.evaluate(id => window.__projectStore.getState().toggleRecordEnable(id), trackId);
await page.waitForTimeout(2500);
const onArm = await page.evaluate(() => ({
    armed: window.__audioRecorder?.isArmed ?? null,
    gain: window.__audioRecorder?.monitorGain?.gain?.value ?? null,
    recorderExists: !!window.__audioRecorder,
}));
check('record-enabling a track opens the input', onArm.armed === true,
    `isArmed=${onArm.armed} (recorder ${onArm.recorderExists ? 'built' : 'never built'})`);
check('with monitoring still off, the monitor path is closed', onArm.gain === 0,
    `monitorGain ${onArm.gain}`);

// ── Monitoring actually opens the monitor path ────────────────────────────
await page.evaluate(id => window.__projectStore.getState().toggleInputMonitoring(id), trackId);
await page.waitForTimeout(1500);
const onMonitor = await page.evaluate(() => window.__audioRecorder?.monitorGain?.gain?.value ?? null);
check('switching input monitoring on opens it', onMonitor > 0,
    `monitorGain ${onMonitor}`);

// ── And the meter is on screen, reading a real level ──────────────────────
await page.waitForTimeout(1200);
const meter = await page.evaluate(() => {
    const el = document.querySelector('[data-input-level]');
    return { present: !!el, width: el ? el.style.width : null,
             label: document.querySelector('[data-input-status]')?.textContent?.trim() ?? '' };
});
check('an input meter is visible while armed', meter.present, meter.label);
check('and it is reading signal, not stuck at zero',
    meter.width && parseFloat(meter.width) > 1, `bar at ${meter.width}`);

// ── Switching monitoring off closes it again ──────────────────────────────
await page.evaluate(id => window.__projectStore.getState().toggleInputMonitoring(id), trackId);
await page.waitForTimeout(1200);
const offAgain = await page.evaluate(() => window.__audioRecorder?.monitorGain?.gain?.value ?? null);
check('switching it off closes the monitor path', offAgain < 0.01, `monitorGain ${offAgain}`);
await page.evaluate(id => window.__projectStore.getState().toggleInputMonitoring(id), trackId);
await page.waitForTimeout(800);

// ── A missing device falls back instead of killing the take ───────────────
await page.evaluate(() => {
    window.__audioRecorder.disarm();
    window.__projectStore.setState(s => ({
        recordingError: null,
        globalSettings: { ...s.globalSettings,
            audio: { ...s.globalSettings.audio, inputDevice: 'stale-device-id-from-last-session' } },
    }));
});
await page.waitForTimeout(600);
const clipsBefore = await page.evaluate(() => window.__projectStore.getState().clips.length);
await page.click('button[title="Record (R)"]');
await page.waitForTimeout(3000);
const during = await page.evaluate(() => ({
    state: window.__audioRecorder?.state,
    samples: window.__audioRecorder?.totalSamplesRecorded ?? 0,
    error: window.__projectStore.getState().recordingError,
    errorOnScreen: document.querySelector('[data-recording-error]')?.textContent?.trim() ?? '',
}));
check('a missing device no longer stops the take', during.state === 'recording' && during.samples > 0,
    `${during.state}, ${during.samples} samples`);
check('and it says so, on screen, in words',
    during.errorOnScreen.length > 10 && /not available/i.test(during.errorOnScreen),
    during.errorOnScreen || '(nothing on screen)');

await page.click('button[title="Record (R)"]');
await page.waitForTimeout(2500);
const result = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const c = st.clips[st.clips.length - 1];
    return { count: st.clips.length,
             peaks: c?.waveformPeaks?.channels?.[0]?.min?.length ?? 0,
             duration: c?.duration ?? 0 };
});
check('the take still lands as a clip with a waveform',
    result.count > clipsBefore && result.peaks > 0 && result.duration > 0,
    `${clipsBefore} -> ${result.count}, ${result.peaks} peaks, ${result.duration?.toFixed(2)} beats`);

await page.screenshot({ path: 'recording-status.png', clip: { x: 400, y: 40, width: 800, height: 180 } });

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
