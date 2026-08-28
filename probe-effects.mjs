/**
 * Do our built-in effects actually process audio?
 *
 * Renders a test signal through each one in an OfflineAudioContext and compares
 * it against a dry render. Two separate questions: does anything come out, and
 * is what comes out different from what went in. A processor that is wired but
 * passes its input straight through answers yes to the first and no to the
 * second, and only the second means "the effect works".
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') console.log('  [console]', m.text().slice(0, 160)); });

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

await page.waitForFunction(() => typeof window.audioDebug?.testEffects === 'function', null, { timeout: 30000 });

const results = await page.evaluate(async () => {
    // Through the debug surface, which imports the probe the way the app would.
    const rows = [];
    const original = console.table;
    console.table = (data) => { rows.push(...data); };
    await window.audioDebug.testEffects();
    console.table = original;
    return rows;
});

console.log('');
let failed = 0;
for (const r of results) {
    const isDry = r.Effect === 'No effect';
    const ok = isDry
        ? r.Audible === 'yes'
        : (r.Built === 'yes' && r.Audible === 'yes' && r.Processing === 'yes');
    if (!ok) failed++;
    const label = isDry ? 'dry reference is audible' : `${r.Effect}: builds, passes audio, and processes`;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    console.log(`        built=${r.Built} peak=${r.Peak} audible=${r.Audible} processing=${r.Processing} diff=${r.Difference}${r.Error ? ` error=${r.Error}` : ''}`);
}

console.log(`\n${results.length - failed}/${results.length} effects verified`);
await browser.close();
process.exit(failed ? 1 : 0);
