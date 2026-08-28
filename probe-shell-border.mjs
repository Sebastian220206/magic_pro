/**
 * Does the neon frame sit on the viewport edge?
 *
 * It was inset by 16px of padding, which is the gap the screenshot marked in
 * red. Measures the frame's box against the viewport rather than judging a
 * picture of it.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const W = 1600, H = 1000;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
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

const box = await page.evaluate(() => {
    const el = document.querySelector('.daw-shell');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
        top: Math.round(r.top), left: Math.round(r.left),
        right: Math.round(window.innerWidth - r.right),
        bottom: Math.round(window.innerHeight - r.bottom),
        width: Math.round(r.width), height: Math.round(r.height),
        borderWidth: s.borderTopWidth,
        borderColor: s.borderTopColor,
        accent: getComputedStyle(document.documentElement).getPropertyValue('--accent-cyan').trim(),
        radius: s.borderTopLeftRadius,
        shadow: s.boxShadow,
        viewport: { w: window.innerWidth, h: window.innerHeight },
    };
});

if (!box) {
    check('the neon frame is on the page', false, '.daw-shell not found');
} else {
    check('flush against the top and left', box.top === 0 && box.left === 0,
        `top ${box.top}px, left ${box.left}px`);
    check('flush against the right and bottom', box.right === 0 && box.bottom === 0,
        `right ${box.right}px, bottom ${box.bottom}px`);
    check('fills the viewport', box.width === box.viewport.w && box.height === box.viewport.h,
        `${box.width}x${box.height} in ${box.viewport.w}x${box.viewport.h}`);
    check('still has its 5px neon edge', box.borderWidth === '5px', box.borderWidth);
    check('the edge is the full accent cyan, not a dimmed one',
        box.borderColor === 'rgb(34, 211, 238)',
        `${box.borderColor} (--accent-cyan is ${box.accent})`);
    // An outward glow at the screen edge is clipped and invisible; the bloom
    // has to point inward to survive.
    check('its glow points inward, so it survives at the edge',
        (box.shadow.match(/inset/g) ?? []).length >= 3,
        `${(box.shadow.match(/inset/g) ?? []).length} inset layers`);
}

await page.screenshot({ path: 'shell-border.png' });
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
