/**
 * The pencil tool, on every track that can hold notes.
 *
 * It asked `type === 'midi' || type === 'software-instrument'` and did nothing
 * otherwise — so on a drummer track it found the track, decided it was not
 * MIDI, and fell through: no region, no cursor change, no message. Four track
 * types carry notes, which is why `lib/trackKinds` exists; this was another
 * copy of the two-type shorthand it was written to replace.
 *
 * Everything here draws with the mouse.
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

// One of each kind that can hold notes, plus an audio track that must not.
const KINDS = [
    { type: 'software-instrument', name: 'Piano', colour: '#a78bfa', notes: true },
    { type: 'drummer', name: 'Drums', colour: '#fb923c', notes: true },
    { type: 'external-midi', name: 'Outboard', colour: '#22d3ee', notes: true },
    { type: 'midi', name: 'MIDI', colour: '#4ade80', notes: true },
    { type: 'audio', name: 'Vocals', colour: '#ec4899', notes: false },
];
await page.evaluate(kinds => {
    window.__projectStore.getState().addTracks(
        kinds.map(k => ({ name: k.name, type: k.type, color: k.colour })));
}, KINDS);
await page.waitForTimeout(2000);

// Pick up the pencil.
await page.evaluate(() => window.__projectStore.getState().setCurrentTool?.('pencil')
    ?? window.__projectStore.setState({ currentTool: 'pencil' }));
await page.waitForTimeout(600);
check('the pencil is the active tool',
    await page.evaluate(() => window.__projectStore.getState().currentTool === 'pencil'));

const trackIds = await page.evaluate(() =>
    window.__projectStore.getState().tracks.map(t => ({ id: t.id, type: t.type, name: t.name })));

/** Draw in the middle of a track's lane, `offset` pixels along. */
const drawOn = async (trackId, offset = 320) => {
    const box = await page.evaluate(([id, off]) => {
        const row = document.querySelector(`[data-track-row="${id}"]`);
        if (!row) return null;
        const r = row.getBoundingClientRect();
        // The lane sits to the right of the header column, at the same y.
        const header = row.closest('div[style*="width"]');
        const left = header.getBoundingClientRect().right;
        return { x: left + off, y: r.top + r.height / 2 };
    }, [trackId, offset]);
    if (!box) return false;
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(700);
    return true;
};

const clipsOn = (trackId) => page.evaluate(id => {
    const st = window.__projectStore.getState();
    const cs = st.clips.filter(c => c.trackId === id);
    return cs.map(c => ({
        type: c.type, name: c.name, duration: c.duration,
        notes: c.notes?.length ?? 0,
        hasDrummerSettings: !!c.drummerSettings,
    }));
}, trackId);

for (const kind of KINDS) {
    const track = trackIds.find(t => t.type === kind.type && t.name === kind.name);
    if (!track) { check(`a ${kind.type} track exists to draw on`, false); continue; }

    const before = (await clipsOn(track.id)).length;
    await drawOn(track.id);
    const after = await clipsOn(track.id);

    if (kind.notes) {
        check(`the pencil draws a region on a ${kind.type} track`,
            after.length === before + 1,
            after.length > before ? `${after.at(-1).name}, ${after.at(-1).duration} beats` : 'nothing drawn');
        if (after.length > before) {
            check(`  and it is a MIDI region`, after.at(-1).type === 'midi', after.at(-1).type);
        }
    } else {
        check(`the pencil draws no MIDI region on an ${kind.type} track`,
            after.length === before, `${after.length} clips`);
    }
}

// ── A drummer region arrives playing ──────────────────────────────────────
const drums = trackIds.find(t => t.type === 'drummer');
const drumClips = await clipsOn(drums.id);
const drawn = drumClips.at(-1);
check('a drawn drummer region has notes in it already',
    (drawn?.notes ?? 0) > 0, `${drawn?.notes ?? 0} notes`);
check('and carries the Session Player settings that produced them',
    drawn?.hasDrummerSettings === true);
check('it is named for what it is', drawn?.name === 'Drummer', drawn?.name);

// ── It draws on the track under the pointer, with one hidden ──────────────
await page.evaluate(ids => {
    const st = window.__projectStore.getState();
    st.setTrackHidden(ids[1].id, true);
    window.__projectStore.setState({ hideViewActive: true });
}, trackIds);
await page.waitForTimeout(900);

// The last visible row that can hold notes — the audio track is last overall
// and correctly refuses a MIDI region, which would prove nothing here.
const lastVisible = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const midi = new Set(['midi', 'software-instrument', 'drummer', 'external-midi']);
    const rows = [...document.querySelectorAll('[data-track-row]')]
        .map(r => r.getAttribute('data-track-row'))
        .filter(id => midi.has(st.tracks.find(t => t.id === id)?.type));
    return rows.at(-1) ?? null;
});
const beforeHidden = (await clipsOn(lastVisible)).length;
// Well clear of the region drawn earlier: clicking an existing clip is the
// clip's own drag handler, not the lane's pencil.
await drawOn(lastVisible, 1000);
const afterHidden = await clipsOn(lastVisible);
check('with a track hidden, the pencil still draws on the row under the pointer',
    afterHidden.length === beforeHidden + 1,
    `${beforeHidden} -> ${afterHidden.length} clips on the last visible row`);

await page.evaluate(() => window.__projectStore.setState({ hideViewActive: false }));
await page.waitForTimeout(500);
await page.screenshot({ path: 'pencil-tool.png', clip: { x: 0, y: 100, width: 1500, height: 560 } });

const ours = consoleErrors.filter(t => !/RSC payload|CLIENT_FETCH_ERROR/i.test(t));
check('no console errors', ours.length === 0, ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
