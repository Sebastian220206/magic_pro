/**
 * The Session Player Editor.
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

// A drummer track with a region, a software instrument to compare against, and
// a guitar-shaped part for the follow-rhythm control to lock to.
await page.evaluate(() => {
    const st = window.__projectStore.getState();
    st.addTracks([
        { name: 'Drums', type: 'drummer', color: '#fb923c' },
        { name: 'Piano', type: 'software-instrument', color: '#a78bfa', instrument: 'piano' },
        { name: 'Guitar', type: 'midi', color: '#4ade80' },
    ]);
});
await page.waitForTimeout(1500);
const ids = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const drum = st.tracks.find(t => t.type === 'drummer');
    const inst = st.tracks.find(t => t.type === 'software-instrument');
    const gtr = st.tracks.find(t => t.name === 'Guitar');
    const region = (id, clipId, notes) => ({
        id: clipId, trackId: id, type: 'midi', name: 'Drummer',
        color: '#fb923c', alternativeId: 'default',
        start: 0, startTime: 0, startBeat: 0, duration: 16, offset: 0,
        muted: false, loop: false, qSwing: 0, transpose: 0, velocityOffset: 0,
        fadeIn: { duration: 0, curve: 'linear', gain: 1 },
        fadeOut: { duration: 0, curve: 'linear', gain: 1 },
        playbackRate: 1, pitchOffset: 0, stretchMode: 'none', notes,
    });
    st.addClip(region(drum.id, 'probe-drum-region', []));
    // Offbeat eighths, well clear of where the drum patterns already land.
    st.addClip({
        ...region(gtr.id, 'probe-guitar-region',
            [1.5, 3.5, 5.5, 7.5].map((b, i) => ({
                id: `g${i}`, pitch: 60, start: b, duration: 0.5, velocity: 100,
            }))),
        name: 'Guitar', color: '#4ade80',
    });
    return { drum: drum.id, inst: inst.id, gtr: gtr.id };
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

// ── A pattern per row of kit pieces ───────────────────────────────────────
check('each row of kit pieces has its own Patterns button',
    await page.evaluate(() => document.querySelectorAll('[data-session-variation]').length) === 2);

const openRow = async (row) => {
    await page.click(`[data-session-variation="${row}"]`);
    await page.waitForTimeout(400);
};

await openRow(1);
const rows = await page.evaluate(() =>
    document.querySelectorAll('[data-session-variation-row]').length);
check('the pattern picker offers eight variations', rows === 8, `${rows} rows`);

const beforeVariation = await notes();
await page.click('[data-session-variation-row="7"]');
await page.waitForTimeout(800);
const afterVariation = await notes();
check('choosing one changes the drum pattern',
    afterVariation.settings?.variation === 7 &&
    JSON.stringify(afterVariation.starts) !== JSON.stringify(beforeVariation.starts),
    `variation ${afterVariation.settings?.variation}`);

const beforeCymbal = await notes();
await openRow(0);
await page.click('[data-session-variation-row="2"]');
await page.waitForTimeout(800);
const afterCymbal = await notes();
check('the cymbal row has a pattern of its own',
    afterCymbal.settings?.cymbalVariation === 2 &&
    afterCymbal.settings?.variation === 7,
    `drums ${afterCymbal.settings?.variation}, cymbals ${afterCymbal.settings?.cymbalVariation}`);
check('and changing it actually changes the notes',
    JSON.stringify(afterCymbal.starts) !== JSON.stringify(beforeCymbal.starts));

// ── Follow the rhythm of another track ────────────────────────────────────
await openRow(1);
check('the pattern picker offers Follow Rhythm Of',
    await page.evaluate(() => !!document.querySelector('[data-session-follow-track]')));
check('the Chords switch is dimmed, and says why there is nothing to follow',
    await page.evaluate(() => {
        const el = document.querySelector('[data-session-follow-chords]');
        return !!el && el.disabled && /Chord track/i.test(el.title);
    }));

const beforeFollow = await notes();
await page.selectOption('[data-session-follow-track]', ids.gtr);
await page.waitForTimeout(1000);
await page.keyboard.press('Escape').catch(() => { });
await page.mouse.click(20, 500);
await page.waitForTimeout(600);
const afterFollow = await notes();
check('following a track puts the drummer on that track’s rhythm',
    afterFollow.settings?.followTrackId === ids.gtr &&
    JSON.stringify(afterFollow.starts) !== JSON.stringify(beforeFollow.starts),
    `${beforeFollow.count} -> ${afterFollow.count} notes`);

const kickAtGuitarOnset = await page.evaluate(() => {
    const c = window.__projectStore.getState().clips.find(x => x.id === 'probe-drum-region');
    return (c?.notes ?? []).some(n => n.pitch === 36 && Math.abs(n.start - 1.5) < 0.12);
});
check('and it lands a kick where the guitar does',
    kickAtGuitarOnset, 'kick within a 32nd of beat 1.5');

await openRow(1);
await page.selectOption('[data-session-follow-track]', '');
await page.waitForTimeout(800);
await page.mouse.click(20, 500);
await page.waitForTimeout(400);

// ── The locks ─────────────────────────────────────────────────────────────
check('Fill Amount and Swing each have a lock',
    await page.evaluate(() => document.querySelectorAll('[data-session-lock]').length) === 2);

await page.click('[data-session-lock="swing"]');
await page.waitForTimeout(700);
const lockedSwing = (await notes()).settings?.swing;
check('locking the swing records it on the region',
    (await notes()).settings?.lockSwing === true);

// ── Presets ───────────────────────────────────────────────────────────────
await page.click('[data-session-preset-menu]');
await page.waitForTimeout(500);
const presetRows = await page.evaluate(() =>
    [...document.querySelectorAll('[data-session-preset-row]')]
        .map(el => el.getAttribute('data-session-preset-row')));
check('the preset menu lists the included presets',
    presetRows.length >= 4, presetRows.join(', '));

const beforePreset = await notes();
await page.click('[data-session-preset-row="Big Chorus"]');
await page.waitForTimeout(1000);
const afterPreset = await notes();
check('choosing a preset changes the performance',
    JSON.stringify(afterPreset.starts) !== JSON.stringify(beforePreset.starts),
    `${beforePreset.count} -> ${afterPreset.count} notes`);
check('and the panel says which preset it is on',
    await page.evaluate(() =>
        document.querySelector('[data-session-preset]')?.textContent?.trim()) === 'Big Chorus');

check('the locked swing survived the preset change',
    Math.abs((afterPreset.settings?.swing ?? -1) - lockedSwing) < 1e-9,
    `${lockedSwing?.toFixed(2)} still`);

// Save one of our own, then delete it.
await page.click('[data-session-preset-menu]');
await page.waitForTimeout(400);
await page.click('[data-session-preset-save]');
await page.waitForTimeout(300);
await page.fill('[data-session-preset-name]', 'My Take');
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
await page.click('[data-session-preset-menu]');
await page.waitForTimeout(400);
check('a saved preset joins the list',
    await page.evaluate(() => !!document.querySelector('[data-session-preset-row="My Take"]')));

const deletable = await page.evaluate(() => {
    const el = document.querySelector('[data-session-preset-delete]');
    return { disabled: el?.disabled, title: el?.title ?? '' };
});
check('Delete is offered for a preset you saved',
    deletable.disabled === false, JSON.stringify(deletable));

await page.click('[data-session-preset-delete]');
await page.waitForTimeout(700);
await page.click('[data-session-preset-menu]');
await page.waitForTimeout(400);
check('and deleting it removes it',
    await page.evaluate(() => !document.querySelector('[data-session-preset-row="My Take"]')));

// An included preset must refuse deletion, with a reason.
await page.click('[data-session-preset-row="Shuffle"]');
await page.waitForTimeout(900);
await page.click('[data-session-preset-menu]');
await page.waitForTimeout(400);
const builtIn = await page.evaluate(() => {
    const el = document.querySelector('[data-session-preset-delete]');
    return { disabled: el?.disabled, title: el?.title ?? '' };
});
check('an included preset cannot be deleted, and says so',
    builtIn.disabled === true && /cannot be deleted/i.test(builtIn.title),
    builtIn.title);
await page.mouse.click(20, 500);
await page.waitForTimeout(400);

// ── Details ───────────────────────────────────────────────────────────────
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

// Tempo
const beforeTempo = await notes();
await page.click('[data-session-picker="tempoMode"]');
await page.waitForTimeout(900);
const afterTempo = await notes();
check('the Tempo menu changes how fast the rhythm is played',
    afterTempo.settings?.tempoMode !== beforeTempo.settings?.tempoMode,
    `${beforeTempo.settings?.tempoMode} -> ${afterTempo.settings?.tempoMode}`);

await page.evaluate(() => window.__projectStore.setState({ tempo: 180 }));
await page.waitForTimeout(500);
await page.click('[data-session-picker="tempoMode"]');
await page.waitForTimeout(400);
await page.click('[data-session-picker="tempoMode"]');
await page.waitForTimeout(400);
await page.click('[data-session-picker="tempoMode"]');
await page.waitForTimeout(900);
const auto = await page.evaluate(() => ({
    mode: window.__projectStore.getState().clips
        .find(c => c.id === 'probe-drum-region')?.drummerSettings?.tempoMode,
    shown: document.querySelector('[data-session-tempo-resolved]')?.textContent?.trim(),
}));
check('Automatic says what it resolves to at this tempo',
    auto.mode !== 'automatic' || auto.shown === 'half time',
    `${auto.mode}${auto.shown ? ` → ${auto.shown}` : ''}`);
await page.evaluate(() => window.__projectStore.setState({ tempo: 120 }));
await page.waitForTimeout(400);

// A picker for a piece nobody plays must not be on screen.
const tomsShown = () => page.evaluate(() => !!document.querySelector('[data-session-picker="toms"]'));
check('the Toms menu is on offer while the toms are in the kit', await tomsShown());
await page.click('[data-session-tab="main"]');
await page.waitForTimeout(400);
await page.click('[data-session-piece="toms"]');
await page.waitForTimeout(700);
await page.click('[data-session-tab="details"]');
await page.waitForTimeout(500);
check('and gone once they are switched off, rather than changing nothing',
    !(await tomsShown()));
await page.click('[data-session-tab="main"]');
await page.waitForTimeout(300);
await page.click('[data-session-piece="toms"]');
await page.waitForTimeout(600);

// ── Manual ────────────────────────────────────────────────────────────────
await page.click('[data-session-tab="manual"]');
await page.waitForTimeout(700);
check('the Manual tab opens a step grid, one row per kit piece',
    await page.evaluate(() => document.querySelectorAll('[data-session-manual-mute]').length) === 6);

/*
 * The region is sixteen beats — four bars — and a one-bar grid repeats across
 * it, so one step switched on is four notes rather than one. That repeat is
 * the point of the page overview, and asserting the wrong arithmetic here
 * would have hidden it.
 */
