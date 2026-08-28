/**
 * The dashboard, section by section.
 *
 * A `ProjectChooser` component already existed with this layout and was
 * rendered nowhere — and its content was invented: two "recent" projects that
 * were nobody's, three demos ("Beck - Morning", "Billie Eilish - Ocean Eyes")
 * under ids that resolved to nothing, and six templates unrelated to the five
 * the app can build. Wiring it up as-was would have shipped a screen where
 * most things did nothing.
 *
 * So this checks the opposite: every enabled section shows something real, the
 * two that cannot say why, and Choose actually makes a project.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
// Headless Chrome reports `prefers-reduced-motion: reduce` by default, and
// BackgroundVideo correctly refuses to mount the loop under it — so without
// this the backdrop check would be measuring the fallback and calling it a
// pass.
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, reducedMotion: 'no-preference' });
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));

const results = [];
const check = (name, pass, detail = '') => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

await page.goto(`${BASE}/login`);
await page.waitForTimeout(9000);
for (let i = 0; i < 4; i++) {
    await page.fill('input[type="email"]', 'dev@example.com');
    await page.fill('input[type="password"]', 'devpassword123');
    await page.click('button[type="submit"]');
    try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 }); break; }
    catch { await page.waitForTimeout(4000); }
}
await page.goto(`${BASE}/dashboard`);
await page.waitForTimeout(4000);

// ── The sidebar ───────────────────────────────────────────────────────────
const sections = await page.evaluate(() =>
    [...document.querySelectorAll('[data-section]')].map(e => ({
        id: e.getAttribute('data-section'),
        label: e.textContent.trim(),
        title: e.getAttribute('title'),
    })));
const want = ['new', 'recent', 'liveLoops', 'tutorials', 'demos', 'templates', 'account'];
check('every category is in the sidebar, in order',
    sections.map(s => s.id).join() === want.join(),
    sections.map(s => s.label).join(' · '));
check('Account comes after Project Templates',
    sections.findIndex(s => s.id === 'account') === sections.findIndex(s => s.id === 'templates') + 1);

// ── New Project ───────────────────────────────────────────────────────────
const tiles = await page.evaluate(() =>
    [...document.querySelectorAll('[data-tile]')].map(e => e.getAttribute('data-tile')));
check('New Project offers Empty Project and Live Loops',
    tiles.includes('empty') && tiles.includes('liveloops'), tiles.join(', '));

const details = await page.evaluate(() =>
    document.querySelector('[data-details]')?.textContent?.trim() ?? '');
check('the Details strip describes what is selected', details.length > 20, details.slice(0, 70));

// ── Project Templates: the real catalogue, not six invented ones ──────────
await page.click('[data-section="templates"]');
await page.waitForTimeout(700);
const tplTiles = await page.evaluate(() =>
    [...document.querySelectorAll('[data-tile]')].map(e => e.getAttribute('data-tile')));
const invented = ['Hip Hop', 'Electronic', 'Songwriter', 'Orchestral', 'Multi-Track', 'Music For Picture'];
check('Project Templates lists the templates that actually exist',
    tplTiles.length === 5 && !tplTiles.some(t => invented.includes(t)),
    tplTiles.join(', '));

// ── The two with nothing behind them say so ───────────────────────────────
for (const [id, word] of [['liveLoops', /not marked as Live Loops/i], ['demos', /No demo projects/i]]) {
    await page.click(`[data-section="${id}"]`);
    await page.waitForTimeout(500);
    const msg = await page.evaluate(() =>
        document.querySelector('[data-unavailable]')?.textContent?.trim() ?? '');
    check(`${id} explains why it is empty`, word.test(msg), msg.slice(0, 76));
}

// ── Tutorials is a real tour ──────────────────────────────────────────────
await page.click('[data-section="tutorials"]');
await page.waitForTimeout(500);
check('Tutorials offers the tour that exists',
    await page.evaluate(() => !!document.querySelector('[data-run-tutorial]')));

// ── Recent shows the user's own projects ──────────────────────────────────
await page.click('[data-section="recent"]');
await page.waitForTimeout(2500);
const recent = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-project]')];
    return { count: rows.length, names: rows.slice(0, 3).map(r => r.textContent.split('\n')[0].trim()),
             emptyMsg: document.body.innerText.includes('Nothing here yet') };
});
const fabricated = ['Neon Sunset', 'Acoustic Idea', 'Beck - Morning'];
check('Recent shows real projects, none of the invented ones',
    !recent.names.some(n => fabricated.some(f => n.includes(f))),
    recent.count > 0 ? `${recent.count}: ${recent.names.join(', ')}` : 'empty, with an explanation');

// ── Account ───────────────────────────────────────────────────────────────
await page.click('[data-section="account"]');
await page.waitForTimeout(800);
const account = await page.evaluate(() => ({
    email: document.querySelector('[data-account-email]')?.textContent?.trim(),
    name: document.querySelector('[data-account-name]')?.textContent?.trim(),
    signOut: !!document.querySelector('[data-sign-out]'),
}));
check('Account shows who is signed in', account.email === 'dev@example.com',
    `${account.name} / ${account.email}`);
check('and offers Sign out', account.signOut === true);

// A primary button with nothing to act on is exactly the control this
// codebase keeps removing: Account has no project to choose.
check('Account offers no dead Choose button',
    await page.evaluate(() => !document.querySelector('[data-choose]')));

// ── The loop from the old dashboard is still there ───────────────────────
// It backed a greeting strip that this layout does not have; it backs the
// chooser now. The fallback renders when no URL is configured or when the
// visitor asked for reduced motion, so the check is that the backdrop layer
// exists and sits behind the content rather than that a <video> is playing.
const backdrop = await page.evaluate(() => {
    const main = document.querySelector('main');
    const layer = main?.querySelector(':scope > .isolate, :scope > [class*="absolute inset-0"]');
    const video = main?.querySelector('video');
    const tiles = document.querySelector('[data-tile]');
    return {
        layer: !!layer,
        video: !!video,
        videoSrc: video?.getAttribute('src')?.slice(0, 48) ?? null,
        // The scrolling content pane must sit above the footage, not behind it.
        // Read from the pane itself: Account has no tiles to measure.
        paneZ: (() => {
            const pane = main?.querySelector(':scope > div[class*="overflow-y-auto"]');
            return pane ? getComputedStyle(pane).zIndex : null;
        })(),
        // The z-0 layer is the wrapper that positions the loop, not the
        // component's own root.
        videoZ: video ? getComputedStyle(video.closest('main > div')).zIndex : null,
        readyState: video?.readyState ?? null,
        // Height, because the loop once played at opacity 1 and readyState 4
        // inside a box zero pixels tall — every other signal said it was fine.
        box: video ? { w: Math.round(video.getBoundingClientRect().width),
                       h: Math.round(video.getBoundingClientRect().height) } : null,
        opacity: video ? getComputedStyle(video).opacity : null,
        reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
});
check('the dashboard keeps its background loop',
    backdrop.layer && backdrop.video && (backdrop.box?.h ?? 0) > 200,
    backdrop.video
        ? `${backdrop.box?.w}x${backdrop.box?.h}, readyState ${backdrop.readyState}, opacity ${backdrop.opacity}`
        : `no video element (reduced-motion ${backdrop.reduced})`);
check('and the chooser sits above it',
    backdrop.paneZ === '10' && backdrop.videoZ === '0',
    `content z=${backdrop.paneZ}, footage z=${backdrop.videoZ}`);

await page.screenshot({ path: 'dashboard-account.png' });
await page.click('[data-section="new"]');
// Give the loop time to buffer: BackgroundVideo holds it at opacity 0 until
// `canplay`, so a shot taken too early shows an empty pane and proves nothing.
await page.waitForFunction(() => {
    const v = document.querySelector('main video');
    return !v || v.readyState >= 3;
}, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: 'dashboard-new.png' });

// ── On Recent it opens rather than creates ───────────────────────────────
await page.click('[data-section="recent"]');
await page.waitForTimeout(1200);
const recentChoose = await page.evaluate(() => {
    const b = document.querySelector('[data-choose]');
    return { present: !!b, label: b?.textContent?.trim(), disabled: b?.disabled };
});
check('Recent offers Open on the most recent project',
    recentChoose.present && recentChoose.label === 'Open',
    JSON.stringify(recentChoose));

// ── Choose actually creates a project ─────────────────────────────────────
await page.click('[data-section="new"]');
await page.waitForTimeout(700);
await page.click('[data-tile="empty"]');
await page.waitForTimeout(300);
await page.click('[data-choose]');
await page.waitForURL('**/project/**', { timeout: 90000 }).catch(() => {});
check('Choose creates the project and opens the studio',
    page.url().includes('/project/'), page.url().replace(BASE, ''));

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
