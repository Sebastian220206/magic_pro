/**
 * Click through Settings the way a user does.
 *
 * The earlier Audio probe drove `settingsActiveTab` / `settingsActiveSubTab`
 * directly, which is exactly why it missed this: choosing Audio from the menu
 * bar left the sub-tab blank, so the page rendered an empty body, and clicking
 * a sub-tab reset the page to General. Nothing here touches the store.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 180)));

const results = [];
const check = (name, pass, detail = '') => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

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
await page.waitForTimeout(3000);

// Dismiss the onboarding overlay so it cannot swallow a click.
await page.getByRole('button', { name: /^Skip|Close|×$/ }).first().click().catch(() => { });
await page.keyboard.press('Escape').catch(() => { });
await page.waitForTimeout(400);

// Open Settings by hand, then never touch the store again.
await page.evaluate(() => window.__projectStore.getState().setShowSettingsDialog(true));
await page.waitForTimeout(700);

/** The dialog's body, excluding the two tab bars. */
const bodyText = () => page.evaluate(() => {
    const body = document.querySelector('.overflow-y-auto.p-12');
    return (body?.textContent ?? '').replace(/\s+/g, ' ').trim();
});
const activePage = () => page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-settings-tab]')]
        .find(b => b.querySelector('span')?.className.includes('text-accent-cyan'));
    return el?.dataset.settingsTab ?? '';
});
const activeSubTab = () => page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-settings-subtab]')]
        .find(b => b.className.includes('ring-accent-cyan/30'));
    return el?.dataset.settingsSubtab ?? '';
});

// ── Choosing the Audio page from the icon row ─────────────────────────────
await page.click('[data-settings-tab="Audio"]');
await page.waitForTimeout(600);
check('the Audio page opens on a sub-tab', (await activeSubTab()) === 'Devices', await activeSubTab());
check('the Audio page has a body', (await bodyText()).length > 50, `${(await bodyText()).length} chars`);
check('that body is the Devices panel', (await bodyText()).includes('Output Device'));

// ── Clicking each sub-tab must stay on Audio ──────────────────────────────
const AUDIO_TABS = ['Devices', 'General', 'Sampler', 'Editing', 'I/O Assignments', 'File Editor', 'MP3'];
const EXPECTED = {
    'Devices': 'Output Device',
    'General': 'Sample Accurate Automation',
    'Sampler': 'Sample Storage',
    'Editing': 'Crossfade Time',
    'I/O Assignments': 'Surround',
    'File Editor': 'Number of Undo Steps',
    'MP3': 'Bit Rate Mono',
};
for (const tab of AUDIO_TABS) {
    await page.click(`[data-settings-subtab="${tab}"]`);
    await page.waitForTimeout(450);
    const [pageName, sub, body] = [await activePage(), await activeSubTab(), await bodyText()];
    check(`${tab}: stays on Audio and renders`,
        pageName === 'Audio' && sub === tab && body.includes(EXPECTED[tab]),
        `page=${pageName} sub=${sub} body=${body.slice(0, 40)}...`);
}

// ── Every other page must also land somewhere that renders ────────────────
for (const name of ['General', 'Recording', 'MIDI', 'Score', 'Movie', 'Automation', 'Control Surfaces', 'View', 'My Info', 'Advanced']) {
    await page.click(`[data-settings-tab="${name}"]`);
    await page.waitForTimeout(450);
    const body = await bodyText();
    check(`${name} page renders a body`, body.length > 30, `${body.length} chars`);
    // The catch-all excluded every page but General, so General rendered
    // "not available" underneath its own panels.
    check(`${name} page shows no stray "not available"`,
        !body.includes('not available in this version'),
        body.includes('not available in this version') ? body.slice(-60) : '');
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
