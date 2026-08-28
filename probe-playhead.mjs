/**
 * The playhead's head is a handle, not a dead zone.
 *
 * It carried `pointer-events: auto` with no handler bound to it, so pressing
 * the one part of the playhead that looks grabbable did nothing at all — the
 * press landed on the SVG and stopped there. This presses the head itself and
 * checks the playhead actually moved; a probe that called `movePlayhead`
 * directly would pass either way.
 */
import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 3 });
// The tour is up on a fresh project and lays a 40% black scrim over the
// whole studio, so anything measured or shot through it reads darker than
// it renders for anyone past onboarding.
await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('magicPro_tutorial', 'completed'));
await page.goto(`${BASE}/login`);
await page.waitForTimeout(8000);
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
await page.waitForTimeout(3500);

await page.evaluate(() => window.__projectStore.getState().movePlayhead(12));
await page.waitForTimeout(600);

const results = [];
const check = (name, pass, detail = '') => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const geom = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('.studio-playhead')];
    const svg = document.querySelector('.studio-playhead svg');
    const r = svg?.getBoundingClientRect();
    const ruler = document.querySelector('.studio-playhead')?.parentElement?.getBoundingClientRect();
    const numbers = [...document.querySelectorAll('span.tabular-nums')]
        .map(e => e.getBoundingClientRect()).filter(b => b.width > 0);
    return {
        scrim: [...document.querySelectorAll('div')].filter(d => {
            const c = getComputedStyle(d);
            return c.position === 'fixed' || c.position === 'absolute'
                ? /rgba\(0, 0, 0, 0\.[2-9]/.test(c.backgroundColor) && d.getBoundingClientRect().width > 1200
                : false;
        }).length,
        line: getComputedStyle(heads[0]).boxShadow,
        head: r ? { x: r.x, y: r.y, w: r.width, h: r.height, pe: getComputedStyle(svg).pointerEvents } : null,
        // The tip should land on the ruler's lower edge.
        tipToRulerBottom: r && ruler ? Math.round((ruler.bottom - (r.y + r.height)) * 10) / 10 : null,
        // And it must clear the bar-number row above it.
        overlapsNumbers: r ? numbers.some(n => n.bottom > r.y && n.top < r.bottom &&
                                               n.right > r.x && n.left < r.x + r.width) : true,
        atCentre: r ? (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.tagName ?? '?') : '?',
    };
});

check('nothing is dimming what this measures', geom.scrim === 0,
    geom.scrim ? `${geom.scrim} scrim(s) over the studio` : 'clear');
check('the head no longer swallows the press',
    geom.head?.pe === 'none', `pointer-events: ${geom.head?.pe}`);
check('the tip sits on the ruler baseline',
    geom.tipToRulerBottom !== null && Math.abs(geom.tipToRulerBottom) <= 1,
    `${geom.tipToRulerBottom}px from it`);
check('and it clears the bar numbers', !geom.overlapsNumbers);

// The line is one pixel of line, not three.
const solidRing = /0px 0px 0px 1px/.test(geom.line);
check('the line has no solid ring painting two extra pixels', !solidRing,
    geom.line.slice(0, 70));

// ── Press the head and see whether the playhead follows ───────────────────
const before = await page.evaluate(() => window.__projectStore.getState().playhead);
await page.mouse.move(geom.head.x + geom.head.w / 2, geom.head.y + 3);
await page.mouse.down();
await page.mouse.move(geom.head.x + geom.head.w / 2 + 120, geom.head.y + 3, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(400);
const after = await page.evaluate(() => window.__projectStore.getState().playhead);
check('dragging the head scrubs', after > before + 0.5,
    `beat ${before.toFixed(2)} -> ${after.toFixed(2)}`);

await page.evaluate(() => window.__projectStore.getState().movePlayhead(12));
await page.waitForTimeout(400);
const svg = await page.$('.studio-playhead svg');
const b = await svg.boundingBox();
await page.screenshot({ path: 'playhead-now.png', clip: { x: b.x - 40, y: b.y - 40, width: 120, height: 100 } });

const failed = results.filter(r => !r).length;
console.log(`
${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
