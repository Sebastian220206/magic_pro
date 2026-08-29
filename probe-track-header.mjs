/**
 * The track header, as a colour card.
 *
 * What it was: a track's colour appeared in exactly two places — a 4px stripe
 * and a 9px number — so six tracks looked identical at a glance. Selection was
 * drawn with `from-accent-cyan/20/40`, a double opacity modifier Tailwind
 * cannot compile, so selecting a row rendered `transparent → black` and made it
 * *darker*. A permanent 32px groove column and an ungated 3px "Control Surface
 * Bar" — no state, no flag, no handler — sat in front of everything.
 *
 * Driven by clicking. The store is read to confirm outcomes, and used only to
 * seed tracks, which Empty Project deliberately does not create.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const COLOURS = ['#ec4899', '#22d3ee', '#4ade80', '#fb923c', '#a78bfa', '#e879f9'];
const NAMES = ['Vocals', 'Synth Lead', 'Bassline', 'Drums', 'Pads', 'FX'];

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

await page.evaluate(([names, colours]) => {
    window.__projectStore.getState().addTracks(
        names.map((name, i) => ({ name, type: 'software-instrument', color: colours[i] })),
    );
}, [NAMES, COLOURS]);
await page.waitForTimeout(2000);

// ── The default row height ────────────────────────────────────────────────
const heights = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.track-row')];
    return {
        stored: window.__projectStore.getState().trackHeight,
        rows: rows.map(r => Math.round(r.getBoundingClientRect().height)),
    };
});
check('a fresh project uses the taller row', heights.stored === 88, `${heights.stored}px`);
check('and every row is exactly that tall',
    heights.rows.length > 0 && heights.rows.every(h => h === heights.stored),
    heights.rows.join(', '));

// ── The card carries the track's colour ───────────────────────────────────
const cards = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-track-card]')];
    return els.map(e => {
        const cs = getComputedStyle(e);
        return { bg: cs.backgroundColor, border: cs.borderTopColor, radius: cs.borderTopLeftRadius };
    });
});
check('every track has a card', cards.length >= 6, `${cards.length} cards`);
// A computed-colour comparison cannot pass by accident the way a class check can.
const distinct = new Set(cards.map(c => c.bg)).size;
check('differently-coloured tracks get differently-coloured cards',
    distinct >= 5, `${distinct} distinct backgrounds across ${cards.length} cards`);
check('the cards are rounded', cards.every(c => parseFloat(c.radius) > 0), cards[0]?.radius);

// ── Separated visually, flush arithmetically ──────────────────────────────
const geometry = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.track-row')].map(r => r.getBoundingClientRect());
    const cds = [...document.querySelectorAll('[data-track-card]')].map(c => c.getBoundingClientRect());
    return {
        rowGap: rows.length > 1 ? Math.round(rows[1].top - rows[0].bottom) : null,
        cardGap: cds.length > 1 ? Math.round(cds[1].top - cds[0].bottom) : null,
    };
});
check('the rows stay flush, so the lanes still line up', geometry.rowGap === 0,
    `${geometry.rowGap}px between rows`);
check('while the cards are visibly separated', (geometry.cardGap ?? 0) >= 4,
    `${geometry.cardGap}px between cards`);

// ── The number and the name ───────────────────────────────────────────────
const typography = await page.evaluate(() => {
    const nums = [...document.querySelectorAll('[data-track-number]')];
    const names = [...document.querySelectorAll('[data-track-name]')];
    return {
        numbers: nums.map(n => n.textContent.trim()),
        numberSize: nums[0] ? parseFloat(getComputedStyle(nums[0]).fontSize) : 0,
        nameSize: names[0] ? parseFloat(getComputedStyle(names[0]).fontSize) : 0,
        transform: names[0] ? getComputedStyle(names[0]).textTransform : '',
        texts: names.map(n => n.textContent.trim()),
        stored: window.__projectStore.getState().tracks.map(t => t.name),
    };
});
check('the numbers are two digits from 01', typography.numbers.slice(0, 3).join(',') === '01,02,03',
    typography.numbers.join(' '));
check('and large enough to read', typography.numberSize >= 15, `${typography.numberSize}px`);
check('the name is bigger', typography.nameSize >= 14, `${typography.nameSize}px`);
// CSS uppercase would make the rendered text differ from the stored name.
check('and in sentence case, not CSS-uppercased',
    typography.transform === 'none' &&
    typography.texts.every(t => typography.stored.includes(t)),
    `text-transform: ${typography.transform} — "${typography.texts[1]}"`);

// ── The pills ─────────────────────────────────────────────────────────────
const pills = await page.evaluate(() => {
    const row = document.querySelectorAll('.track-row')[1];
    const els = [...row.querySelectorAll('[data-track-action]')];
    return {
        actions: els.map(e => e.getAttribute('data-track-action')),
        radius: els[0] ? getComputedStyle(els[0]).borderTopLeftRadius : '0px',
        labelled: els.every(e => !!e.getAttribute('aria-label')),
    };
});
check('five pills, the ones the default config shows',
    pills.actions.length === 5, pills.actions.join(', '));
check('rounded into pills', parseFloat(pills.radius) >= 8, pills.radius);
check('and every one has an accessible name', pills.labelled);

// ── Behaviour preserved: click, and the swipe across tracks ───────────────
const trackIds = await page.evaluate(() =>
    window.__projectStore.getState().tracks.map(t => t.id));
await page.click(`[data-track-action="muted"][data-track-id="${trackIds[1]}"]`);
await page.waitForTimeout(400);
check('clicking a pill still flips the store',
    await page.evaluate(id => !!window.__projectStore.getState().tracks.find(t => t.id === id).muted, trackIds[1]));

// The swipe now has to cross a 6px gutter between two cards.
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    st.tracks.forEach(t => { if (t.muted) st.updateTrack(t.id, { muted: false }); });
});
await page.waitForTimeout(400);
const mute2 = await page.$(`[data-track-action="muted"][data-track-id="${trackIds[2]}"]`);
const mute3 = await page.$(`[data-track-action="muted"][data-track-id="${trackIds[3]}"]`);
const b2 = await mute2.boundingBox();
const b3 = await mute3.boundingBox();
await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
await page.mouse.down();
await page.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 2, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(500);
const swiped = await page.evaluate(ids => {
    const st = window.__projectStore.getState();
    return ids.map(id => !!st.tracks.find(t => t.id === id).muted);
}, [trackIds[2], trackIds[3]]);
check('and the swipe-paint still crosses the gap between cards',
    swiped[0] && swiped[1], `track 3 ${swiped[0]}, track 4 ${swiped[1]}`);

// ── The config flags still govern the card ────────────────────────────────
const flagEffect = async (flag, read) => {
    const before = await page.evaluate(read);
    await page.evaluate(f => window.__projectStore.getState().updateTrackHeaderConfig({ [f]: false }), flag);
    await page.waitForTimeout(500);
    const after = await page.evaluate(read);
    await page.evaluate(f => window.__projectStore.getState().updateTrackHeaderConfig({ [f]: true }), flag);
    await page.waitForTimeout(400);
    return { before, after };
};

const numbersOff = await flagEffect('showTrackNumbers',
    () => document.querySelectorAll('[data-track-number]').length);
check('showTrackNumbers still hides the badge',
    numbersOff.before > 0 && numbersOff.after === 0,
    `${numbersOff.before} -> ${numbersOff.after}`);

const muteOff = await flagEffect('showMute',
    () => document.querySelectorAll('[data-track-action="muted"]').length);
check('showMute still hides its pill', muteOff.before > 0 && muteOff.after === 0,
    `${muteOff.before} -> ${muteOff.after}`);

// `showColorBars` used to gate a 4px stripe; it now governs the whole tint.
const tintOff = await flagEffect('showColorBars',
    () => new Set([...document.querySelectorAll('[data-track-card]')]
        .map(e => getComputedStyle(e).backgroundColor)).size);
check('showColorBars now governs the card tint',
    tintOff.before >= 5 && tintOff.after === 1,
    `${tintOff.before} distinct -> ${tintOff.after}`);

// ── Headers and lanes agree, even with a track hidden ─────────────────────
const registerBefore = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.track-row')].map(r => Math.round(r.getBoundingClientRect().height));
    return rows.length;
});
await page.evaluate(ids => {
    const st = window.__projectStore.getState();
    st.setTrackHidden(ids[2], true);
    window.__projectStore.setState({ hideViewActive: true });
}, trackIds);
await page.waitForTimeout(700);
const register = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const rows = document.querySelectorAll('.track-row').length;
    const visible = st.tracks.filter(t => !(st.hideViewActive && t.hidden)).length;
    return { rows, visible };
});
check('hiding a track removes exactly one header row',
    register.rows === registerBefore - 1 && register.rows === register.visible,
    `${registerBefore} -> ${register.rows} rows, ${register.visible} visible tracks`);
await page.evaluate(() => window.__projectStore.setState({ hideViewActive: false }));
await page.waitForTimeout(500);

// ── The broken class strings are gone ─────────────────────────────────────
const broken = await page.evaluate(() => {
    const html = document.body.innerHTML;
    return ['accent-cyan/20/40', 'accent-cyan/30/40', 'accent-cyan/20/20', 'h-4.5', 'z-25 ']
        .filter(c => html.includes(c));
});
check('no Tailwind classes that compile to nothing', broken.length === 0,
    broken.join(', ') || 'clean');

// Nothing may be clipped by the card: the volume bar and pan knob used to
// wrap onto a third row and be cut off by `overflow-hidden`.
const clipped = await page.evaluate(() => {
    const bad = [];
    for (const card of document.querySelectorAll('[data-track-card]')) {
        const cb = card.getBoundingClientRect();
        for (const el of card.querySelectorAll('[data-track-action], [data-track-name], [data-track-number], button, input')) {
            const b = el.getBoundingClientRect();
            if (b.height === 0 || b.width === 0) continue;
            if (b.bottom > cb.bottom + 0.5 || b.top < cb.top - 0.5) {
                bad.push(el.getAttribute('data-track-action') ?? el.tagName);
            }
        }
    }
    return [...new Set(bad)];
});
check('nothing is clipped by the card', clipped.length === 0,
    clipped.join(', ') || 'everything fits');

await page.screenshot({ path: 'track-header.png', clip: { x: 0, y: 100, width: 900, height: 640 } });

// Next's dev server logs an RSC prefetch fallback for /welcome that has
// nothing to do with the track header; everything else counts.
const ours = consoleErrors.filter(t => !/RSC payload/i.test(t));
check('no console errors', ours.length === 0, ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
