/**
 * The EQ and gain-reduction slots in a mixer strip open their plug-ins.
 *
 * Both were read-only pictures with no way into the thing they stand for: the
 * gain-reduction slot was an empty box, and the EQ slot drew
 * `M0,22 Q30,4 60,26 T100,17` — the same fixed squiggle on every strip,
 * identical for a flat channel and a heavily shaped one.
 *
 * Driven by clicking; the store is read only to confirm what the clicks did.
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

await page.evaluate(() => {
    window.__projectStore.getState().addTracks([
        { name: 'Drummer 1', type: 'drummer', color: '#fb923c' },
        { name: 'Inst 1', type: 'software-instrument', color: '#a78bfa', instrument: 'piano' },
    ]);
});
await page.waitForTimeout(1500);

// Open the mixer from the transport bar.
await page.hover('[data-view-toggles-shell]');
await page.waitForTimeout(300);
await page.click('[data-view-button="mixer"]');
await page.waitForTimeout(1500);

const slots = await page.evaluate(() => ({
    eq: document.querySelectorAll('[data-strip-slot="eq"]').length,
    gr: document.querySelectorAll('[data-strip-slot="gainReduction"]').length,
}));
check('the mixer shows an EQ slot and a gain-reduction slot per strip',
    slots.eq > 0 && slots.gr > 0, `${slots.eq} EQ, ${slots.gr} gain reduction`);

const plugins = () => page.evaluate(() => {
    const st = window.__projectStore.getState();
    const t = st.tracks.find(x => x.name === 'Drummer 1');
    return (t?.plugins ?? []).map(p => p.pluginId ?? p.type);
});
const editorOpen = () => page.evaluate(() => window.__projectStore.getState().openPluginEditor);

// ── The EQ slot ───────────────────────────────────────────────────────────
check('the strip starts with no plug-ins', (await plugins()).length === 0);

await page.click('[data-strip-slot="eq"]');
await page.waitForTimeout(1200);
const afterEq = await plugins();
check('clicking the EQ area inserts a channel EQ',
    afterEq.some(id => /eq/i.test(id)), afterEq.join(', ') || 'none');
const eqEditor = await editorOpen();
check('and opens its editor', !!eqEditor, JSON.stringify(eqEditor));
check('the editor on screen is the EQ',
    await page.evaluate(() => /equali|channel eq/i.test(document.body.innerText)));

// Clicking again must open the one that exists, not add a second.
await page.evaluate(() => window.__projectStore.getState().setOpenPluginEditor(null));
await page.waitForTimeout(600);
await page.click('[data-strip-slot="eq"]');
await page.waitForTimeout(1200);
const afterSecondEq = await plugins();
check('clicking it again opens the same EQ rather than adding another',
    afterSecondEq.filter(id => /eq/i.test(id)).length === 1 && !!(await editorOpen()),
    afterSecondEq.join(', '));

// ── The thumbnail follows the bands ───────────────────────────────────────
const flatPath = await page.evaluate(() =>
    document.querySelector('[data-strip-slot="eq"] path')?.getAttribute('d'));
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const t = st.tracks.find(x => x.name === 'Drummer 1');
    const eq = t.plugins.find(p => /eq/i.test(p.pluginId ?? p.type));
    st.updatePluginParams(t.id, eq.id, { band5_gain: 12, band2_gain: -9 });
});
await page.waitForTimeout(1000);
const shapedPath = await page.evaluate(() =>
    document.querySelector('[data-strip-slot="eq"] path')?.getAttribute('d'));
check('the EQ thumbnail redraws when the bands change',
    !!shapedPath && shapedPath !== flatPath,
    `${String(flatPath).slice(0, 28)}… -> ${String(shapedPath).slice(0, 28)}…`);

// A strip with no EQ must not draw a curve that implies one.
const otherPath = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-strip-slot="eq"] path')];
    return els.at(-1)?.getAttribute('d');
});
check('a strip with no EQ draws a flat line, not a curve',
    /^M0 \d+(\.\d+)? L100 \d+/.test(otherPath ?? ''), otherPath);

// ── The gain-reduction slot ───────────────────────────────────────────────
await page.evaluate(() => window.__projectStore.getState().setOpenPluginEditor(null));
await page.waitForTimeout(500);
await page.click('[data-strip-slot="gainReduction"]');
await page.waitForTimeout(1200);
const afterComp = await plugins();
check('clicking the gain-reduction area inserts a compressor',
    afterComp.some(id => /compress/i.test(id)), afterComp.join(', '));
check('and opens its editor', !!(await editorOpen()));
check('the editor on screen is the compressor',
    await page.evaluate(() => /compressor/i.test(document.body.innerText)));

await page.evaluate(() => window.__projectStore.getState().setOpenPluginEditor(null));
await page.waitForTimeout(500);
await page.click('[data-strip-slot="gainReduction"]');
await page.waitForTimeout(1200);
check('clicking it again opens the same compressor rather than adding another',
    (await plugins()).filter(id => /compress/i.test(id)).length === 1);

// ── Both say what they are ────────────────────────────────────────────────
const labels = await page.evaluate(() => ({
    eq: document.querySelector('[data-strip-slot="eq"]')?.getAttribute('aria-label'),
    gr: document.querySelector('[data-strip-slot="gainReduction"]')?.getAttribute('title'),
}));
check('the EQ slot has an accessible name', !!labels.eq, labels.eq);
// The meter genuinely has nothing to show yet; the title must still say so.
check('the gain-reduction slot is honest about its empty meter',
    /not reported/i.test(labels.gr ?? ''), labels.gr);

await page.evaluate(() => window.__projectStore.getState().setOpenPluginEditor(null));
await page.waitForTimeout(600);
const eqBox = await (await page.$('[data-strip-slot="eq"]'))?.boundingBox();
if (eqBox) {
    await page.screenshot({
        path: 'strip-slots.png',
        clip: { x: 0, y: Math.max(0, eqBox.y - 60), width: 760, height: 190 },
    });
}

const ours = consoleErrors.filter(t => !/RSC payload|CLIENT_FETCH_ERROR/i.test(t));
check('no console errors', ours.length === 0, ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
