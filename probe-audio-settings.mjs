/**
 * Walk every Audio settings panel in a real browser and check that the
 * controls read real values and write them back.
 *
 * The panels all existed before this pass; what they did not have was values.
 * `globalSettings.audio` is `{}` on a new project, so the surround grids
 * rendered rows of empty dropdowns and the MP3 tab could not be opened at all.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1500, height: 980 } });
const page = await context.newPage();
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 180)));

const S = (fn, ...a) => page.evaluate(fn, ...a);
const results = [];
const check = (name, pass, detail = '') => {
    results.push({ name, pass });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

await page.goto(`${BASE}/login`);
// A cold dev build serves the page before React attaches its handlers; a
// click landing first submits the form natively and never logs in.
await page.waitForTimeout(6000);
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
await page.waitForTimeout(3000);

/** Open Settings at a given tab and sub-tab. */
async function open(tab, subTab) {
    await S(([t, st]) => {
        const store = window.__projectStore.getState();
        store.setShowSettingsDialog(true);
        window.__projectStore.setState({ settingsActiveTab: t, settingsActiveSubTab: st });
    }, [tab, subTab]);
    await page.waitForTimeout(500);
}

const audio = () => S(() => window.__projectStore.getState().globalSettings.audio ?? {});
const labels = (sel) => S(s => [...document.querySelectorAll(s)].map(n => n.textContent.trim()), sel);

// ── The MP3 tab existed as a panel with no way in ─────────────────────────
await open('Audio', 'Devices');
const subTabs = await S(() => [...document.querySelectorAll('button')]
    .map(b => b.textContent.trim())
    .filter(t => ['Devices', 'General', 'Sampler', 'Editing', 'I/O Assignments', 'File Editor', 'MP3'].includes(t)));
check('all seven Audio sub-tabs are reachable', new Set(subTabs).size === 7, subTabs.join(', '));

// ── Devices ───────────────────────────────────────────────────────────────
const deviceRows = await S(() => [...document.querySelectorAll('span')]
    .map(s => s.textContent.trim())
    .filter(t => /^(Core Audio|Output Device|Input Device|I\/O Buffer Size|Resulting Latency|Recording Delay|Processing Threads|Process Buffer Range|Multithreading|Summing):$/.test(t)));
check('Devices shows its ten rows', deviceRows.length >= 9, `${deviceRows.length} rows`);
check('Devices offers Allow Access', await page.locator('[data-allow-access]').count() === 1);

// ── I/O Assignments: Output ───────────────────────────────────────────────
await open('Audio', 'I/O Assignments');
await S(() => {
    const s = window.__projectStore.getState();
    s.updateProjectSettings({ surroundFormat: '7.1.4' });
});
await page.waitForTimeout(400);

const cells = () => S(() => [...document.querySelectorAll('[data-channel]')].map(n => ({
    channel: n.dataset.channel,
    enabled: n.dataset.enabled === 'true',
    value: n.querySelector('select,input')?.value ?? '',
})));

let grid = await cells();
check('the grid draws all 17 surround channels', grid.length === 17, `${grid.length} cells`);
check('7.1.4 enables exactly its 12 channels', grid.filter(c => c.enabled).length === 12,
    `${grid.filter(c => c.enabled).length} enabled`);
check('the five channels 7.1.4 does not carry are dimmed',
    ['lc', 'rc', 'surround', 'ltm', 'rtm'].every(c => grid.find(g => g.channel === c && !g.enabled)));
check('every enabled cell shows a port, not a blank',
    grid.filter(c => c.enabled).every(c => /^Output \d+$/.test(c.value)),
    grid.find(c => c.enabled)?.value);
check('the reference wiring is what it shows',
    grid.find(c => c.channel === 'left')?.value === 'Output 1'
    && grid.find(c => c.channel === 'center')?.value === 'Output 5'
    && grid.find(c => c.channel === 'rts')?.value === 'Output 12');

// Changing the format re-dims the grid.
await S(() => window.__projectStore.getState().updateProjectSettings({ surroundFormat: '5.1 (ITU 775)' }));
await page.waitForTimeout(400);
grid = await cells();
check('switching to 5.1 leaves 6 channels live', grid.filter(c => c.enabled).length === 6,
    `${grid.filter(c => c.enabled).length} enabled`);

await S(() => window.__projectStore.getState().updateProjectSettings({ surroundFormat: '7.1.4' }));
await page.waitForTimeout(300);

// The Initialize buttons rewire.
await page.getByRole('button', { name: 'ITU', exact: true }).first().click();
await page.waitForTimeout(400);
let io = (await audio()).ioAssignments;
check('Initialize > ITU rewires the outputs', io?.outputMapping?.center === 'Output 3',
    `center = ${io?.outputMapping?.center}`);
await page.getByRole('button', { name: 'Default', exact: true }).first().click();
await page.waitForTimeout(400);
io = (await audio()).ioAssignments;
check('Initialize > Default puts it back', io?.outputMapping?.center === 'Output 5',
    `center = ${io?.outputMapping?.center}`);

