/**
 * Does the rack insert what it names, and do the voicings differ by ear?
 *
 * A Hall and a Plate are the same reverb with different settings — which is
 * only worth offering as two entries if the two actually sound different.
 * This renders each through the real processor and compares.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));

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
await page.waitForTimeout(4000);
await page.mouse.click(900, 400);

// ── The menu shows the tree ───────────────────────────────────────────────
await page.evaluate(() => window.__projectStore.setState({ showMixer: true }));
await page.waitForTimeout(1500);
await page.click('[data-strip-row="audioFx"] button:last-child').catch(() => { });
await page.waitForTimeout(700);

const menu = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-fx-entry]')];
    return {
        entries: rows.length,
        available: rows.filter(r => r.dataset.fxAvailable === 'true').length,
        disabledHaveReasons: rows
            .filter(r => r.dataset.fxAvailable === 'false')
            .every(r => (r.getAttribute('title') ?? '').length > 10),
        names: rows.map(r => r.dataset.fxEntry),
    };
});
check('the rack lists every entry in the tree', menu.entries === 31, `${menu.entries} rows`);
check('13 of them can be inserted', menu.available === 13, `${menu.available} available`);
check('every dimmed row says why', menu.disabledHaveReasons);
check('the tree is in the order asked for',
    menu.names?.[0] === 'Channel EQ' && menu.names?.[menu.names.length - 1] === 'Frequency Shifter',
    `${menu.names?.[0]} … ${menu.names?.[menu.names.length - 1]}`);

// ── The voicings actually differ ──────────────────────────────────────────
await page.keyboard.press('Escape').catch(() => { });
await page.waitForFunction(() => typeof window.audioDebug?.testFxRack === 'function', null, { timeout: 30000 });

const rows = await page.evaluate(async () => {
    const out = [];
    const original = console.table;
    console.table = (d) => { out.push(...d); };
    await window.audioDebug.testFxRack();
    console.table = original;
    return out;
});

console.log('  detail:', rows.map(r => `${r.Entry}=${r.Works}`).join(' | '));
// Every voiced entry must do something the moment it is inserted — that is
// what makes a preset a preset rather than a name.
const voicedRows = rows.filter(r => !r.Entry.endsWith('Channel EQ'));
check('every voiced entry changes the signal on insert',
    rows.length === 13 && voicedRows.every(r => r.Works === 'yes'),
    `${voicedRows.filter(r => r.Works === 'yes').length}/${voicedRows.length}`);

// And the one that should not: an EQ arrives flat, so it is transparent until
// a band is moved. Inserting one must not colour the track.
check('a freshly inserted Channel EQ is transparent',
    rows.find(r => r.Entry.endsWith('Channel EQ'))?.Works === 'NO');

const tail = (name) => Number(rows.find(r => r.Entry.endsWith(name))?.Tail ?? 0);
const change = (name) => Number(rows.find(r => r.Entry.endsWith(name))?.['Change vs dry'] ?? 0);
check('a hall rings longer than a room', tail('Hall') > tail('Room'),
    `hall ${tail('Hall').toExponential(2)} vs room ${tail('Room').toExponential(2)}`);
check('a plate is brighter, so it rings differently again',
    tail('Plate') !== tail('Room') && tail('Plate') !== tail('Hall'));
// The four reverbs and three delays are one plugin each, voiced differently;
// if any two produced the same change they would be one entry wearing two names.
const voiced = rows.filter(r => /Reverb|Delay|Modulation/.test(r.Entry));
check('no two voicings are the same sound',
    new Set(voiced.map(r => r['Change vs dry'])).size === voiced.length,
    `${new Set(voiced.map(r => r['Change vs dry'])).size} distinct of ${voiced.length}`);

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
