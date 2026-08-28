/**
 * Export the project as MP3 in a real browser and check what comes back.
 *
 * `projectExport` used to report "MP3 encoding is not available in the browser
 * build" and hand back a WAV, and `bounceEngine`'s encoder had never loaded at
 * all. This is the end-to-end proof that a chosen bit rate reaches lamejs.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 180)));

await page.goto(`${BASE}/login`);
// A cold dev build serves the page before React attaches its handlers; a
// click landing first submits the form natively and never logs in.
await page.waitForTimeout(6000);
await page.fill('input[type="email"]', 'dev@example.com');
await page.fill('input[type="password"]', 'devpassword123');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 60000 });
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
await page.mouse.click(900, 400);

// Something to encode: four bars of notes on the first instrument track.
await page.evaluate(() => {
    const s = window.__projectStore.getState();
    const track = s.tracks.find(t => t.type !== 'audio') ?? s.tracks[0];
    s.addClip({
        id: 'mp3-probe-clip',
        trackId: track.id,
        type: 'midi',
        name: 'Probe',
        start: 0,
        startBeat: 0,
        duration: 8,
        notes: [0, 2, 4, 6].map((beat, i) => ({
            id: `n${i}`, pitch: 60 + i * 4, velocity: 100, start: beat, duration: 1.5,
        })),
    });
});
await page.waitForTimeout(800);

async function exportAt(bitRate) {
    return page.evaluate(async (rate) => {
        const s = window.__projectStore.getState();
        const audio = s.globalSettings.audio ?? {};
        s.updateGlobalSettings({ audio: { ...audio, mp3: { ...audio.mp3, bitRateStereo: rate } } });
        const result = await window.__projectStore.getState().exportProject({ format: 'mp3' });
        const head = new Uint8Array(await result.blob.slice(0, 2).arrayBuffer());
        return {
            fileName: result.fileName,
            type: result.blob.type,
            size: result.blob.size,
            sync: head[0] === 0xff && (head[1] & 0xe0) === 0xe0,
            notice: result.formatNotice ?? null,
        };
    }, bitRate);
}

const low = await exportAt('96 kbit/s');
const high = await exportAt('320 kbit/s');

const checks = [
    ['the file is named .mp3', high.fileName.endsWith('.mp3'), high.fileName],
    ['the blob is audio/mpeg', high.type === 'audio/mpeg', high.type],
    ['no fallback notice', high.notice === null, String(high.notice)],
    ['the bytes start with an MP3 frame sync', high.sync, ''],
    ['320 kbit/s is markedly bigger than 96', high.size > low.size * 2.5, `${low.size} -> ${high.size} bytes`],
];
let failed = 0;
for (const [name, pass, detail] of checks) {
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