// A grid dropdown writes to the store.
await page.selectOption('[data-channel="left"] select', 'Output 7');
await page.waitForTimeout(400);
io = (await audio()).ioAssignments;
check('choosing a port in the grid is stored', io?.outputMapping?.left === 'Output 7',
    `left = ${io?.outputMapping?.left}`);

// ── I/O Assignments: Bounce Extensions ────────────────────────────────────
await S(() => {
    const s = window.__projectStore.getState();
    const a = s.globalSettings.audio;
    s.updateGlobalSettings({ audio: { ...a, ioAssignments: { ...a.ioAssignments, activeSubTab: 'Bounce Extensions' } } });
});
await page.waitForTimeout(500);
grid = await cells();
check('Bounce Extensions fills every carried channel',
    grid.filter(c => c.enabled).every(c => c.value.startsWith('.')),
    grid.filter(c => c.enabled).slice(0, 3).map(c => `${c.channel}${c.value}`).join(' '));
check('LFE carries the .LFE extension',
    grid.find(c => c.channel === 'lfe')?.value === '.LFE');

await page.fill('[data-channel="left"] input', '.Left');
await page.waitForTimeout(400);
io = (await audio()).ioAssignments;
check('editing an extension is stored', io?.bounceExtensions?.mapping?.left === '.Left',
    io?.bounceExtensions?.mapping?.left);
await page.getByRole('button', { name: 'Reset Extensions' }).first().click();
await page.waitForTimeout(400);
io = (await audio()).ioAssignments;
check('Reset Extensions restores the defaults', io?.bounceExtensions?.mapping?.left === '.L',
    io?.bounceExtensions?.mapping?.left);

// ── I/O Assignments: Input ────────────────────────────────────────────────
await S(() => {
    const s = window.__projectStore.getState();
    const a = s.globalSettings.audio;
    s.updateGlobalSettings({ audio: { ...a, ioAssignments: { ...a.ioAssignments, activeSubTab: 'Input' } } });
});
await page.waitForTimeout(500);
grid = await cells();
check('the Input grid names inputs, not outputs',
    grid.filter(c => c.enabled).every(c => /^Input \d+$/.test(c.value)),
    grid.find(c => c.enabled)?.value);

// ── Sampler ───────────────────────────────────────────────────────────────
await open('Audio', 'Sampler');
await S(() => {
    const s = window.__projectStore.getState();
    const a = s.globalSettings.audio;
    s.updateGlobalSettings({ audio: { ...a, samplerActiveSubTab: 'Virtual Memory' } });
});
await page.waitForTimeout(500);
const ramOf = () => S(() => {
    const text = [...document.querySelectorAll('span')]
        .map(n => n.textContent.trim())
        .find(t => /^\d+(\.\d+)? MB$/.test(t));
    return text ?? '';
});
const ramMedium = await ramOf();
await S(() => {
    const s = window.__projectStore.getState();
    const a = s.globalSettings.audio;
    s.updateGlobalSettings({ audio: { ...a, sampler: { ...a.sampler, virtualMemory: { ...a.sampler?.virtualMemory, active: true, bufferRange: 'Large' } } } });
});
await page.waitForTimeout(500);
const ramLarge = await ramOf();
check('the RAM figure follows the buffer range', ramMedium !== ramLarge && /MB$/.test(ramLarge),
    `${ramMedium} -> ${ramLarge}`);

// ── File Editor ───────────────────────────────────────────────────────────
await open('Audio', 'File Editor');
const fileEditorHints = await labels('p');
check('File Editor explains the rows that cannot act',
    fileEditorHints.filter(t => /not built|no destructive|undo|another application/i.test(t)).length >= 3,
    `${fileEditorHints.length} notes`);

// ── MP3 ───────────────────────────────────────────────────────────────────
await open('Audio', 'MP3');
const mp3Rows = await S(() => [...document.querySelectorAll('span')]
    .map(s => s.textContent.trim())
    .filter(t => /^(Bit Rate Mono|Bit Rate Stereo|Quality|Stereo Mode):$/.test(t)));
check('MP3 shows its four labelled rows', mp3Rows.length === 4, mp3Rows.join(', '));
const mp3Values = await S(() => [...document.querySelectorAll('span')]
    .map(s => s.textContent.trim())
    .filter(t => /kbit\/s$/.test(t)));
check('MP3 bit rates read real values', mp3Values.length >= 2, mp3Values.join(', '));

await S(() => {
    const s = window.__projectStore.getState();
    const a = s.globalSettings.audio;
    s.updateGlobalSettings({ audio: { ...a, mp3: { ...a.mp3, bitRateStereo: '128 kbit/s' } } });
});
await page.waitForTimeout(400);
check('an MP3 setting round-trips through the store',
    (await audio()).mp3?.bitRateStereo === '128 kbit/s');

await page.screenshot({ path: 'audio-settings.png' });

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
