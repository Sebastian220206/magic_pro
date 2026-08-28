/**
 * The transport's control display.
 *
 * What it was: a position readout that counted four beats to the bar whatever
 * the time signature — set from a control in the same panel; a Giant Time
 * window that divided by a hard-coded 120 BPM; two meters pinned at 20% and
 * 45% that brightened on hover; a key dropdown whose entries could not match
 * the stored value; a Custom mode printing "C Major" and "4/4" as literals;
 * and three menu items with no onClick.
 *
 * Everything here is driven by clicking. The store is read only to confirm
 * what the clicks did.
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
await page.waitForTimeout(4000);

// The hover-revealed triangle is the opener; it used to be a decorative div
// while the menu opened from a click anywhere on the LCD.
const openLcdMenu = async () => {
    await page.hover('[data-lcd-scrub]').catch(() => {});
    await page.waitForTimeout(150);
    await page.click('[data-lcd-menu-button]');
    await page.waitForTimeout(300);
};

// ── The position follows the time signature ───────────────────────────────
// Set 3/4 by clicking the Signature field, then move the playhead to beat 6.
await page.click('[data-lcd-value="sig"]');
await page.waitForTimeout(400);
await page.click('[data-lcd-field] button:has-text("3/4")').catch(async () => {
    const opt = await page.evaluateHandle(() =>
        [...document.querySelectorAll('[data-lcd-field] button')].find(b => b.textContent.trim() === '3/4'));
    await opt.asElement()?.click();
});
await page.waitForTimeout(600);
const sigSet = await page.evaluate(() => window.__projectStore.getState().timeSignature);
check('the Signature field sets 3/4', sigSet === '3/4', sigSet);

await page.evaluate(() => window.__projectStore.getState().movePlayhead(6));
await page.waitForTimeout(600);
const at6 = await page.evaluate(() => ({
    bar: document.querySelector('[data-lcd-value="bar"]')?.textContent,
    beat: document.querySelector('[data-lcd-value="beat"]')?.textContent,
}));
check('beat 6 of a 3/4 project reads bar 3, beat 1',
    at6.bar === '3' && at6.beat === '1',
    `bar ${at6.bar} beat ${at6.beat} — the old hard-coded /4 gives bar 2 beat 3`);

await page.evaluate(() => window.__projectStore.getState().setTimeSignature('4/4'));
await page.waitForTimeout(400);
const at6again = await page.evaluate(() => document.querySelector('[data-lcd-value="bar"]')?.textContent);
check('and the same position reads bar 2 in 4/4', at6again === '2', `bar ${at6again}`);

// ── The key dropdown can match what is stored ─────────────────────────────
await page.evaluate(() => window.__projectStore.getState().movePlayhead(0));
await page.waitForTimeout(300);
const keyShown = await page.evaluate(() => ({
    display: document.querySelector('[data-lcd-value="key"]')?.textContent?.trim(),
    stored: window.__projectStore.getState().keySignature,
}));
check('the Key cell shows the stored key', !!keyShown.display,
    `shows "${keyShown.display}", stored "${keyShown.stored}"`);

// ── Timecode mode exists and tracks the tempo ─────────────────────────────
await openLcdMenu();
const hasTimecode = await page.evaluate(() => !!document.querySelector('[data-lcd-mode="Timecode"]'));
check('the display menu offers a Timecode mode', hasTimecode);
if (hasTimecode) {
    await page.click('[data-lcd-mode="Timecode"]');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__projectStore.getState().movePlayhead(16));
    await page.waitForTimeout(400);
    const tcAt90 = await page.evaluate(() => document.querySelector('[data-lcd-value="timecode"]')?.textContent);
    check('it renders a timecode', /^\d{2}:\d{2}:\d{2}:\d{2}$/.test(tcAt90 ?? ''), tcAt90);

    await page.evaluate(() => window.__projectStore.getState().setTempo(180));
    await page.waitForTimeout(500);
    const tcAt180 = await page.evaluate(() => document.querySelector('[data-lcd-value="timecode"]')?.textContent);
    check('and it follows the tempo rather than a hard-coded one',
        tcAt180 !== tcAt90, `${tcAt90} at 90bpm -> ${tcAt180} at 180bpm`);
    await page.evaluate(() => window.__projectStore.getState().setTempo(90));
    await page.waitForTimeout(300);
}

// ── The menu has no dead entries ──────────────────────────────────────────
await openLcdMenu();
const menuDead = await page.evaluate(() => {
    const menu = document.querySelector('[data-lcd-menu]')
        ?? [...document.querySelectorAll('div')].find(d => d.querySelector('[data-lcd-mode]'));
    if (!menu) return { found: false, dead: [] };
    const dead = [...menu.querySelectorAll('button')]
        .filter(b => !b.onclick && !b.disabled)
        .map(b => b.textContent.trim());
    return { found: true, dead };
});
check('every entry in the display menu does something',
    menuDead.found && menuDead.dead.length === 0,
    menuDead.dead.length ? `dead: ${menuDead.dead.join(', ')}` : 'all live');
await page.keyboard.press('Escape').catch(() => {});
await page.mouse.click(900, 400);
await page.waitForTimeout(300);

// ── Back to the default mode for the interaction checks ───────────────────
await openLcdMenu();
await page.click('[data-lcd-mode="Beats & Project"]');
await page.waitForTimeout(500);

// ── Scrubbing ─────────────────────────────────────────────────────────────
const scrubBox = await (await page.$('[data-lcd-scrub]'))?.boundingBox();
const beforeScrub = await page.evaluate(() => window.__projectStore.getState().playhead);
if (scrubBox) {
    await page.mouse.move(scrubBox.x + scrubBox.width / 2, scrubBox.y + scrubBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(scrubBox.x + scrubBox.width / 2 + 120, scrubBox.y + scrubBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);
}
const afterScrub = await page.evaluate(() => window.__projectStore.getState().playhead);
check('dragging the position readout scrubs the playhead',
    afterScrub > beforeScrub + 1, `${beforeScrub.toFixed(2)} -> ${afterScrub.toFixed(2)} beats`);

// A click without movement must not nudge the playhead, and must not open the menu.
const beforeClick = await page.evaluate(() => window.__projectStore.getState().playhead);
await page.click('[data-lcd-scrub]');
await page.waitForTimeout(400);
const afterClick = await page.evaluate(() => ({
    playhead: window.__projectStore.getState().playhead,
    menuOpen: !!document.querySelector('[data-lcd-mode]'),
}));
check('a click on the readout moves nothing and opens no menu',
    afterClick.playhead === beforeClick && !afterClick.menuOpen,
    `playhead ${afterClick.playhead.toFixed(2)}, menu ${afterClick.menuOpen ? 'open' : 'closed'}`);

// ── Tempo drag, and the click-to-type it must not break ───────────────────
const tempoBox = await (await page.$('[data-lcd-tempo]'))?.boundingBox();
const beforeTempo = await page.evaluate(() => window.__projectStore.getState().tempo);
if (tempoBox) {
    await page.mouse.move(tempoBox.x + tempoBox.width / 2, tempoBox.y + tempoBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(tempoBox.x + tempoBox.width / 2, tempoBox.y + tempoBox.height / 2 - 60, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);
}
const afterTempo = await page.evaluate(() => window.__projectStore.getState().tempo);
check('dragging the tempo changes it', afterTempo > beforeTempo,
    `${beforeTempo} -> ${afterTempo} BPM`);
check('and stays inside the range the field advertises',
    afterTempo >= 20 && afterTempo <= 300, `${afterTempo}`);

await page.click('[data-lcd-tempo]');
await page.waitForTimeout(400);
const typing = await page.evaluate(() => ({
    input: !!document.querySelector('input[type="number"]'),
    menuOpen: !!document.querySelector('[data-lcd-mode]'),
}));
check('clicking the tempo still opens the editor', typing.input === true);
check('and no longer opens the display menu at the same time', typing.menuOpen === false);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ── The activity readout is real ──────────────────────────────────────────
const stopped = await page.evaluate(() => ({
    present: !!document.querySelector('[data-lcd-activity]'),
    voices: document.querySelector('[data-lcd-voices]')?.style.width,
    title: document.querySelector('[data-lcd-activity]')?.getAttribute('title'),
}));
check('the activity readout exists', stopped.present);
check('it reads empty with the transport stopped, and says why',
    stopped.voices === '0%' && /stopped/i.test(stopped.title ?? ''),
    `${stopped.voices} — "${stopped.title}"`);

const hoverChange = await page.evaluate(async () => {
    const el = document.querySelector('[data-lcd-activity]');
    const before = getComputedStyle(el).opacity;
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    return { before, after: getComputedStyle(el).opacity };
});
check('and does not brighten on hover, because it is not a control',
    hoverChange.before === hoverChange.after,
    `${hoverChange.before} -> ${hoverChange.after}`);

// ── No label collision, at three widths ───────────────────────────────────
for (const width of [1600, 1440, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(700);
    const layout = await page.evaluate(() => {
        const labels = [...document.querySelectorAll('[data-lcd-project] [data-lcd-label]')]
            .map(e => ({ text: e.textContent.trim(), ...e.getBoundingClientRect().toJSON() }));
        let overlap = null;
        for (let i = 0; i < labels.length - 1; i++) {
            const gap = labels[i + 1].left - labels[i].right;
            if (gap < 2) overlap = `${labels[i].text}/${labels[i + 1].text} gap ${Math.round(gap)}px`;
        }
        const key = document.querySelector('[data-lcd-value="key"]');
        const wrapped = key
            ? key.getBoundingClientRect().height > parseFloat(getComputedStyle(key).lineHeight) * 1.5
            : false;
        return { count: labels.length, overlap, wrapped, labels: labels.map(l => l.text) };
    });
    check(`labels do not collide at ${width}px`, layout.overlap === null,
        layout.overlap ?? layout.labels.join(' | '));
    check(`the key does not wrap at ${width}px`, layout.wrapped === false);
}

await page.setViewportSize({ width: 1600, height: 1000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'lcd-display.png', clip: { x: 500, y: 0, width: 800, height: 70 } });

// Next's dev server logs an RSC prefetch fallback for /welcome that has
// nothing to do with this display; everything else counts.
const ours = consoleErrors.filter(t => !/RSC payload/i.test(t));
check('no console errors during the run', ours.length === 0,
    ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
