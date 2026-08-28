/**
 * Opening a plug-in's editor shows the plug-in, not whatever was true when the
 * window opened.
 *
 * `PluginEditorWindow` read `routingEngine.getInsertProcessor()` once during
 * render. Processors are built asynchronously — a Web Audio Module has to be
 * fetched, imported and instantiated — so clicking a freshly added effect's
 * slot in the mixer picked the "no processor" branch and stayed on it: the
 * Generic Plugin Editor, forever, for a plug-in that finished loading a
 * fraction of a second later. Only closing and reopening the window helped.
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

/** What the editor window is currently showing. */
const measure = () => {
    const w = Array.from(document.querySelectorAll('div.fixed.inset-0')).find(d => d.className.includes('z-[110]'));
    if (!w) return { state: 'no-window' };
    const text = (w.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.includes('Loading plug-in')) return { state: 'loading' };
    if (text.includes('could not be loaded')) return { state: 'failed' };
    if (text.includes('Generic Plugin Editor')) return { state: 'generic-dump' };
    // A WAM's GUI lives in a shadow root, so measure the element, not the text.
    const gui = w.querySelector('.overflow-auto')?.firstElementChild;
    if (gui) {
        const b = gui.getBoundingClientRect();
        return { state: 'mounted', size: `${Math.round(b.width)}x${Math.round(b.height)}` };
    }
    return { state: 'other', text: text.slice(0, 60) };
};

const catalogue = await page.evaluate(async () => {
    const r = await fetch('/api/wam-registry');
    if (!r.ok) return null;
    const d = await r.json();
    return (d.plugins ?? []).filter(p => !p.isInstrument)
        .map(p => ({ identifier: p.identifier, name: p.name, url: p.url }));
});

if (!catalogue?.length) {
    console.log('SKIP  plugin catalogue unavailable — cannot exercise the WAM path');
    await browser.close();
    process.exit(0);
}

// StonePhaser loads in a few hundred milliseconds: long enough that the editor
// used to latch the wrong branch, short enough that the probe need not crawl.
const entry = catalogue.find(e => e.identifier === 'com.wimmics.stonephaser') ?? catalogue[0];

const info = await page.evaluate((e) => {
    const s = window.__projectStore.getState();
    const track = s.tracks[0];
    window.__projectStore.setState({ tracks: s.tracks.map(t => t.id === track.id ? { ...t, plugins: [] } : t) });
    const pid = window.__projectStore.getState().addWamPlugin(track.id, e);
    // The gesture that broke: open the slot the instant the effect is added.
    s.setOpenPluginEditor({ trackId: track.id, pluginId: pid });
    return { pid, trackId: track.id };
}, entry);

await page.waitForTimeout(600);
const immediate = await page.evaluate(measure);
check(`${entry.name}: says it is loading, not "Generic Plugin Editor"`,
    immediate.state === 'loading' || immediate.state === 'mounted', immediate.state);

// Without closing the window, it has to pick the processor up on its own.
let settled = { state: 'never' };
for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    settled = await page.evaluate(measure);
    if (settled.state !== 'loading') break;
}
check(`${entry.name}: reaches its own interface without a reopen`,
    settled.state === 'mounted', `${settled.state} ${settled.size ?? ''}`);
check(`${entry.name}: interface has real size`,
    settled.state === 'mounted' && !/^0x|x0$/.test(settled.size ?? ''), settled.size ?? '—');

// A built-in effect still opens straight into its manifest-driven editor.
await page.evaluate(() => window.__projectStore.getState().setOpenPluginEditor(null));
await page.waitForTimeout(300);
await page.evaluate(() => {
    const s = window.__projectStore.getState();
    const track = s.tracks[0];
    window.__projectStore.setState({
        tracks: s.tracks.map(t => t.id === track.id
            ? { ...t, plugins: [{ id: 'probe-verb', pluginId: 'magic.reverb', name: 'Space Designer', enabled: true, params: {} }] }
            : t),
    });
    s.setOpenPluginEditor({ trackId: track.id, pluginId: 'probe-verb' });
});
await page.waitForTimeout(800);
const builtin = await page.evaluate(() => {
    const w = Array.from(document.querySelectorAll('div.fixed.inset-0')).find(d => d.className.includes('z-[110]'));
    const text = (w?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return { text, controls: w?.querySelectorAll('input,select').length ?? 0 };
});
check('Built-in effect still opens directly, with no loading step',
    builtin.controls > 0 && !builtin.text.includes('Loading'), `controls=${builtin.controls}`);

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
