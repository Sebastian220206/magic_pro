/**
 * The corner reads MAGIC PRO until the cursor arrives.
 *
 * Checks the real hover behaviour rather than that the markup exists: the
 * wordmark must be visible at rest, the toggles hidden and unclickable, and
 * the swap must not move anything beside it.
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

/** Opacity and pointer-events of both layers, plus where the next thing sits. */
const readState = () => page.evaluate(() => {
    const mark = document.querySelector('[data-wordmark]');
    const toggles = document.querySelector('[data-view-toggles]');
    const shell = document.querySelector('[data-view-toggles-shell]');
    const next = shell?.nextElementSibling;
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
        markOpacity: Number(cs(mark)?.opacity ?? -1),
        togglesOpacity: Number(cs(toggles)?.opacity ?? -1),
        togglesPointer: cs(toggles)?.pointerEvents ?? '',
        markText: (mark?.textContent ?? '').replace(/\s+/g, ''),
        mText: (document.querySelector('[data-magic-button]')?.textContent ?? '').trim(),
        mOpacity: Number(cs(document.querySelector('[data-magic-button]'))?.opacity ?? -1),
        mPointer: cs(document.querySelector('[data-magic-button]'))?.pointerEvents ?? '',
        shellWidth: Math.round(shell?.getBoundingClientRect().width ?? 0),
        // Gap between the M's glyph and the A beside it. Two letters of one
        // word sit about a letter-space apart; a button next to a word does not.
        letterGap: (() => {
            const mSpan = document.querySelector('[data-magic-button] span');
            const agic = mark?.querySelector('span');
            if (!mSpan || !agic) return -1;
            const a = mSpan.getBoundingClientRect();
            const b = agic.getBoundingClientRect();
            return Math.round((b.left - a.right) * 10) / 10;
        })(),
        mBorder: cs(document.querySelector('[data-magic-button]'))?.borderTopColor ?? '',
        nextLeft: Math.round(next?.getBoundingClientRect().left ?? 0),
    };
});

// Park the cursor well away from the corner.
await page.mouse.move(900, 600);
await page.waitForTimeout(500);
const rest = await readState();

check('the corner reads MAGIC PRO at rest', rest.mText + rest.markText === 'MAGICPRO',
    `${rest.mText} + ${rest.markText}`);
check('the M is a button, not part of the fading text', rest.mText === 'M', rest.mText);
// It has to read as one word, so the M must sit a letter-space from the A —
// not a button's width away from it.
check('M and AGIC read as one word at rest',
    rest.letterGap >= -1 && rest.letterGap <= 2, `${rest.letterGap}px between the glyphs`);
check('the M wears no box at rest',
    rest.mBorder === 'rgba(0, 0, 0, 0)' || rest.mBorder.includes('transparent'), rest.mBorder);
check('the wordmark is visible at rest', rest.markOpacity === 1, `opacity ${rest.markOpacity}`);
check('the buttons are hidden at rest', rest.togglesOpacity === 0, `opacity ${rest.togglesOpacity}`);
check('and cannot be clicked while hidden', rest.togglesPointer === 'none', rest.togglesPointer);

// Now hover the corner.
await page.hover('[data-view-toggles-shell]');
await page.waitForTimeout(450);
const hovered = await readState();

check('only the letters after it fade under the cursor', hovered.markOpacity === 0,
    `opacity ${hovered.markOpacity}`);
// The whole point of splitting the M out: it must survive the swap.
check('the M takes the toggle chrome once the row shows',
    hovered.mBorder !== rest.mBorder, `${rest.mBorder} -> ${hovered.mBorder}`);
check('the M stays visible while they fade',
    hovered.mOpacity === 1 && hovered.mPointer !== 'none',
    `opacity ${hovered.mOpacity}, pointer-events ${hovered.mPointer}`);
check('and it is visible and clickable at rest too',
    rest.mOpacity === 1 && rest.mPointer !== 'none',
    `opacity ${rest.mOpacity}, pointer-events ${rest.mPointer}`);
check('the buttons fade in', hovered.togglesOpacity === 1, `opacity ${hovered.togglesOpacity}`);
check('and become clickable', hovered.togglesPointer !== 'none', hovered.togglesPointer);

