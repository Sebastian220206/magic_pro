/**
 * Every menu is behind the M button.
 *
 * They were a row of names across the title bar, collapsed to zero width until
 * the "Magic Pro" title was clicked — so on load the bar read as empty and the
 * only way in was pressing a word that did not look like a control. This
 * checks they all arrived, that their entries come with them, and that a real
 * one still fires.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
// Alternatives joined them when the simulated menu bar was removed: the
// project-name popover it lived in went with the bar.
const EXPECTED = [
    'Magic Pro', 'Alternatives', 'File', 'Edit', 'Track', 'Navigate', 'Record',
    'Setting', 'Mix', 'View', 'Window', 'Help',
];

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

// ── The title bar no longer carries them ──────────────────────────────────
const stillInBar = await page.evaluate(() =>
    [...document.querySelectorAll('[data-menu]')].map(e => e.getAttribute('data-menu')));
check('the title bar no longer carries the menu row', stillInBar.length === 0,
    stillInBar.join(', ') || 'none');

// ── The M opens them ──────────────────────────────────────────────────────
await page.click('[data-magic-button]');
await page.waitForTimeout(500);

const names = await page.evaluate(() =>
    [...document.querySelectorAll('[data-magic-menu-name]')]
        .map(e => e.getAttribute('data-magic-menu-name')));
check('the M opens a menu of every menu', names.length === EXPECTED.length,
    `${names.length}: ${names.join(', ')}`);
const missing = EXPECTED.filter(n => !names.includes(n));
check('all twelve are there, in order', missing.length === 0 && names.join() === EXPECTED.join(),
    missing.length ? `missing: ${missing.join(', ')}` : names.join(' · '));

// ── Each one shows its own entries ────────────────────────────────────────
const perMenu = {};
for (const name of EXPECTED) {
    await page.hover(`[data-magic-menu-name="${name}"]`);
    await page.waitForTimeout(180);
    perMenu[name] = await page.evaluate(() =>
        [...document.querySelectorAll('[data-magic-menu-item]')]
            .map(e => e.getAttribute('data-magic-menu-item')));
}
const empty = EXPECTED.filter(n => (perMenu[n] ?? []).length === 0);
check('every menu shows entries of its own', empty.length === 0,
    empty.length ? `empty: ${empty.join(', ')}` : EXPECTED.map(n => `${n}:${perMenu[n].length}`).join(' '));

check('File still carries the project-file commands',
    perMenu.File?.includes('Export as WAV...') && perMenu.File?.includes('Close Project'),
    (perMenu.File ?? []).join(' · ').slice(0, 90));

// ── A real entry fires and the menu closes ────────────────────────────────
await page.hover('[data-magic-menu-name="Setting"]');
await page.waitForTimeout(220);
await page.click('[data-magic-menu-item="Audio..."]');
await page.waitForTimeout(700);
const opened = await page.evaluate(() => ({
    shown: window.__projectStore.getState().showSettingsDialog,
    tab: window.__projectStore.getState().settingsActiveTab,
    menuGone: !document.querySelector('[data-magic-menu]'),
}));
check('choosing Setting > Audio opens Settings on Audio',
    opened.shown === true && opened.tab === 'Audio', `${opened.shown} / ${opened.tab}`);
check('and the menu closes behind it', opened.menuGone);

await page.evaluate(() => window.__projectStore.getState().setShowSettingsDialog(false));
await page.waitForTimeout(400);

// ── Escape dismisses it ───────────────────────────────────────────────────
await page.click('[data-magic-button]');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('Escape closes the menu',
    await page.evaluate(() => !document.querySelector('[data-magic-menu]')));

await page.click('[data-magic-button]');
await page.waitForTimeout(400);
await page.hover('[data-magic-menu-name="File"]');
await page.waitForTimeout(300);
const menu = await page.$('[data-magic-menu]');
if (menu) {
    const b = await menu.boundingBox();
    await page.screenshot({ path: 'magic-menu.png', clip: { x: b.x - 60, y: b.y - 46, width: b.width + 80, height: b.height + 60 } });
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
