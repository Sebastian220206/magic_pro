/**
 * Opening an effect shows controls, not a read-only dump.
 *
 * `getBuiltinManifest` read a registry that nothing initialised, keyed by ids
 * that no longer matched, describing parameters the DSP does not take. Every
 * lookup missed, so every editor except the Channel EQ fell through to the
 * "Generic Plugin Editor" list of key/value pairs.
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
await page.waitForTimeout(4000);

const EFFECTS = [
    { id: 'magic.compressor', name: 'Compressor', expect: ['Threshold', 'Ratio', 'Makeup Gain', 'Character'] },
    { id: 'magic.reverb', name: 'Space Designer', expect: ['Mix', 'Decay', 'Pre-Delay', 'Damping'] },
    { id: 'magic.delay', name: 'Delay Designer', expect: ['Time L', 'Time R', 'Feedback', 'Ping-Pong', 'Sync'] },
    { id: 'magic.limiter', name: 'Limiter', expect: ['Ceiling', 'Release', 'Lookahead'] },
    { id: 'magic.sidechain', name: 'Sidechain Comp', expect: ['Threshold', 'Ratio', 'Attack'] },
];

for (const fx of EFFECTS) {
    // Put the effect on the first track and open its editor.
    await page.evaluate(({ id, name }) => {
        const s = window.__projectStore.getState();
        const track = s.tracks[0];
        const pluginId = `probe-${id}`;
        window.__projectStore.setState({
            tracks: s.tracks.map(t => t.id === track.id
                ? { ...t, plugins: [{ id: pluginId, pluginId: id, name, enabled: true, params: {} }] }
                : t),
        });
        s.setOpenPluginEditor({ trackId: track.id, pluginId });
    }, fx);
    await page.waitForTimeout(700);

    const text = await page.evaluate(() =>
        (document.querySelector('.fixed.inset-0.z-\\[110\\]')?.textContent ?? '').replace(/\s+/g, ' ').trim());
    const controls = await page.evaluate(() =>
        document.querySelectorAll('.fixed.inset-0.z-\\[110\\] input, .fixed.inset-0.z-\\[110\\] select').length);

    const generic = text.includes('Generic Plugin Editor');
    const named = fx.expect.filter(label => text.includes(label));

    check(`${fx.name}: real editor, not the generic dump`, !generic && controls > 0,
        `controls=${controls}${generic ? ' GENERIC' : ''}`);
    check(`${fx.name}: names its real parameters`, named.length === fx.expect.length,
        `${named.length}/${fx.expect.length} — ${named.join(', ')}`);

    await page.evaluate(() => window.__projectStore.getState().setOpenPluginEditor(null));
    await page.waitForTimeout(250);
}

// The Channel EQ keeps its purpose-built editor rather than a generated one.
await page.evaluate(() => {
    const s = window.__projectStore.getState();
    const track = s.tracks[0];
    window.__projectStore.setState({
        tracks: s.tracks.map(t => t.id === track.id
            ? { ...t, plugins: [{ id: 'probe-eq', pluginId: 'magic.eq', name: 'Channel EQ', enabled: true, params: {} }] }
            : t),
    });
    s.setOpenPluginEditor({ trackId: track.id, pluginId: 'probe-eq' });
});
await page.waitForTimeout(900);
const eqText = await page.evaluate(() =>
    (document.querySelector('.fixed.inset-0.z-\\[110\\]')?.textContent ?? '').replace(/\s+/g, ' ').trim());
check('Channel EQ keeps its own editor', !eqText.includes('Generic Plugin Editor'), eqText.slice(0, 60));

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
