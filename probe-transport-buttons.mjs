/**
 * The transport bar's view toggles.
 *
 * Smart Controls and Editors were `() => { }` with `active` hard-coded false —
 * two buttons that could not be pressed into doing anything, or into looking
 * pressed. They are gone. This checks the remaining ones still work, rather
 * than that the row merely looks shorter.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 160)));

const results = [];
const check = (name, pass, detail = '') => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

await page.goto(`${BASE}/login`);
await page.waitForTimeout(8000);
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
await page.waitForTimeout(3500);

const row = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-view-toggles] button')];
    return {
        count: buttons.length,
        // lucide gives each icon an svg class naming it.
        icons: buttons.map(b => {
            const cls = b.querySelector('svg')?.getAttribute('class') ?? '';
            return (cls.match(/lucide-([a-z0-9-]+)/) ?? [])[1] ?? '?';
        }),
    };
});

check('the row has five toggles left', row.count === 5, `${row.count}: ${row.icons.join(', ')}`);
check('the activity icon is gone', !row.icons.includes('activity'), row.icons.join(', '));
check('the monitor icon is gone', !row.icons.some(i => i.includes('monitor')), row.icons.join(', '));

// The neighbours must still work — removing two buttons must not disturb them.
const mixerBefore = await page.evaluate(() => window.__projectStore.getState().showMixer);
await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-view-toggles] button')];
    const mixer = buttons.find(b =>
        (b.querySelector('svg')?.getAttribute('class') ?? '').includes('lucide-list'));
    mixer?.click();
});
await page.waitForTimeout(700);
const mixerAfter = await page.evaluate(() => window.__projectStore.getState().showMixer);
check('the mixer toggle beside them still works', mixerBefore !== mixerAfter,
    `${mixerBefore} -> ${mixerAfter}`);

// And no orphan checkbox is left in the control bar customiser, which renders
// one row per key in this object.
const orphans = await page.evaluate(() =>
    Object.keys(window.__projectStore.getState().controlBarSettings.viewButtons)
        .filter(k => k === 'smartControls' || k === 'editors'));
check('no settings remain for the removed buttons', orphans.length === 0,
    orphans.join(', ') || 'none');

const el = await page.$('[data-view-toggles]');
if (el) {
    const b = await el.boundingBox();
    await page.screenshot({ path: 'transport-row.png',
        clip: { x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 16 } });
}
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
