/**
 * The File menu carries the project-file commands.
 *
 * They used to be written out inside the Alternatives popover and nowhere
 * else, so a menu about project alternatives was the only route to Export as
 * WAV, Bounce and Close Project — while File listed five labels with no action
 * behind any of them. Both render from one list now, which is what this
 * checks: the same commands in both, and a real one that actually fires.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const EXPECTED = [
    'Save Project', 'Save As...', 'Save a Copy As...', 'Export as WAV...',
    'Save as Template...', 'Import Project Settings...', 'Project Information...',
    'Revert to Last Saved', 'Bounce Project (PCM)...', 'Close Project',
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

// ── Open the File menu ────────────────────────────────────────────────────
// The menu names are collapsed to nothing until the Magic Pro title is
// clicked; that toggle is what expands the bar.
await page.click('[data-menu-expand]');
await page.waitForTimeout(600);
await page.click('[data-menu="File"]');
await page.waitForTimeout(500);

const fileItems = await page.evaluate(() =>
    [...document.querySelectorAll('[data-menu-dropdown="File"] [data-menu-item]')]
        .map(el => el.getAttribute('data-menu-item') ?? '')
        .filter(Boolean));

check('the File menu opens', fileItems.length > 0, `${fileItems.length} items`);
const missing = EXPECTED.filter(label => !fileItems.includes(label));
check('it carries all ten project-file commands', missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : fileItems.join(' · '));
check('New and Open are still there', fileItems.includes('New') && fileItems.includes('Open...'));

// ── A command that opens a dialog actually opens it ───────────────────────
await page.click('[data-menu-dropdown="File"] [data-menu-item="Project Information..."]');
await page.waitForTimeout(700);
const dialogState = await page.evaluate(() => window.__projectStore.getState().projectFileDialog);
check('choosing Project Information opens that dialog', dialogState === 'info', dialogState);

const dialogVisible = await page.evaluate(() =>
    document.body.innerText.toLowerCase().includes('project information'));
check('and the dialog is actually on screen', dialogVisible);

await page.keyboard.press('Escape');
await page.evaluate(() => window.__projectStore.getState().setProjectFileDialog('none'));
await page.waitForTimeout(400);

// ── The Alternatives popover shows the same list ──────────────────────────
// That popover hangs off the project name, not off the Magic Pro title.
await page.click('[data-project-menu]');
await page.waitForTimeout(700);
const altItems = await page.evaluate(() =>
    [...document.querySelectorAll('button span')].map(s => s.textContent.trim()));
const inBoth = EXPECTED.filter(label => altItems.includes(label));
check('the Alternatives popover renders the same commands', inBoth.length === EXPECTED.length,
    `${inBoth.length}/${EXPECTED.length}`);

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
