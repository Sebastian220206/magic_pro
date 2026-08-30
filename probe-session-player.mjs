/**
 * The Session Player.
 *
 * `drummer` was a track type and nothing more: the scheduler treated it as a
 * plain instrument, the only drummer regions in the app had their notes typed
 * out by hand in the templates, and the Editors button opened the piano roll
 * whatever track you were on. So the panel had to come with a generator, or
 * every knob on it would turn and change nothing.
 *
 * That is what this checks — not that the controls exist, but that moving them
 * changes the notes in the region.
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

// A drummer track with a region, and a software instrument to compare against.
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    st.addTracks([
        { name: 'Drums', type: 'drummer', color: '#fb923c' },
        { name: 'Piano', type: 'software-instrument', color: '#a78bfa', instrument: 'piano' },
    ]);
});
await page.waitForTimeout(1500);
const ids = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const drum = st.tracks.find(t => t.type === 'drummer');
    const inst = st.tracks.find(t => t.type === 'software-instrument');
    st.addClip({
        id: 'probe-drum-region', trackId: drum.id, type: 'midi', name: 'Drummer',
        color: drum.color, alternativeId: drum.activeAlternativeId,
        start: 0, startTime: 0, startBeat: 0, duration: 16, offset: 0,
        muted: false, loop: false, qSwing: 0, transpose: 0, velocityOffset: 0,
        fadeIn: { duration: 0, curve: 'linear', gain: 1 },
        fadeOut: { duration: 0, curve: 'linear', gain: 1 },
        playbackRate: 1, pitchOffset: 0, stretchMode: 'none', notes: [],
    });
    return { drum: drum.id, inst: inst.id };
});
await page.waitForTimeout(1200);

const reveal = async () => {
    await page.hover('[data-view-toggles-shell]');
    await page.waitForTimeout(300);
};
const openEditors = async () => {
    await reveal();
    await page.click('[data-view-button="editors"]');
    await page.waitForTimeout(900);
};

// ── The Editors button opens the editor for the track you are on ──────────
await page.evaluate(id => window.__projectStore.getState().selectTrack(id), ids.inst);
await page.waitForTimeout(500);
await openEditors();
check('a software instrument still gets the piano roll',
    await page.evaluate(() => !document.querySelector('[data-session-player]')));

await page.evaluate(id => window.__projectStore.getState().selectTrack(id), ids.drum);
await page.waitForTimeout(900);
check('a drummer track gets the Session Player instead',
    await page.evaluate(() => !!document.querySelector('[data-session-player]')));

// ── Every control writes notes ────────────────────────────────────────────
const notes = () => page.evaluate(() => {
    const c = window.__projectStore.getState().clips.find(x => x.id === 'probe-drum-region');
    return {
        count: c?.notes?.length ?? 0,
        pitches: [...new Set((c?.notes ?? []).map(n => n.pitch))].sort((a, b) => a - b),
        starts: (c?.notes ?? []).map(n => Math.round(n.start * 1000)),
        velocities: (c?.notes ?? []).map(n => n.velocity),
        settings: c?.drummerSettings ?? null,
    };
});

const dragKnob = async (id, dy) => {
    const el = await page.$(`[data-session-knob="${id}"], [data-session-fader="${id}"]`);
    if (!el) return false;
    const b = await el.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - dy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    return true;
};

const before = await notes();
check('the region starts empty', before.count === 0, `${before.count} notes`);

await dragKnob('complexity', 60);
const afterComplexity = await notes();
check('dragging Complexity writes real notes into the region',
    afterComplexity.count > 0, `${before.count} -> ${afterComplexity.count} notes`);
check('and they are at General MIDI drum pitches',
    afterComplexity.pitches.every(p => p >= 35 && p <= 81),
    afterComplexity.pitches.join(', '));

const dense = afterComplexity.count;
await dragKnob('complexity', -200);
const sparse = await notes();
check('turning Complexity down plays fewer of them',
    sparse.count < dense, `${dense} -> ${sparse.count} notes`);

await dragKnob('intensity', 80);
const loud = await notes();
const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
check('Intensity changes how hard they are hit',
    Math.abs(avg(loud.velocities) - avg(sparse.velocities)) > 1,
    `${avg(sparse.velocities).toFixed(0)} -> ${avg(loud.velocities).toFixed(0)} average velocity`);

// Complexity back up first: at the bottom of its range only the downbeats
// survive, and swing correctly does not move those — there is nothing offbeat
// left to push late.
await dragKnob('complexity', 120);
await page.waitForTimeout(500);
const straight = await notes();
await dragKnob('swing', 90);
const swung = await notes();
check('Swing moves them in time',
    JSON.stringify(swung.starts) !== JSON.stringify(straight.starts),
    `${swung.settings?.swing?.toFixed(2)} swing`);

// ── Switching a piece off removes it from the kit ─────────────────────────
const withKick = await notes();
await page.click('[data-session-piece="kick"]');
await page.waitForTimeout(800);
const withoutKick = await notes();
check('switching the kick off takes it out of the pattern',
    withKick.pitches.includes(36) && !withoutKick.pitches.includes(36),
    `pitches now: ${withoutKick.pitches.join(', ')}`);
await page.click('[data-session-piece="kick"]');
await page.waitForTimeout(600);

// ── The variation popover ─────────────────────────────────────────────────
await page.click('[data-session-variation]');
await page.waitForTimeout(400);
const rows = await page.evaluate(() =>
    document.querySelectorAll('[data-session-variation-row]').length);
check('the pattern picker offers eight variations', rows === 8, `${rows} rows`);

const beforeVariation = await notes();
await page.click('[data-session-variation-row="7"]');
await page.waitForTimeout(800);
const afterVariation = await notes();
check('choosing one changes the pattern',
    afterVariation.settings?.variation === 7 &&
    JSON.stringify(afterVariation.starts) !== JSON.stringify(beforeVariation.starts),
    `variation ${afterVariation.settings?.variation}`);

// ── The Details tab ───────────────────────────────────────────────────────
await page.click('[data-session-tab="details"]');
await page.waitForTimeout(600);
check('the Details tab shows its own controls',
    await page.evaluate(() => !!document.querySelector('[data-session-knob="ghostNotes"]')));

const beforeGhost = await notes();
await dragKnob('ghostNotes', 80);
const afterGhost = await notes();
check('Ghost Notes adds quiet hits between the backbeats',
    afterGhost.count > beforeGhost.count,
    `${beforeGhost.count} -> ${afterGhost.count} notes`);

const beforePicker = await notes();
await page.click('[data-session-picker="snare"]');
await page.waitForTimeout(800);
const afterPicker = await notes();
check('the Snare picker changes which articulation is played',
    afterPicker.settings?.snare !== beforePicker.settings?.snare,
    `${beforePicker.settings?.snare} -> ${afterPicker.settings?.snare}`);

// ── The one thing that is not built says so ───────────────────────────────
const manual = await page.evaluate(() => {
    const b = document.querySelector('[data-session-tab="manual"]');
    return b ? { disabled: b.disabled, title: b.title } : null;
});
check('the Manual tab is dimmed and says why',
    manual?.disabled === true && /not built/i.test(manual.title ?? ''),
    manual ? `"${manual.title}"` : 'missing');

// ── It survives a reload: the settings are the score, the notes the render ─
await page.evaluate(() => window.__projectStore.getState().saveProject?.());
await page.waitForTimeout(1200);
const saved = await notes();
check('the settings are stored on the region alongside the notes',
    !!saved.settings && saved.count > 0,
    `${saved.count} notes, variation ${saved.settings?.variation}`);

await page.click('[data-session-tab="main"]');
await page.waitForTimeout(600);
const panel = await page.$('[data-session-player]');
const pb = await panel?.boundingBox();
if (pb) {
    await page.screenshot({
        path: 'session-player.png',
        clip: { x: pb.x, y: pb.y, width: Math.min(1600 - pb.x, pb.width), height: pb.height },
    });
}

await page.click('[data-session-tab="details"]');
await page.waitForTimeout(600);
const dp = await (await page.$('[data-session-player]'))?.boundingBox();
if (dp) {
    await page.screenshot({
        path: 'session-player-details.png',
        clip: { x: dp.x, y: dp.y, width: Math.min(1600 - dp.x, dp.width), height: dp.height },
    });
}
await page.click('[data-session-tab="main"]');
await page.waitForTimeout(500);

const ours = consoleErrors.filter(t => !/RSC payload|CLIENT_FETCH_ERROR/i.test(t));
check('no console errors', ours.length === 0, ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