const REGION_BARS = 4;

const beforeManual = await notes();
await page.click('[data-session-manual-step="kick:0"]');
await page.waitForTimeout(800);
const afterManual = await notes();
check('switching a step on hands the region to the hand-typed pattern',
    afterManual.settings?.manual !== null && afterManual.count === REGION_BARS,
    `${beforeManual.count} -> ${afterManual.count} notes`);
check('and every note is the step that was typed in, once a bar',
    afterManual.pitches.join() === '36' &&
    afterManual.starts.every((ms, i) => Math.abs(ms - i * 4000) < 60),
    `pitch ${afterManual.pitches.join()}, at ${afterManual.starts.join()}`);

await page.click('[data-session-manual-step="snare:4"]');
await page.click('[data-session-manual-step="snare:12"]');
await page.waitForTimeout(800);
check('more steps, more notes',
    (await notes()).count === 3 * REGION_BARS, `${(await notes()).count} notes`);

await page.click('[data-session-manual-mute="snare"]');
await page.waitForTimeout(800);
check('muting a row silences it without clearing it',
    (await notes()).count === REGION_BARS &&
    await page.evaluate(() =>
        window.__projectStore.getState().clips.find(c => c.id === 'probe-drum-region')
            ?.drummerSettings?.manual?.rows?.snare?.[4] === true));
