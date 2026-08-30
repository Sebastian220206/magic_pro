/**
 * Smart Controls, Mixer and Editors, in the transport bar.
 *
 * The two on the outside were here once and were removed, because both were
 * `() => { }` with `active` hard-coded false — they could not be pressed into
 * doing anything, or into looking pressed. They went to the View menu when the
 * bottom bar was deleted; this brings them back as buttons.
 *
 * The interesting assertion is the third one. All three toggles write
 * `bottomPanel` as well as their own `show*` flag, so pressing Editors leaves
 * `showMixer` true — and a button lit from `showMixer` alone stayed lit over a
 * piano roll. Only the panel you are actually looking at may be active.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120)); });

const results = [];
const check = (name, pass, detail = '') => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('magicPro_tutorial', 'completed'));
await page.goto(`${BASE}/login`);
await page.waitForTimeout(9000);
for (let i = 0; i < 4; i++) {
    await page.fill('input[type="email"]', 'dev@example.com');
    await page.fill('input[type="password"]', 'devpassword123');
    await page.click('button[type="submit"]');
    try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 }); break; }
    catch { await page.waitForTimeout(4000); }
}
await page.waitForTimeout(2000);
await page.click('[data-section="new"]', { timeout: 90000 });
await page.waitForTimeout(500);
await page.click('[data-tile="empty"]');
await page.click('[data-choose]');
await page.waitForURL('**/project/**', { timeout: 60000 });
await page.waitForFunction(() => !!window.__projectStore, null, { timeout: 60000 });
await page.waitForTimeout(3500);

// The cluster is revealed by hovering the wordmark in the corner.
const reveal = async () => {
    await page.hover('[data-view-toggles-shell]');
    await page.waitForTimeout(350);
};
await reveal();

// ── All three are there, in the reference's order ─────────────────────────
const order = await page.evaluate(() =>
    [...document.querySelectorAll('[data-view-button]')].map(b => b.getAttribute('data-view-button')));
check('Smart Controls and Editors are in the transport bar',
    order.includes('smartControls') && order.includes('editors'), order.join(' · '));
check('and they sit either side of the Mixer button',
    order.indexOf('smartControls') === order.indexOf('mixer') - 1 &&
    order.indexOf('editors') === order.indexOf('mixer') + 1,
    order.slice(order.indexOf('smartControls'), order.indexOf('editors') + 1).join(' · '));

const named = await page.evaluate(() =>
    [...document.querySelectorAll('[data-view-button]')].every(b => !!b.getAttribute('aria-label')));
check('every view button has a name, not just an icon', named);

// ── Each one opens its own panel ──────────────────────────────────────────
const press = async (id) => {
    await reveal();
    await page.click(`[data-view-button="${id}"]`);
    await page.waitForTimeout(700);
    return page.evaluate(() => {
        const st = window.__projectStore.getState();
        return {
            panel: st.bottomPanel,
            showSmartControls: st.showSmartControls,
            showMixer: st.showMixer,
            showEditors: st.showEditors,
            lit: [...document.querySelectorAll('[data-view-button]')]
                .filter(b => b.getAttribute('aria-pressed') === 'true')
                .map(b => b.getAttribute('data-view-button')),
        };
    });
};

const smart = await press('smartControls');
check('Smart Controls opens the Smart Controls panel', smart.panel === 'smartcontrols',
    smart.panel);
check('and it is the one that lights up',
    smart.lit.includes('smartControls') && !smart.lit.includes('mixer') && !smart.lit.includes('editors'),
    `lit: ${smart.lit.join(', ') || 'none'}`);

const editors = await press('editors');
check('Editors opens the piano roll', editors.panel === 'pianoroll', editors.panel);

/*
 * The reason the active state is panel-aware. `toggleMixer` sets `showMixer`
 * and does not clear it, so after opening the Editors the mixer's flag is
 * still true — a button lit from that flag alone would still look active.
 */
check('the Mixer button is not lit while the piano roll is showing',
    !editors.lit.includes('mixer'),
    `showMixer=${editors.showMixer}, panel=${editors.panel}, lit: ${editors.lit.join(', ') || 'none'}`);
check('exactly one of the three is lit at a time',
    editors.lit.filter(id => ['smartControls', 'mixer', 'editors'].includes(id)).length === 1,
    editors.lit.join(', '));

const mixer = await press('mixer');
check('Mixer opens the mixer', mixer.panel === 'mixer', mixer.panel);
check('and takes the light back',
    mixer.lit.includes('mixer') && !mixer.lit.includes('editors'),
    `lit: ${mixer.lit.join(', ')}`);

// ── The customiser can still switch them off ──────────────────────────────
await page.evaluate(() => window.__projectStore.getState().updateControlBar({
    viewButtons: { ...window.__projectStore.getState().controlBarSettings.viewButtons, editors: false },
}));
await page.waitForTimeout(600);
await reveal();
const hidden = await page.evaluate(() => !document.querySelector('[data-view-button="editors"]'));
check('the control bar customiser can hide them like any other view button', hidden);
await page.evaluate(() => window.__projectStore.getState().updateControlBar({
    viewButtons: { ...window.__projectStore.getState().controlBarSettings.viewButtons, editors: true },
}));
await page.waitForTimeout(500);

await reveal();
const box = await (await page.$('[data-view-toggles]'))?.boundingBox();
if (box) {
    await page.screenshot({
        path: 'panel-buttons.png',
        clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 8), width: box.width + 20, height: box.height + 16 },
    });
}

// ── No dead button beside the working ones ───────────────────────────────
// Quick Help's handler is `() => { }` and it sits in this cluster.
await page.evaluate(() => window.__projectStore.getState().updateControlBar({
    viewButtons: { ...window.__projectStore.getState().controlBarSettings.viewButtons, quickHelp: true },
}));
await page.waitForTimeout(600);
await reveal();
const quickHelp = await page.evaluate(() => {
    const b = document.querySelector('[data-view-button="quickHelp"]');
    return b ? { disabled: b.disabled, title: b.title } : null;
});
check('the one button with no action is dimmed and says why',
    quickHelp?.disabled === true && /not built/i.test(quickHelp.title),
    quickHelp ? `disabled=${quickHelp.disabled}, "${quickHelp.title}"` : 'not rendered');

const ours = consoleErrors.filter(t => !/RSC payload|CLIENT_FETCH_ERROR/i.test(t));
check('no console errors', ours.length === 0, ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
