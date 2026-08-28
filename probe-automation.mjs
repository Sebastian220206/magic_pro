/**
 * Does automation play back, and does a write pass record?
 *
 * Automation lanes were data with no runtime: nothing applied them during
 * playback, and the mixer's Read/Touch/Latch/Write button wrote a field
 * nothing read. This drives the real transport and reads the real track state.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
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
await page.mouse.click(900, 400);

const S = (fn, ...a) => page.evaluate(fn, ...a);
const trackId = await S(() => window.__projectStore.getState().tracks[0].id);
const volumeOf = () => S(id => window.__projectStore.getState().tracks.find(t => t.id === id)?.volume, trackId);

/** Give the track a volume ramp from 0.2 at beat 0 to 1.0 at beat 8. */
const drawLane = (mode) => S(([id, m]) => {
    const s = window.__projectStore.getState();
    window.__projectStore.setState({
        tracks: s.tracks.map(t => t.id === id ? {
            ...t,
            automationMode: m,
            volume: 0.8,
            automation: [{ parameter: 'volume', points: [
                { time: 0, value: 0.2 },
                { time: 8, value: 1.0 },
            ] }],
        } : t),
    });
}, [trackId, mode]);

// ── Read: the lane drives the fader ───────────────────────────────────────
await drawLane('read');
await S(() => window.__projectStore.getState().movePlayhead(0));
await page.waitForTimeout(300);
await S(() => window.__projectStore.getState().play());
await page.waitForTimeout(2500);
const during = await volumeOf();
await S(() => window.__projectStore.getState().stop());
await page.waitForTimeout(500);

check('Read: the lane moves the fader during playback',
    typeof during === 'number' && during > 0.2 && during < 1.0 && Math.abs(during - 0.8) > 0.02,
    `volume ${during?.toFixed?.(3)} (started at 0.8, lane runs 0.2 -> 1.0)`);

// ── Off: the lane is ignored ──────────────────────────────────────────────
await drawLane('off');
await S(() => window.__projectStore.getState().movePlayhead(0));
await page.waitForTimeout(300);
await S(() => window.__projectStore.getState().play());
await page.waitForTimeout(2000);
const offDuring = await volumeOf();
await S(() => window.__projectStore.getState().stop());
await page.waitForTimeout(400);
check('Off: the lane is ignored and the fader stays put',
    Math.abs(offDuring - 0.8) < 0.01, `volume ${offDuring?.toFixed?.(3)}`);

// ── Write: a pass records into the lane ───────────────────────────────────
await drawLane('write');
await S(() => window.__projectStore.getState().movePlayhead(0));
await page.waitForTimeout(300);
await S(() => window.__projectStore.getState().play());
await page.waitForTimeout(400);

// Ride the fader the way the mixer does: grab, move, release.
await S(([id]) => {
    const s = window.__projectStore.getState();
    s.beginAutomationTouch(id, 'volume');
}, [trackId]);
for (const v of [0.5, 0.45, 0.4, 0.35, 0.3]) {
    await S(([id, value]) => window.__projectStore.getState().updateAutomationTouch(id, 'volume', value), [trackId, v]);
    await page.waitForTimeout(220);
}
await S(([id]) => window.__projectStore.getState().endAutomationTouch(id, 'volume'), [trackId]);
await page.waitForTimeout(300);
await S(() => window.__projectStore.getState().stop());
await page.waitForTimeout(600);

const lane = await S(id => window.__projectStore.getState().tracks
    .find(t => t.id === id)?.automation?.find(l => l.parameter === 'volume')?.points ?? [], trackId);

check('Write: the pass is recorded into the lane',
    lane.length > 2 && lane.some(p => p.value <= 0.5 && p.value >= 0.29),
    `${lane.length} points, values ${lane.map(p => p.value.toFixed(2)).join(' ')}`);
check('Write: the pass is thinned, not one point per frame',
    lane.length < 40, `${lane.length} points after a ~1.3 s ride`);
// ── Touch: the pass is bounded by the grip, so the lane outside it survives ─
// Write records the whole roll by design, so it legitimately overwrites the
// lane end to end. Touch only records while the control is held, which is what
// makes "punch in on one phrase" possible.
await drawLane('touch');
await S(() => window.__projectStore.getState().movePlayhead(0));
await page.waitForTimeout(300);
await S(() => window.__projectStore.getState().play());
await page.waitForTimeout(300);

await S(([id]) => window.__projectStore.getState().beginAutomationTouch(id, 'volume'), [trackId]);
for (const v of [0.5, 0.45, 0.4]) {
    await S(([id, value]) => window.__projectStore.getState().updateAutomationTouch(id, 'volume', value), [trackId, v]);
    await page.waitForTimeout(200);
}
await S(([id]) => window.__projectStore.getState().endAutomationTouch(id, 'volume'), [trackId]);
// Keep rolling well past the release; nothing more should be recorded.
await page.waitForTimeout(1500);
await S(() => window.__projectStore.getState().stop());
await page.waitForTimeout(600);

const touchLane = await S(id => window.__projectStore.getState().tracks
    .find(t => t.id === id)?.automation?.find(l => l.parameter === 'volume')?.points ?? [], trackId);
const passEnd = Math.max(...touchLane.filter(p => p.value <= 0.51 && p.value >= 0.39).map(p => p.time), 0);

check('Touch: the pass stops when the control is released',
    passEnd > 0 && passEnd < 6,
    `pass ends at beat ${passEnd.toFixed(2)} despite rolling on`);
check('Touch: the lane beyond the pass survives',
    touchLane.some(p => p.time >= 7.5 && p.value > 0.9),
    `last point ${JSON.stringify(touchLane[touchLane.length - 1])}`);

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