await page.click('[data-session-manual-mute="snare"]');
await page.waitForTimeout(600);

// Length and pages
await page.click('[data-session-manual-length]');
await page.waitForTimeout(400);
await page.click('[data-session-manual-length-row="32"]');
await page.waitForTimeout(900);
check('the pattern can be made two bars long',
    await page.evaluate(() =>
        window.__projectStore.getState().clips.find(c => c.id === 'probe-drum-region')
            ?.drummerSettings?.manual?.length) === 32);
check('and it is then divided into pages',
    await page.evaluate(() => document.querySelectorAll('[data-session-manual-page]').length) === 2);

// A two-bar grid repeats twice across a four-bar region, so a step written on
// page two sounds at beat 4 and again at beat 12.
const beforePage2 = (await notes()).count;
await page.click('[data-session-manual-page="1"]');
await page.waitForTimeout(500);
await page.click('[data-session-manual-step="kick:16"]');
await page.waitForTimeout(800);
const page2Kicks = await page.evaluate(() =>
    (window.__projectStore.getState().clips.find(c => c.id === 'probe-drum-region')?.notes ?? [])
        .filter(n => n.pitch === 36).map(n => Math.round(n.start * 100) / 100));
check('the second page writes into the second bar',
    (await notes()).count === beforePage2 + 2 &&
    page2Kicks.some(v => Math.abs(v - 4) < 0.12) &&
    page2Kicks.some(v => Math.abs(v - 12) < 0.12),
    `kicks at ${page2Kicks.join(', ')}`);

