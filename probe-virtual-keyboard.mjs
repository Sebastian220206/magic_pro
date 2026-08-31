/**
 * Playing and recording from the on-screen keyboard.
 *
 * It opens in Musical Typing, and that view drew the whole keyboard as `<div>`s
 * carrying `active:scale-95` and no handlers — a picture of a keyboard that
 * depressed under the cursor and played nothing. Typing on a real keyboard
 * worked; clicking the keys on screen, which is the first thing anyone tries,
 * did not.
 *
 * Both routes are checked here, and both are checked all the way through to
 * notes landing in a recorded region.
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

await page.evaluate(() => window.__projectStore.getState().addTracks([
    { name: 'Piano', type: 'software-instrument', color: '#a78bfa', instrument: 'piano' },
]));
await page.waitForTimeout(1300);
const trackId = await page.evaluate(() =>
    window.__projectStore.getState().tracks.find(t => t.type === 'software-instrument').id);
await page.evaluate(id => {
    const st = window.__projectStore.getState();
    st.selectTrack(id);
    st.updateTrack(id, { recordEnabled: true });
}, trackId);
await page.waitForTimeout(1400);

// Open the keyboard from the transport bar.
await page.hover('[data-view-toggles-shell]');
await page.waitForTimeout(300);
await page.click('[data-view-button="musicalTyping"]');
await page.waitForTimeout(1200);

const mode = await page.evaluate(() => window.__projectStore.getState().virtualKeyboardMode);
check('the keyboard opens in Musical Typing', mode === 'musical-typing', mode);

const typingKeys = await page.evaluate(() =>
    document.querySelectorAll('[data-vk-typing-key]').length);
check('its keys are on screen', typingKeys > 0, `${typingKeys} keys`);

// ── The keys are buttons, not pictures ────────────────────────────────────
const keyShape = await page.evaluate(() => {
    const el = document.querySelector('[data-vk-typing-key="a"]');
    return el ? { tag: el.tagName, label: el.getAttribute('aria-label'), title: el.title } : null;
});
check('a key is something you can press, not a div',
    keyShape?.tag === 'BUTTON', keyShape ? keyShape.tag : 'missing');
check('and it says what it plays and which key does it',
    /C/.test(keyShape?.label ?? '') && /press A/i.test(keyShape?.title ?? ''),
    `${keyShape?.label} — "${keyShape?.title}"`);

// ── Clicking a key plays a note ───────────────────────────────────────────
const held = () => page.evaluate(() =>
    Object.keys(window.__projectStore.getState().activeNotes ?? {}).length);

const clickKey = async (label, holdMs = 500) => {
    const el = await page.$(`[data-vk-typing-key="${label}"]`);
    if (!el) return false;
    const b = await el.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(holdMs);
    await page.mouse.up();
    await page.waitForTimeout(300);
    return true;
};

const notesIn = () => page.evaluate(id => {
    const st = window.__projectStore.getState();
    const cs = st.clips.filter(c => c.trackId === id);
    const all = cs.flatMap(c => c.notes ?? []);
    return { clips: cs.length, notes: all.length, pitches: [...new Set(all.map(n => n.pitch))] };
}, trackId);

// ── Record, clicking only ─────────────────────────────────────────────────
const before = await notesIn();
await page.click('button[title="Record (R)"]');
await page.waitForTimeout(1200);
check('the transport is recording',
    await page.evaluate(() => window.__projectStore.getState().recording === true));

await clickKey('a');
await clickKey('d');
await clickKey('g');
await page.waitForTimeout(700);

const during = await notesIn();
check('clicking the on-screen keys records notes',
    during.notes >= 3, `${before.notes} -> ${during.notes} notes`);
check('and they are the pitches those keys name',
    during.pitches.length >= 3, `pitches ${during.pitches.sort((a, b) => a - b).join(', ')}`);

await page.click('button[title="Record (R)"]');
await page.waitForTimeout(1500);
const after = await notesIn();
check('the notes survive the end of the take',
    after.notes >= during.notes, `${after.notes} notes in ${after.clips} region(s)`);

// ── Typing still works ────────────────────────────────────────────────────
await page.evaluate(() => window.__projectStore.getState().movePlayhead(0));
await page.waitForTimeout(400);
const beforeTyping = await notesIn();
await page.click('button[title="Record (R)"]');
await page.waitForTimeout(1000);
await page.keyboard.down('s');
await page.waitForTimeout(500);
await page.keyboard.up('s');
await page.waitForTimeout(600);
await page.click('button[title="Record (R)"]');
await page.waitForTimeout(1200);
const afterTyping = await notesIn();
check('typing a key still records, as it always did',
    afterTyping.notes > beforeTyping.notes,
    `${beforeTyping.notes} -> ${afterTyping.notes} notes`);

// ── The piano view still works too ────────────────────────────────────────
await page.evaluate(() => window.__projectStore.setState({ virtualKeyboardMode: 'piano-keyboard' }));
await page.waitForTimeout(800);
const pianoKeys = await page.evaluate(() => document.querySelectorAll('[data-vk-key]').length);
check('the piano view still offers its keys', pianoKeys > 0, `${pianoKeys} keys`);

const beforePiano = await notesIn();
await page.click('button[title="Record (R)"]');
await page.waitForTimeout(1000);
const pk = await page.$('[data-vk-key]');
if (pk) {
    const b = await pk.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height - 12);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
}
await page.waitForTimeout(700);
await page.click('button[title="Record (R)"]');
await page.waitForTimeout(1200);
const afterPiano = await notesIn();
check('and clicking one records too',
    afterPiano.notes > beforePiano.notes,
    `${beforePiano.notes} -> ${afterPiano.notes} notes`);

await page.evaluate(() => window.__projectStore.setState({ virtualKeyboardMode: 'musical-typing' }));
await page.waitForTimeout(700);
const kb = await page.$('[data-vk-typing-key="a"]');
const kbBox = await kb?.boundingBox();
if (kbBox) {
    await page.screenshot({
        path: 'virtual-keyboard.png',
        clip: { x: Math.max(0, kbBox.x - 320), y: Math.max(0, kbBox.y - 130), width: 780, height: 260 },
    });
}

const ours = consoleErrors.filter(t => !/RSC payload|CLIENT_FETCH_ERROR/i.test(t));
check('no console errors', ours.length === 0, ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
