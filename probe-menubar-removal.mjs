/**
 * The simulated menu bar is gone, and nothing went with it.
 *
 * That bar was the only mount for `ProjectManager`, which rendered the
 * project-file dialogs and owned the alternatives list. Removing it made
 * Save As, Import Project Settings, Project Information and Bounce set a
 * store flag that nothing listened to. This drives the menu with the mouse
 * and checks a dialog actually appears — a probe that set the store field
 * directly would pass whether or not anything renders it.
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
await page.fill('input[type="email"]', 'dev@example.com');
await page.fill('input[type="password"]', 'devpassword123');
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 60000 });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'New Project' }).first().click();
await page.waitForTimeout(2200);
await page.getByRole('button', { name: /Blank Project/i }).first().click();
await page.waitForURL('**/project/**', { timeout: 60000 });
await page.waitForFunction(() => (window.__projectStore?.getState()?.tracks?.length ?? 0) > 0, null, { timeout: 60000 });
await page.waitForTimeout(3500);

// ── The strip itself ──────────────────────────────────────────────────────
const bar = await page.evaluate(() => {
    const apple = [...document.querySelectorAll('svg path')]
        .some(p => (p.getAttribute('d') ?? '').startsWith('M12.152 8.9'));
    return { apple, projectChip: !!document.querySelector('[data-project-menu]') };
});
check('the apple icon is gone', !bar.apple);
check('and the project-name popover with it', !bar.projectChip);

// The transport bar should now be the topmost chrome in the frame.
const topmost = await page.evaluate(() => {
    const t = document.querySelector('[data-view-toggles-shell]')?.closest('div[class*="h-[52px]"]');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    const shell = document.querySelector('.daw-shell')?.getBoundingClientRect();
    return { gap: Math.round(r.top - (shell?.top ?? 0)) };
});
// 5px is the neon frame's own border; anything more is a strip that survived.
check('the transport bar sits at the top of the frame',
    topmost !== null && topmost.gap <= 6, `${topmost?.gap}px below the frame — the frame's border is 5px`);

// ── Alternatives survived, in the M menu ──────────────────────────────────
await page.click('[data-magic-button]');
await page.waitForTimeout(400);
const names = await page.evaluate(() =>
    [...document.querySelectorAll('[data-magic-menu-name]')].map(e => e.getAttribute('data-magic-menu-name')));
check('the M menu carries Alternatives', names.includes('Alternatives'), names.join(' · '));

await page.hover('[data-magic-menu-name="Alternatives"]');
await page.waitForTimeout(250);
const alt = await page.evaluate(() => ({
    heading: document.querySelector('[data-magic-menu-heading]')?.getAttribute('data-magic-menu-heading'),
    items: [...document.querySelectorAll('[data-magic-menu-item]')].map(e => e.getAttribute('data-magic-menu-item')),
}));
check('it names the open project', !!alt.heading, alt.heading ?? 'no readout');
check('the main project and a way to add one', 
    alt.items.includes('(Main Project)') && alt.items.includes('New Alternative...'),
    alt.items.join(' · '));

// ── A dialog the removed bar used to render ───────────────────────────────
await page.hover('[data-magic-menu-name="File"]');
await page.waitForTimeout(250);
await page.click('[data-magic-menu-item="Project Information..."]');
await page.waitForTimeout(800);
const info = await page.evaluate(() => ({
    flag: window.__projectStore.getState().projectFileDialog,
    onScreen: [...document.querySelectorAll('div')]
        .some(d => /Project Information/i.test(d.textContent ?? '') &&
                   getComputedStyle(d).position === 'fixed'),
}));
check('File > Project Information sets the store flag', info.flag === 'info', info.flag);
check('and something actually renders the dialog', info.onScreen,
    info.onScreen ? 'on screen' : 'flag set, nothing rendered');

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.evaluate(() => window.__projectStore.getState().setProjectFileDialog('none'));
await page.waitForTimeout(300);

// ── Save As, the other one that lost its renderer ─────────────────────────
await page.click('[data-magic-button]');
await page.waitForTimeout(350);
await page.hover('[data-magic-menu-name="File"]');
await page.waitForTimeout(250);
await page.click('[data-magic-menu-item="Save As..."]');
await page.waitForTimeout(800);
const saveAs = await page.evaluate(() => ({
    flag: window.__projectStore.getState().projectFileDialog,
    onScreen: [...document.querySelectorAll('div')]
        .some(d => getComputedStyle(d).position === 'fixed' &&
                   !!d.querySelector('input') && /save/i.test(d.textContent ?? '')),
}));
check('File > Save As opens its dialog too', saveAs.flag === 'saveAs' && saveAs.onScreen,
    `${saveAs.flag} / ${saveAs.onScreen ? 'rendered' : 'NOT rendered'}`);

await page.screenshot({ path: 'menubar-removed.png', clip: { x: 0, y: 0, width: 1600, height: 260 } });

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
