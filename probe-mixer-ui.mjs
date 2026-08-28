/**
 * Does every element in a channel strip fit inside the row that holds it?
 *
 * The strips were 76px wide with rows sized under their own contents: the
 * Output slot read "STERE...", and the Audio FX list — three inserts and an
 * add button in a 46px row with nothing clipping it — painted over the Sends
 * slot below. Measures the real boxes rather than eyeballing a screenshot.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 180)));

const results = [];
const check = (name, pass, detail = '') => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

await page.goto(`${BASE}/login`);
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
await page.waitForTimeout(4000);

const S = (fn, ...a) => page.evaluate(fn, ...a);

// Load a strip up the way the screenshot did: three inserts on track one.
await S(() => {
    const s = window.__projectStore.getState();
    const id = s.tracks[0].id;
    for (const type of ['compressor', 'sidechain', 'eq']) s.addPlugin(id, type);
});
await page.waitForTimeout(600);

// Open the mixer.
await S(() => {
    const s = window.__projectStore.getState();
    if (!s.showMixer) s.toggleMixer?.();
    window.__projectStore.setState({ showMixer: true });
});
await page.waitForTimeout(1500);

const strips = await S(() => document.querySelectorAll('[data-strip-row]').length);
check('the console renders its strips', strips > 0, `${strips} rows`);

// ── Nothing overflows the row it lives in ─────────────────────────────────
const overflowing = await S(() => {
    const bad = [];
    for (const row of document.querySelectorAll('[data-strip-row]')) {
        const box = row.getBoundingClientRect();
        if (box.height === 0) continue;
        for (const child of row.children) {
            const c = child.getBoundingClientRect();
            // Two pixels of tolerance for borders and sub-pixel rounding.
            if (c.bottom > box.bottom + 2 || c.right > box.right + 2) {
                bad.push(`${row.dataset.stripRow}: child ${Math.round(c.bottom - box.bottom)}px below / ${Math.round(c.right - box.right)}px right`);
            }
        }
    }
    return bad;
});
check('nothing spills out of its row', overflowing.length === 0,
    overflowing.slice(0, 3).join(' | ') || 'all rows clip their contents');

// ── Text is not truncated into ellipses ───────────────────────────────────
const clipped = await S(() => {
    const bad = [];
    for (const row of document.querySelectorAll('[data-strip-row]')) {
        for (const el of row.querySelectorAll('*')) {
            if (el.children.length > 0) continue;
            const text = (el.textContent ?? '').trim();
            if (!text) continue;
            // scrollWidth beyond clientWidth is text that had to be cut.
            if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
                bad.push(`${row.dataset.stripRow}: "${text.slice(0, 18)}" needs ${el.scrollWidth}px in ${el.clientWidth}px`);
            }
        }
    }
    return bad;
});
check('no label is cut off', clipped.length === 0,
    clipped.slice(0, 3).join(' | ') || 'every label fits its box');

// ── The legend still lines up with the strips ─────────────────────────────
const alignment = await S(() => {
    const legend = [...document.querySelectorAll('[data-legend-row]')];
    const firstStrip = document.querySelector('[data-strip-row]')?.parentElement;
    if (!firstStrip || legend.length === 0) return ['no legend or strip'];
    const rows = [...firstStrip.querySelectorAll('[data-strip-row]')];
    const bad = [];
    for (const l of legend) {
        const match = rows.find(r => r.dataset.stripRow === l.dataset.legendRow);
        if (!match) continue;
        const dl = l.getBoundingClientRect();
        const dr = match.getBoundingClientRect();
        if (Math.abs(dl.top - dr.top) > 1 || Math.abs(dl.height - dr.height) > 1) {
            bad.push(`${l.dataset.legendRow}: legend ${Math.round(dl.top)}/${Math.round(dl.height)} vs strip ${Math.round(dr.top)}/${Math.round(dr.height)}`);
        }
    }
    return bad;
});
check('the legend lines up with the strips', alignment.length === 0,
    alignment.slice(0, 3).join(' | ') || 'every label sits on its row');

// ── The fader row still has room ──────────────────────────────────────────
const faderHeight = await S(() => {
    const row = document.querySelector('[data-strip-row="fader"]');
    return row ? Math.round(row.getBoundingClientRect().height) : 0;
});
check('the fader keeps a usable height', faderHeight >= 140, `${faderHeight}px`);

const stripWidth = await S(() => {
    const row = document.querySelector('[data-strip-row]');
    return row ? Math.round(row.parentElement.getBoundingClientRect().width) : 0;
});
check('the strip is wide enough to read', stripWidth >= 100, `${stripWidth}px`);

// ── The accent's opacity modifiers actually paint ─────────────────────────
// `accent-cyan` was a bare `var()` holding a hex, so Tailwind expanded
// `bg-accent-cyan/80` to `rgb(#22d3ee / 0.8)` — invalid, and an invalid
// background-color paints nothing. 184 classes across the app were affected.
const chipPaint = await S(() => {
    const chips = [...document.querySelectorAll('[data-strip-row="audioFx"] div')]
        .filter(d => d.className.includes('bg-accent-cyan'));
    if (chips.length === 0) return { count: 0, bg: 'none' };
    return { count: chips.length, bg: getComputedStyle(chips[0]).backgroundColor };
});
check('enabled insert chips have a visible background',
    chipPaint.count > 0 && chipPaint.bg !== 'rgba(0, 0, 0, 0)' && chipPaint.bg !== 'transparent',
    `${chipPaint.count} chips, background ${chipPaint.bg}`);

const opacityClasses = await S(() => {
    // Sample every element carrying an accent or studio class with an opacity
    // modifier, and count how many resolve to fully transparent.
    const bad = [];
    for (const el of document.querySelectorAll('*')) {
        const cls = typeof el.className === 'string' ? el.className : '';
        if (!cls) continue;
        // Only unconditional classes. `hover:bg-accent-cyan/50` is meant to be
        // transparent until hovered, so counting it would be a false alarm.
        const unconditional = cls.split(/\s+/).filter(c => !c.includes(':'));
        const painted = unconditional.find(c => /^bg-(accent-cyan|studio-[a-z-]+)\/\d+$/.test(c));
        if (!painted) continue;
        if (getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)') bad.push(painted);
    }
    return [...new Set(bad)];
});
check('no opacity-modified accent class paints transparent',
    opacityClasses.length === 0,
    opacityClasses.slice(0, 4).join(', ') || 'every sampled class resolves to a colour');

await page.screenshot({ path: 'mixer-ui.png' });

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
