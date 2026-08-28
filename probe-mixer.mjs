/**
 * Is the mixer ready to mix?
 *
 * Drives the live mixer graph — a tone into a channel input, an analyser on the
 * master — and reads the level while moving one control at a time. Node counts
 * and UI state prove nothing here; only a level does.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 180)));

await page.goto(`${BASE}/login`);
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
await page.waitForTimeout(4000);

// The AudioContext needs a gesture, and the mute check needs the metronome
// quiet — its clicks reach the destination through their own node and would
// read as "the channel is still audible".
await page.mouse.click(900, 400);
await page.evaluate(() => {
    const s = window.__projectStore.getState();
    s.setMetronomeEnabled?.(false);
    if (s.metronomeEnabled) s.toggleMetronome?.();
});
await page.waitForTimeout(600);

await page.waitForFunction(() => typeof window.audioDebug?.testMixer === 'function', null, { timeout: 30000 });

const checks = await page.evaluate(async () => {
    const rows = [];
    const original = console.table;
    console.table = (data) => { rows.push(...data); };
    await window.audioDebug.testMixer();
    console.table = original;
    return rows;
});

console.log('');
let failed = 0;
for (const c of checks) {
    if (c.Result !== 'PASS') failed++;
    console.log(`${c.Result === 'PASS' ? 'PASS' : 'FAIL'}  ${c.Control}: ${c.Expected}`);
    console.log(`        ${c.Detail}`);
}
console.log(`\n${checks.length - failed}/${checks.length} mixer controls verified`);
await browser.close();
process.exit(failed ? 1 : 0);
