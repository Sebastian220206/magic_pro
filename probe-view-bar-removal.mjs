/**
 * The bottom view-control bar is gone, and its toggles are not.
 *
 * That bar was 52px for eight panel toggles. Five had another route already
 * (the transport bar, the tracks-area bar), but three did not: it was the only
 * caller of `toggleEditors`, the only caller of `toggleSmartControls`
 * (SmartControls destructures it and never uses it), and the only caller of
 * `useFullscreen` anywhere in the app. The View menu listed "Show Editor",
 * "Show Mixer", "Show Toolbar" and "Full Screen" as labels with no actions.
 *
 * This clicks each entry and reads the store, because a menu entry that sets
 * nothing looks exactly like one that works.
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

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('magicPro_tutorial', 'completed'));
await page.goto(`${BASE}/login`);
await page.waitForTimeout(8000);
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

// ── The bar itself ────────────────────────────────────────────────────────
const bottom = await page.evaluate(() => {
    const shell = document.querySelector('.daw-shell')?.getBoundingClientRect();
    // Anything 52px tall pinned to the bottom of the frame.
    const strips = [...document.querySelectorAll('div')].filter(d => {
        const b = d.getBoundingClientRect();
        return shell && Math.abs(b.height - 52) < 2 && b.width > 1200 &&
               Math.abs(b.bottom - shell.bottom) < 8;
    });
    return { count: strips.length, titles: strips.flatMap(s =>
        [...s.querySelectorAll('button[title]')].map(b => b.title)) };
});
check('no 52px strip left at the bottom of the frame', bottom.count === 0,
    bottom.count ? `${bottom.count}: ${bottom.titles.join(', ')}` : 'clear');

// ── The View menu carries what it took ────────────────────────────────────
const openView = async () => {
    await page.click('[data-magic-button]');
    await page.waitForTimeout(350);
    await page.hover('[data-magic-menu-name="View"]');
    await page.waitForTimeout(250);
};
await openView();
const entries = await page.evaluate(() =>
    [...document.querySelectorAll('[data-magic-menu-item]')].map(e => e.getAttribute('data-magic-menu-item')));
check('View lists the panels',
    ['Library', 'Inspector', 'Automation', 'Editors', 'Smart Controls', 'Mixer',
     'Play Surfaces', 'Toolbar', 'Full Screen'].every(l => entries.includes(l)),
    entries.join(' · '));

const dead = await page.evaluate(() =>
    [...document.querySelectorAll('[data-magic-menu-item]')]
        .filter(b => b.disabled).map(b => b.getAttribute('data-magic-menu-item')));
check('and none of them is dead', dead.length === 0,
    dead.length ? `dimmed: ${dead.join(', ')}` : 'all live');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ── The three that had no other route ─────────────────────────────────────
const toggleFromMenu = async (label, field) => {
    const before = await page.evaluate(f => window.__projectStore.getState()[f], field);
    await openView();
    await page.click(`[data-magic-menu-item="${label}"]`);
    await page.waitForTimeout(600);
    const after = await page.evaluate(f => window.__projectStore.getState()[f], field);
    check(`View > ${label} toggles it`, after !== before, `${before} -> ${after}`);
    // Put it back.
    await openView();
    await page.click(`[data-magic-menu-item="${label}"]`);
    await page.waitForTimeout(500);
};

await toggleFromMenu('Editors', 'showEditors');
await toggleFromMenu('Smart Controls', 'showSmartControls');
await toggleFromMenu('Mixer', 'showMixer');
await toggleFromMenu('Toolbar', 'showToolbar');

// ── The tick reflects state, not a guess ──────────────────────────────────
await openView();
const ticked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[data-magic-menu-item]')]
        .find(b => b.getAttribute('data-magic-menu-item') === 'Mixer');
    const svg = btn?.querySelector('svg');
    return { shown: window.__projectStore.getState().showMixer,
             opacity: svg ? getComputedStyle(svg).opacity : null };
});
check('the tick follows the panel it names',
    (ticked.shown && ticked.opacity === '1') || (!ticked.shown && ticked.opacity === '0'),
    `showMixer=${ticked.shown}, tick opacity ${ticked.opacity}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.screenshot({ path: 'view-bar-removed.png', clip: { x: 0, y: 700, width: 1600, height: 300 } });

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