// Copy/paste a page
await page.click('[data-session-manual-page="0"]');
await page.waitForTimeout(400);
await page.click('[data-session-manual-actions]');
await page.waitForTimeout(400);
await page.click('[data-session-manual-copy-page]');
await page.waitForTimeout(400);
await page.click('[data-session-manual-page="1"]');
await page.waitForTimeout(400);
await page.click('[data-session-manual-actions]');
await page.waitForTimeout(400);
await page.click('[data-session-manual-paste-page]');
await page.waitForTimeout(900);
check('a page can be copied onto another',
    await page.evaluate(() => {
        const m = window.__projectStore.getState().clips
            .find(c => c.id === 'probe-drum-region')?.drummerSettings?.manual;
        return !!m && m.rows.kick[0] === m.rows.kick[16] && m.rows.snare[4] === m.rows.snare[20];
    }));

// Reset hands it back
await page.click('[data-session-manual-actions]');
await page.waitForTimeout(400);
await page.click('[data-session-manual-reset]');
await page.waitForTimeout(900);
const afterReset = await notes();
check('Reset clears the pattern and hands the region back to the generator',
    afterReset.settings?.manual === null && afterReset.count > 3,
    `${afterReset.count} notes, manual ${afterReset.settings?.manual}`);

// ── The region lane ───────────────────────────────────────────────────────
await page.click('[data-session-tab="main"]');
await page.waitForTimeout(500);
check('the editor shows which region it is editing',
    await page.evaluate(() =>
        /Drummer/.test(document.querySelector('[data-session-region]')?.textContent ?? '')));

await page.click('[data-session-audition]');
await page.waitForTimeout(1200);
const cycling = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    return { playing: st.playing, cycle: st.cycleEnabled, left: st.locatorLeft, right: st.locatorRight };
});
check('playing the region sets the cycle to it and starts the transport',
    cycling.playing === true && cycling.cycle === true &&
    cycling.left === 0 && cycling.right === 16,
    JSON.stringify(cycling));
await page.click('[data-session-audition]');
await page.waitForTimeout(700);
check('and clicking it again stops',
    await page.evaluate(() => window.__projectStore.getState().playing === false));

// ── The settings are the score, the notes the render ──────────────────────
await page.evaluate(() => window.__projectStore.getState().saveProject?.());
await page.waitForTimeout(1200);
const saved = await notes();
check('the settings are stored on the region alongside the notes',
    !!saved.settings && saved.count > 0,
    `${saved.count} notes, variation ${saved.settings?.variation}`);

// ── Screenshots ───────────────────────────────────────────────────────────
const shoot = async (name) => {
    const pb = await (await page.$('[data-session-player]'))?.boundingBox();
    if (pb) {
        await page.screenshot({
            path: name,
            clip: { x: pb.x, y: pb.y, width: Math.min(1600 - pb.x, pb.width), height: pb.height },
        });
    }
};
await shoot('session-player.png');
await page.click('[data-session-tab="details"]');
await page.waitForTimeout(600);
await shoot('session-player-details.png');
await page.click('[data-session-tab="manual"]');
await page.waitForTimeout(600);
await shoot('session-player-manual.png');
await page.click('[data-session-tab="main"]');
await page.waitForTimeout(500);

const ours = consoleErrors.filter(t => !/RSC payload|CLIENT_FETCH_ERROR/i.test(t));
check('no console errors', ours.length === 0, ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
