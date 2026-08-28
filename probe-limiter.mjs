/**
 * Does moving an EQ band change the audio?
 *
 * The eight-band editor wrote `bandN_*` into a three-band DSP whose `setState`
 * read none of those keys, so every band move was a picture. This renders a
 * tone through the EQ and reads the level.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));

await page.goto(`${BASE}/login`);
await page.waitForTimeout(6000);
// Clicking before hydration submits the form natively and lands back on
// /login?, which looks exactly like a rejected password.
for (let attempt = 0; attempt < 4; attempt++) {
    await page.fill('input[type="email"]', 'dev@example.com');
    await page.fill('input[type="password"]', 'devpassword123');
    await page.click('button[type="submit"]');
    try {
        await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });
        break;
    } catch { await page.waitForTimeout(4000); }
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
await page.waitForTimeout(4000);
await page.waitForFunction(() => typeof window.audioDebug?.testLimiter === 'function', null, { timeout: 30000 });

const rows = await page.evaluate(async () => {
    const out = [];
    const original = console.table;
    console.table = (d) => { out.push(...d); };
    await window.audioDebug.testLimiter();
    console.table = original;
    return out;
});

console.log('');
let failed = 0;
for (const r of rows) {
    if (r.Works !== 'yes') failed++;
    console.log(`${r.Works === 'yes' ? 'PASS' : 'FAIL'}  ${r.Check}`);
    console.log(`        change ${r['Change (dB)']} dB, peak ${r.Peak}`);
}
console.log(`\n${rows.length - failed}/${rows.length} limiter checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
