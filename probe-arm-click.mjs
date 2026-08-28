/**
 * Arming by clicking, not by calling the store.
 *
 * The previous fix wired `toggleRecordEnable` and `toggleInputMonitoring`, and
 * a probe that called those directly passed. Both of those store actions have
 * zero callers in the UI: every R and I button in the track list and the mixer
 * writes through `updateTrack`. So the input still never opened for anyone
 * pressing an actual button, and the probe could not see it.
 *
 * This one uses the mouse. Nothing here touches the store except to read it.
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

// An audio track has to exist to arm one. Created through the store because
// the New Track dialog is not what is under test here.
await page.evaluate(() => window.__projectStore.getState().addTrack({ name: 'Probe Audio', type: 'audio' }));
await page.waitForTimeout(1500);

// ── Find the R and I buttons in the track list ────────────────────────────
const trackId = await page.evaluate(() =>
    window.__projectStore.getState().tracks.find(t => t.type === 'audio').id);
const rSel = `[data-track-action="recordEnabled"][data-track-id="${trackId}"]`;
const iSel = `[data-track-action="inputMonitoring"][data-track-id="${trackId}"]`;

const present = await page.evaluate(([r, i]) =>
    ({ r: !!document.querySelector(r), i: !!document.querySelector(i) }), [rSel, iSel]);
check('the R and I buttons are on screen', present.r && present.i,
    `R=${present.r} I=${present.i}`);

const clickIn = async (sel) => {
    const el = await page.$(sel);
    if (!el) return false;
    await el.scrollIntoViewIfNeeded();
    await el.click();
    return true;
};

// ── Click R ───────────────────────────────────────────────────────────────
const clickedR = await clickIn(rSel);
await page.waitForTimeout(2500);
const afterR = await page.evaluate(() => ({
    armed: window.__projectStore.getState().tracks.find(t => t.type === 'audio')?.recordEnabled,
    isArmed: window.__audioRecorder?.isArmed ?? null,
    recorderBuilt: !!window.__audioRecorder,
}));
check('clicking R arms the track', clickedR && afterR.armed === true, `clicked=${clickedR}`);
check('and clicking R opens the input',
    afterR.isArmed === true,
    `recorder ${afterR.recorderBuilt ? 'built' : 'never built'}, isArmed=${afterR.isArmed}`);

// ── Click I ───────────────────────────────────────────────────────────────
const clickedI = await clickIn(iSel);
await page.waitForTimeout(2000);
const afterI = await page.evaluate(() => ({
    mon: window.__projectStore.getState().tracks.find(t => t.type === 'audio')?.inputMonitoring,
    gain: window.__audioRecorder?.monitorGain?.gain?.value ?? null,
}));
check('clicking I switches monitoring on', clickedI && afterI.mon === true, `clicked=${clickedI}`);
check('and clicking I opens the monitor path', (afterI.gain ?? 0) > 0,
    `monitorGain ${afterI.gain}`);

// ── The status chip and meter appear from a click alone ───────────────────
const ui = await page.evaluate(() => {
    const bar = document.querySelector('[data-input-level]');
    return { chip: document.querySelector('[data-input-status]')?.textContent?.trim() ?? '',
             width: bar ? bar.style.width : null };
});
check('the input meter appears and moves', ui.width && parseFloat(ui.width) > 1,
    `${ui.chip} — bar at ${ui.width}`);

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