// Nothing beside it may move when the layers swap.
check('the swap shifts nothing beside it',
    rest.shellWidth === hovered.shellWidth && rest.nextLeft === hovered.nextLeft,
    `width ${rest.shellWidth}->${hovered.shellWidth}, neighbour at ${rest.nextLeft}->${hovered.nextLeft}`);

// Leaving must put the wordmark back.
await page.mouse.move(900, 600);
await page.waitForTimeout(450);
const left = await readState();
check('the wordmark returns when the cursor leaves',
    left.markOpacity === 1 && left.togglesOpacity === 0,
    `mark ${left.markOpacity}, toggles ${left.togglesOpacity}`);

// Hover again for the click, since leaving hid the buttons.
await page.hover('[data-view-toggles-shell]');
await page.waitForTimeout(400);

// A revealed button must actually work through a real mouse click.
const before = await page.evaluate(() => window.__projectStore.getState().showMixer);
console.log('  children:', await page.evaluate(() =>
    [...document.querySelectorAll('[data-view-toggles] > *')].map((el, i) => {
        const icon = (el.querySelector?.('svg')?.getAttribute('class') ?? '').match(/lucide-([a-z0-9-]+)/);
        return `${i + 1}:${el.tagName.toLowerCase()}${icon ? '/' + icon[1] : ''}`;
    }).join(' ')));
// Click the mixer toggle by its icon, not by position — the group has a
// divider element in it, so counting children picks the wrong thing.
await page.click('[data-view-toggles] button:has(svg.lucide-list)');
await page.waitForTimeout(600);
const after = await page.evaluate(() => window.__projectStore.getState().showMixer);
check('a revealed button responds to a real click', before !== after, `${before} -> ${after}`);

/*
 * And the wordmark comes back after a click, too.
 *
 * A jump straight from the button to elsewhere leaves Chromium's :hover
 * latched on the re-rendered subtree, which looked like a stuck panel the
 * first time this was measured. A real cursor emits the moves in between,
 * so this walks it out the way a hand would.
 */
await page.mouse.move(900, 600, { steps: 25 });
await page.waitForTimeout(500);
const afterClickLeave = await readState();
check('the wordmark returns after clicking a button and moving away',
    afterClickLeave.markOpacity === 1 && afterClickLeave.togglesOpacity === 0,
    `mark ${afterClickLeave.markOpacity}, toggles ${afterClickLeave.togglesOpacity}`);

/*
 * Tabbing to a hidden button must still reveal it.
 *
 * The buttons stay in the tab order while transparent; without the keyboard
 * clause a keyboard user would be focusing controls they cannot see.
 */
await page.mouse.move(900, 600, { steps: 10 });
await page.waitForTimeout(300);
await page.evaluate(() => {
    const first = document.querySelector('[data-view-toggles] button');
    first?.focus({ focusVisible: true });
});
await page.keyboard.press('Tab');
await page.keyboard.press('Shift+Tab');
await page.waitForTimeout(400);
const focused = await readState();
check('tabbing to a hidden button reveals the row',
    focused.togglesOpacity === 1 && focused.markOpacity === 0,
    `mark ${focused.markOpacity}, toggles ${focused.togglesOpacity}`);

// The M must be clickable without hovering the row first.
await page.mouse.move(900, 600, { steps: 10 });
await page.waitForTimeout(400);
await page.click('[data-magic-button]');
await page.waitForTimeout(600);
const menuOpen = await page.evaluate(() => !!document.querySelector('[data-magic-menu]'));
check('clicking the M from rest opens its menu', menuOpen, String(menuOpen));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

const shell = await page.$('[data-view-toggles-shell]');
if (shell) {
    const b = await shell.boundingBox();
    const clip = { x: b.x - 10, y: b.y - 10, width: b.width + 20, height: b.height + 20 };
    // Drop the keyboard focus the check above left behind, or the "rest" shot
    // catches the row revealed.
    await page.evaluate(() => (document.activeElement)?.blur?.());
    await page.mouse.move(900, 600, { steps: 10 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'wordmark-rest.png', clip });
    await page.hover('[data-view-toggles-shell]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'wordmark-hover.png', clip });
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
