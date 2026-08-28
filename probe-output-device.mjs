/**
 * Does the mix go to the output chosen in Settings?
 *
 * `setOutputDevice` had one caller — the dropdown's `onChange` — and it
 * refused outright when no AudioContext existed yet:
 *
 *     if (!ctx) return { ok: false, reason: 'The audio engine has not started yet' };
 *
 * The context is created lazily, on the first gesture that makes sound. So
 * opening Settings before pressing play, choosing an output, and closing the
 * dialog stored the setting, showed the right device in the dropdown, and left
 * every sample going to the system default. Nothing re-applied it on load
 * either, so even a choice that did land was gone on the next reload.
 *
 * `AudioContext.sinkId` reads back where the audio is actually going, which is
 * the only claim worth checking here.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
           '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    permissions: ['microphone'],
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 200)));

const results = [];
const check = (name, pass, detail = '') => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const login = async () => {
    await page.goto(`${BASE}/login`);
    await page.waitForTimeout(9000);
    for (let i = 0; i < 4; i++) {
        await page.fill('input[type="email"]', 'dev@example.com');
        await page.fill('input[type="password"]', 'devpassword123');
        await page.click('button[type="submit"]');
        try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 }); return; }
        catch { await page.waitForTimeout(4000); }
    }
};

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('magicPro_tutorial', 'completed'));
await login();
await page.waitForTimeout(2000);
// The dashboard is the project chooser now: a New Project category with an
// Empty Project tile, and Choose to create it.
await page.click('[data-section="new"]', { timeout: 90000 });
await page.waitForTimeout(500);
await page.click('[data-tile="empty"]');
await page.click('[data-choose]');
await page.waitForURL('**/project/**', { timeout: 60000 });
const projectUrl = page.url();
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

// ── What outputs exist ────────────────────────────────────────────────────
const outputs = await page.evaluate(async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    return list.filter(d => d.kind === 'audiooutput')
               .map(d => ({ id: d.deviceId, label: d.label }));
});
check('the page can see audio outputs', outputs.length > 0,
    outputs.map(o => `${o.label || '(unnamed)'}=${o.id.slice(0, 12)}`).join(', '));

const target = outputs.find(o => o.id && o.id !== 'default') ?? outputs[0];

// ── Choosing an output before the engine has started ──────────────────────
// This is the ordinary order — pick the output, then play something — and it
// is exactly the case the old code refused.
const beforeStart = await page.evaluate(async id => {
    const mgr = window.__audioContextManager;
    return mgr ? await mgr.setOutputDevice(id) : 'no handle';
}, target.id);
console.log('  setOutputDevice before playback:', JSON.stringify(beforeStart));

// ── Now make sound, which is what creates the context ─────────────────────
await page.evaluate(() => window.__projectStore.getState().play());
await page.waitForTimeout(2500);
await page.evaluate(() => window.__projectStore.getState().stop());
await page.waitForTimeout(800);

const sink = await page.evaluate(() => {
    const c = window.__audioContextManager?.getContext?.();
    return c ? { sinkId: c.sinkId ?? '(unsupported)', state: c.state } : 'no context';
});
check('the engine starts on the chosen output, not the default',
    typeof sink === 'object' && (sink.sinkId === target.id || (target.id === 'default' && sink.sinkId === '')),
    `sinkId=${typeof sink === 'object' ? sink.sinkId : sink} wanted=${target.id}`);

// ── And it survives a reload, id rotation included ────────────────────────
// Chrome re-salts device ids across page loads here, so the stored id is
// guaranteed not to resolve after the reload — which is precisely the case
// that used to leave the mix on the system default in silence. The label is
// what finds the same output again.
await page.evaluate(([id, label]) => {
    const st = window.__projectStore.getState();
    st.updateGlobalSettings({
        audio: { ...st.globalSettings.audio, outputDevice: id, outputDeviceLabel: label },
    });
}, [target.id, target.label]);
await page.waitForTimeout(1000);

await page.goto(projectUrl);
await page.waitForFunction(() => (window.__projectStore?.getState()?.tracks?.length ?? 0) > 0, null, { timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(() => window.__projectStore.getState().play());
await page.waitForTimeout(3000);

const afterReload = await page.evaluate(async wantedLabel => {
    const c = window.__audioContextManager?.getContext?.();
    const devices = await navigator.mediaDevices.enumerateDevices();
    const now = devices.find(d => d.kind === 'audiooutput' && d.label === wantedLabel);
    return {
        storedId: window.__projectStore.getState().globalSettings?.audio?.outputDevice,
        storedLabel: window.__projectStore.getState().globalSettings?.audio?.outputDeviceLabel,
        sinkId: c?.sinkId ?? '(no context)',
        idNow: now?.deviceId ?? null,
        note: window.__audioContextManager?.getOutputNote?.() ?? null,
    };
}, target.label);

check('the chosen output is remembered by name across a reload',
    afterReload.storedLabel === target.label,
    `stored label "${afterReload.storedLabel}"`);
check('and the mix follows it even though the id changed',
    !!afterReload.idNow && afterReload.sinkId === afterReload.idNow,
    `id was ${target.id.slice(0, 10)}, is now ${String(afterReload.idNow).slice(0, 10)}, sink ${String(afterReload.sinkId).slice(0, 10)}`);
check('nothing is left complaining once it is found',
    !afterReload.note, afterReload.note ?? 'no warning');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
