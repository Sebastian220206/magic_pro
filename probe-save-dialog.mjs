/**
 * Save As, rebuilt for a DAW that saves to an account.
 *
 * The dialog was a macOS save sheet: a Where: picker on a folder called
 * "Logic", a Tags field with no column behind it, a Package/Folder choice for
 * a bundle format this app does not produce, and seven checkboxes for copying
 * Alchemy, Ultrabeat and Space Designer data. `saveAs` reads `data.name` and
 * nothing else — so eleven of those controls went nowhere, and the name they
 * handed back carried ".magicx" straight into the project's stored name.
 *
 * This drives the dialog and reads the name the store ends up with, because
 * that is the part that was actually broken.
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

const openSaveAs = async (item) => {
    await page.click('[data-magic-button]');
    await page.waitForTimeout(350);
    await page.hover('[data-magic-menu-name="File"]');
    await page.waitForTimeout(250);
    await page.click(`[data-magic-menu-item="${item}"]`);
    await page.waitForTimeout(700);
};

await openSaveAs('Save As...');

// ── The macOS sheet is gone ───────────────────────────────────────────────
const gone = await page.evaluate(() => {
    const text = document.querySelector('[data-save-confirm]')?.closest('div.bg-studio-panel')?.textContent ?? '';
    return {
        text,
        stale: ['Tags', 'Where', 'Package', 'Folder', 'Alchemy', 'Ultrabeat',
                'Space Designer', 'Apple Sound Library', 'Movie file']
               .filter(t => text.includes(t)),
        checkboxes: document.querySelectorAll('[data-save-confirm]')[0]
            ?.closest('div.bg-studio-panel')?.querySelectorAll('input[type="checkbox"], input[type="radio"]').length ?? -1,
    };
});
check('nothing left that points at a filesystem', gone.stale.length === 0,
    gone.stale.length ? `still there: ${gone.stale.join(', ')}` : 'clear');
check('no controls that write nowhere', gone.checkboxes === 0,
    `${gone.checkboxes} checkbox/radio inputs`);
check('it says which command it is running', gone.text.includes('Save As'));
check('and where the save goes', gone.text.includes('Your account') && gone.text.includes('This browser'));

// ── The name field does not carry a file extension ────────────────────────
const field = await page.inputValue('#save-name');
check('the name field holds a name, not a filename', !/\.magicx$/i.test(field), field);

// ── An empty name cannot be saved ─────────────────────────────────────────
await page.fill('#save-name', '   ');
await page.waitForTimeout(250);
const blocked = await page.evaluate(() =>
    document.querySelector('[data-save-confirm]')?.disabled);
check('an empty name is refused', blocked === true);

// ── Saving stores the name it was given, and nothing more ─────────────────
await page.fill('#save-name', 'Probe Renamed');
await page.waitForTimeout(200);
await page.click('[data-save-confirm]');
await page.waitForTimeout(3500);
const stored = await page.evaluate(() => window.__projectStore.getState().name);
check('the store takes exactly the name typed', stored === 'Probe Renamed', stored);
check('no extension leaks into the project name', !/\.magicx/i.test(stored), stored);

// ── Save a Copy As names itself differently ───────────────────────────────
await openSaveAs('Save a Copy As...');
const copyTitle = await page.evaluate(() =>
    document.querySelector('[data-save-confirm]')?.closest('div.bg-studio-panel')?.textContent ?? '');
check('Save a Copy As says so', copyTitle.includes('Save a Copy As'),
    copyTitle.slice(0, 40));

await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// ── The warning that only appears when there is audio to lose ─────────────
// Audio clips carry a `storageKey` into this browser's IndexedDB and nothing
// uploads them, so a project saved to the account references files only this
// machine has. The branch is worth exercising: a blank project never shows it.
const noWarnYet = await page.evaluate(() => !!document.querySelector('[data-audio-warning]'));
check('no warning when the project has no audio', !noWarnYet);

await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const trackId = st.tracks[0].id;
    st.addClip({ id: 'probe-audio-1', trackId, name: 'take.wav', type: 'audio',
                 start: 0, duration: 4, storageKey: 'probe-key-1' });
    st.addClip({ id: 'probe-audio-2', trackId, name: 'take2.wav', type: 'audio',
                 start: 8, duration: 4, storageKey: 'probe-key-2' });
});
await page.waitForTimeout(500);
await openSaveAs('Save As...');
const warn = await page.evaluate(() =>
    document.querySelector('[data-audio-warning]')?.textContent ?? '');
check('two audio files produce the warning, counted', 
    /2 audio files stay/.test(warn), warn.slice(0, 60));

const panel = await page.$('[data-save-confirm]');
const box = await (await panel.evaluateHandle(el => el.closest('div.bg-studio-panel'))).asElement().boundingBox();
await page.screenshot({ path: 'save-dialog.png', clip: box });

await page.keyboard.press('Escape');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
