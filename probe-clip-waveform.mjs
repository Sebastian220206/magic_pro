/**
 * The clip, and the waveform inside it.
 *
 * What it was: a hundred hairline strokes with `fill="none"` — so never a body
 * — point-sampled and fixed at 100 columns whatever the width; a name on a
 * `bg-black/35` bar whose `h-4.5` is not a Tailwind class, so it collapsed
 * while the media area reserved 18px for it; `shadow-2xl` under a translucent
 * card; and, when a clip had no peaks at all, two hard-coded zig-zags standing
 * in for audio that does not exist.
 *
 * The peaks here are deliberately asymmetric — max 0.9, min -0.15 — because a
 * mirrored renderer would draw them symmetrically and pass a symmetric test.
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

// Two audio tracks: one clip with peaks, one with none.
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    st.addTracks([
        { name: 'Vocals', type: 'audio', color: '#ec4899' },
        { name: 'Broken Import', type: 'audio', color: '#22d3ee' },
    ]);
});
await page.waitForTimeout(1500);

await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const [a, b] = st.tracks.filter(t => t.type === 'audio');

    const n = 1000;
    const min = new Float32Array(n);
    const max = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const env = Math.sin((i / n) * Math.PI);
        // Deliberately lopsided: a mirrored renderer would hide this.
        max[i] = 0.9 * env;
        min[i] = -0.15 * env;
    }

    const base = (track, extra) => ({
        trackId: track.id, type: 'audio', color: track.color,
        alternativeId: track.activeAlternativeId,
        start: 0, startTime: 0, startBeat: 0, duration: 8, offset: 0,
        muted: false, loop: false, qSwing: 0, transpose: 0, velocityOffset: 0,
        fadeIn: { duration: 0, curve: 'linear', gain: 1 },
        fadeOut: { duration: 0, curve: 'linear', gain: 1 },
        playbackRate: 1, pitchOffset: 0, stretchMode: 'none',
        ...extra,
    });

    st.addClip(base(a, {
        id: 'probe-with-peaks', name: 'Lead Vocal',
        waveformPeaks: { channels: [{ min, max }], resolution: n, durationSeconds: 4, numChannels: 1 },
    }));
    st.addClip(base(b, { id: 'probe-no-peaks', name: 'Failed Import' }));
});
await page.waitForTimeout(2000);

// ── A filled shape, not a hundred hairlines ───────────────────────────────
const filled = await page.evaluate(() => {
    const svg = document.querySelector('[data-waveform]');
    const path = svg?.querySelector('path');
    return {
        present: !!path,
        fill: path?.getAttribute('fill'),
        d: path?.getAttribute('d') ?? '',
        aspect: svg?.getAttribute('preserveAspectRatio'),
        viewBox: svg?.getAttribute('viewBox'),
    };
});
check('the waveform is one filled path', filled.present && filled.fill !== 'none',
    `fill=${filled.fill}`);
check('closed, so it has a body', filled.d.startsWith('M') && filled.d.endsWith('Z'));
check('and its viewBox matches its box, with no aspect override',
    filled.aspect === null && /^0 0 \d+ \d+$/.test(filled.viewBox ?? ''),
    `viewBox="${filled.viewBox}" preserveAspectRatio=${filled.aspect}`);

// ── Honest about asymmetry ────────────────────────────────────────────────
const shape = await page.evaluate(() => {
    const svg = document.querySelector('[data-waveform]');
    const d = svg.querySelector('path').getAttribute('d');
    const h = Number(svg.getAttribute('viewBox').split(' ')[3]);
    const v = [...d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map(m => Number(m[2]));
    const n = v.length / 2;
    const top = v.slice(0, n);
    const bottom = v.slice(n);
    const mid = h / 2;
    const avg = a => a.reduce((s, y) => s + y, 0) / a.length;
    return { above: mid - avg(top), below: avg(bottom) - mid, columns: n };
});
check('the loud half is drawn further from the centre than the quiet half',
    shape.above > shape.below * 2,
    `${shape.above.toFixed(1)}px above vs ${shape.below.toFixed(1)}px below — a mirror makes these equal`);

// ── The column count follows the width ────────────────────────────────────
const before = shape.columns;
await page.evaluate(() => window.__projectStore.getState().setZoom?.(200)
    ?? window.__projectStore.setState({ zoom: 200 }));
await page.waitForTimeout(1200);
const after = await page.evaluate(() => {
    const d = document.querySelector('[data-waveform] path').getAttribute('d');
    return [...d.matchAll(/[ML]/g)].length / 2;
});
check('zooming in draws more columns, not the same hundred',
    after > before, `${before} -> ${after} columns`);
await page.evaluate(() => window.__projectStore.setState({ zoom: 80 }));
await page.waitForTimeout(800);

// ── The clip's chrome ─────────────────────────────────────────────────────
const chrome = await page.evaluate(() => {
    const svg = document.querySelector('[data-waveform]');
    const clip = svg.closest('div[style*="width"]');
    const cs = getComputedStyle(clip);
    const label = [...clip.querySelectorAll('span')]
        .find(s => s.textContent.trim() === 'Lead Vocal');
    return {
        shadow: cs.boxShadow,
        bgImage: cs.backgroundImage,
        labelBg: label ? getComputedStyle(label.parentElement).backgroundColor : null,
        labelTransform: label ? getComputedStyle(label).textTransform : null,
        labelHeight: label ? Math.round(label.parentElement.getBoundingClientRect().height) : 0,
    };
});
check('no outer drop shadow under the card',
    chrome.shadow === 'none' || chrome.shadow.split(/,(?![^(]*\))/).every(l => l.includes('inset')),
    chrome.shadow.slice(0, 60));
check('and no hard-coded white-to-black sheen',
    !chrome.bgImage.includes('rgba(255, 255, 255, 0.07)'),
    chrome.bgImage.slice(0, 60));
check('the name has no black bar behind it',
    chrome.labelBg === 'rgba(0, 0, 0, 0)', chrome.labelBg);
check('it is sentence case', chrome.labelTransform === 'none', chrome.labelTransform);
check('and its row has a real height, not a collapsed h-4.5',
    chrome.labelHeight >= 14, `${chrome.labelHeight}px`);

// ── A clip with no peaks says so, rather than inventing them ──────────────
const missing = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-waveform-missing]')];
    return {
        count: els.length,
        title: els[0]?.querySelector('title')?.textContent ?? '',
        paths: els[0]?.querySelectorAll('path').length ?? -1,
        dashed: !!els[0]?.querySelector('line')?.getAttribute('stroke-dasharray'),
    };
});
check('a clip with no peaks is marked as such', missing.count === 1, `${missing.count} found`);
check('it draws no waveform at all', missing.paths === 0, `${missing.paths} paths`);
check('and says why', /could not be decoded/i.test(missing.title), missing.title);
check('dashed, so it cannot be mistaken for silence', missing.dashed);

await page.screenshot({ path: 'clip-waveform.png', clip: { x: 280, y: 100, width: 1100, height: 300 } });

const ours = consoleErrors.filter(t => !/RSC payload/i.test(t));
check('no console errors', ours.length === 0, ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
