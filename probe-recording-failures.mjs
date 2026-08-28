/**
 * The two ways this pipeline fails in silence.
 *
 * The happy path works — probe-recording.mjs records a tone and draws it. So
 * the report "I armed the track, set my interface, heard nothing and got no
 * waveform" has to come from somewhere before capture. These are the two
 * candidates, and what matters about both is that neither says anything.
 *
 *   1. A stored input deviceId that no longer resolves. deviceIds are
 *      origin-scoped and rotate; `deviceId: { exact }` throws
 *      OverconstrainedError, `arm()` rethrows, `beginAudioCapture` catches it
 *      into `recordingError` — which no component renders.
 *
 *   2. Arming a track that is not `type: 'audio'`. `armedAudioTracks` filters
 *      on it, `beginAudioCapture` returns on empty, and the transport rolls
 *      over a take that captures nothing at all.
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
await page.getByRole('button', { name: 'New Project' }).first().click();
await page.waitForTimeout(2200);
await page.getByRole('button', { name: /Blank Project/i }).first().click();
await page.waitForURL('**/project/**', { timeout: 60000 });
await page.waitForFunction(() => (window.__projectStore?.getState()?.tracks?.length ?? 0) > 0, null, { timeout: 60000 });
await page.waitForTimeout(3500);

const record = async (seconds) => {
    await page.click('button[title="Record (R)"]');
    await page.waitForTimeout(seconds * 1000);
    await page.click('button[title="Record (R)"]');
    await page.waitForTimeout(2000);
};

// ── Failure 1: a stored deviceId that no longer resolves ──────────────────
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    st.addTrack({ name: 'Probe Audio', type: 'audio' });
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const audio = st.tracks.find(t => t.type === 'audio');
    st.toggleRecordEnable(audio.id);
    // A device that was real last session and is not enumerable now.
    st.updateGlobalSettings?.({ audio: { ...st.globalSettings.audio, inputDevice: 'stale-device-id-from-last-session' } })
        ?? window.__projectStore.setState(s => ({
            globalSettings: { ...s.globalSettings, audio: { ...s.globalSettings.audio, inputDevice: 'stale-device-id-from-last-session' } },
        }));
});
await page.waitForTimeout(600);

const before1 = await page.evaluate(() => window.__projectStore.getState().clips.length);
await record(2);
const after1 = await page.evaluate(() => ({
    clips: window.__projectStore.getState().clips.length,
    error: window.__projectStore.getState().recordingError,
    // Is that error anywhere a person could see it?
    onScreen: document.body.innerText.toLowerCase().includes('overconstrain')
           || /could not|failed|device/i.test(
                [...document.querySelectorAll('[role="alert"], [data-recording-error]')]
                    .map(e => e.textContent).join(' ')),
}));
check('a stale device id records nothing', after1.clips === before1,
    `${before1} -> ${after1.clips}`);
check('the store knows why', !!after1.error, after1.error ?? 'no error recorded');
check('but nothing tells the person', after1.onScreen === false,
    after1.onScreen ? 'an error is shown' : 'the failure is silent on screen');

// ── Failure 2: arming a track that is not an audio track ──────────────────
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    window.__projectStore.setState(s => ({
        globalSettings: { ...s.globalSettings, audio: { ...s.globalSettings.audio, inputDevice: 'default' } },
    }));
    // Disarm the audio track, arm a non-audio one instead.
    const audio = st.tracks.find(t => t.type === 'audio');
    if (audio?.recordEnabled) st.toggleRecordEnable(audio.id);
    const other = st.tracks.find(t => t.type !== 'audio');
    if (other && !other.recordEnabled) st.toggleRecordEnable(other.id);
});
await page.waitForTimeout(600);
const armedKinds = await page.evaluate(() =>
    window.__projectStore.getState().tracks.filter(t => t.recordEnabled).map(t => t.type));
check('only a non-audio track is armed', armedKinds.length > 0 && !armedKinds.includes('audio'),
    armedKinds.join(', ') || 'none armed');

const before2 = await page.evaluate(() => window.__projectStore.getState().clips.length);
await record(2);
const after2 = await page.evaluate(() => ({
    clips: window.__projectStore.getState().clips.length,
    error: window.__projectStore.getState().recordingError,
}));
check('arming a non-audio track records no audio', after2.clips === before2,
    `${before2} -> ${after2.clips}`);
check('and says nothing at all about it', !after2.error,
    after2.error ?? 'no error, no clip, no message');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
console.log('\nNote: these checks PASS by reproducing the reported failure.');
await browser.close();
process.exit(failed ? 1 : 0);
