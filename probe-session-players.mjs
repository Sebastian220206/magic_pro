/**
 * The three Session Players.
 *
 * The Drummer existed; the Bass Player and Keyboard Player did not, and the
 * New Track dialog offered both while creating a drummer track for each. Both
 * needed chords, so a Chord track had to come first.
 *
 * What this checks is not that the controls exist but that moving them changes
 * the notes in the region — and, for the two new players, that the notes follow
 * the harmony rather than repeating one shape.
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

// One track per player, plus a guitar part for Follow Rhythm Of to lock to.
await page.evaluate(() => {
    window.__projectStore.getState().addTracks([
        { name: 'Drums', type: 'drummer', color: '#fb923c' },
        { name: 'Bass', type: 'bass-player', color: '#f472b6' },
        { name: 'Keys', type: 'keyboard-player', color: '#a78bfa' },
        { name: 'Guitar', type: 'software-instrument', color: '#22d3ee', instrument: 'piano' },
    ]);
});
await page.waitForTimeout(1600);

const ids = await page.evaluate(() => {
    const st = window.__projectStore.getState();
    const by = t => st.tracks.find(x => x.type === t)?.id;
    const guitar = st.tracks.find(x => x.name === 'Guitar');
    // A guitar part on the off-beats, so following it is visible.
    st.addClip({
        id: 'guitar-region', trackId: guitar.id, type: 'midi', name: 'Guitar',
        color: guitar.color, alternativeId: guitar.activeAlternativeId,
        start: 0, startTime: 0, duration: 16, offset: 0, muted: false, loop: false,
        qSwing: 0, transpose: 0, velocityOffset: 0, playbackRate: 1, pitchOffset: 0,
        stretchMode: 'none',
        fadeIn: { duration: 0, curve: 'linear', gain: 1 },
        fadeOut: { duration: 0, curve: 'linear', gain: 1 },
        notes: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].map((b, i) => ({
            id: `g${i}`, pitch: 60, start: b, duration: 0.2, velocity: 90,
        })),
    });
    return { drummer: by('drummer'), bass: by('bass-player'), keyboard: by('keyboard-player'), guitar: guitar.id };
});
await page.waitForTimeout(1000);

/* ── Drawing a region on each ─────────────────────────────────────────── */
await page.evaluate(() => window.__projectStore.getState().setCurrentTool('pencil'));
await page.waitForTimeout(500);

const drawOn = async (trackId, offset = 260) => {
    const box = await page.evaluate(([id, off]) => {
        const row = document.querySelector(`[data-track-row="${id}"]`);
        if (!row) return null;
        const r = row.getBoundingClientRect();
        const header = row.closest('div[style*="width"]');
        return { x: header.getBoundingClientRect().right + off, y: r.top + r.height / 2 };
    }, [trackId, offset]);
    if (!box) return false;
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(800);
    return true;
};

for (const [kind, id] of [['drummer', ids.drummer], ['bass', ids.bass], ['keyboard', ids.keyboard]]) {
    await drawOn(id);
    const clip = await page.evaluate(t => {
        const c = window.__projectStore.getState().clips.filter(x => x.trackId === t).at(-1);
        return c ? { name: c.name, notes: c.notes?.length ?? 0, player: c.sessionPlayer } : null;
    }, id);
    check(`the pencil draws a ${kind} region that already plays`,
        !!clip && clip.notes > 0 && clip.player === kind,
        clip ? `${clip.name}, ${clip.notes} notes, player ${clip.player}` : 'nothing drawn');
}
await page.evaluate(() => window.__projectStore.getState().setCurrentTool('pointer'));
await page.waitForTimeout(400);

/* ── The editor opens for each ─────────────────────────────────────────── */
const openEditorFor = async (trackId) => {
    await page.evaluate(id => {
        const st = window.__projectStore.getState();
        st.selectTrack(id);
        const clip = st.clips.filter(c => c.trackId === id).at(-1);
        if (clip) st.selectClip(clip.id);
    }, trackId);
    await page.waitForTimeout(900);
};

await page.hover('[data-view-toggles-shell]');
await page.waitForTimeout(300);
await page.click('[data-view-button="editors"]');
await page.waitForTimeout(1000);

for (const [kind, id] of [['drummer', ids.drummer], ['bass', ids.bass], ['keyboard', ids.keyboard]]) {
    await openEditorFor(id);
    check(`the Editors button opens the ${kind}'s own panel`,
        await page.evaluate(k => document.querySelector('[data-session-player]')?.dataset.sessionKind === k, kind),
        await page.evaluate(() => document.querySelector('[data-session-player]')?.dataset.sessionKind));
}

await openEditorFor(ids.guitar);
check('a plain software instrument still gets the piano roll',
    await page.evaluate(() => !document.querySelector('[data-session-player]')));

/* ── Chords ────────────────────────────────────────────────────────────── */
await openEditorFor(ids.bass);
const bassClip = () => page.evaluate(t => {
    const c = window.__projectStore.getState().clips.filter(x => x.trackId === t).at(-1);
    const notes = c?.notes ?? [];
    return {
        count: notes.length,
        pitches: notes.map(n => n.pitch),
        classes: [...new Set(notes.map(n => ((n.pitch % 12) + 12) % 12))].sort((a, b) => a - b),
        starts: notes.map(n => Math.round(n.start * 1000)),
        chords: (c?.chords ?? []).length,
        settings: c?.bassSettings ?? null,
    };
}, ids.bass);

const beforeChords = await bassClip();
check('with no chords, the bass plays the key tonic only',
    beforeChords.classes.length <= 3 && beforeChords.classes.includes(0),
    `pitch classes ${beforeChords.classes.join(', ')}`);

await page.click('[data-session-chords]');
await page.waitForTimeout(500);
check('the Chords menu opens', await page.evaluate(() => !!document.querySelector('[data-session-chords-menu]')));

await page.click('[data-session-progression="I – V – vi – IV"]');
await page.waitForTimeout(1200);
const withChords = await bassClip();
check('applying a progression writes chords onto the region',
    withChords.chords === 4, `${withChords.chords} chords`);
check('and the bass line follows them',
    withChords.classes.length > beforeChords.classes.length,
    `pitch classes ${withChords.classes.join(', ')}`);

// C - G - Am - F: the downbeat of each bar must be that chord's root.
const roots = await page.evaluate(t => {
    const c = window.__projectStore.getState().clips.filter(x => x.trackId === t).at(-1);
    return [0, 4, 8, 12].map(beat => {
        const n = (c.notes ?? []).find(x => Math.abs(x.start - beat) < 0.2);
        return n ? ((n.pitch % 12) + 12) % 12 : null;
    });
}, ids.bass);
check('each bar lands on its own chord root',
    JSON.stringify(roots) === JSON.stringify([0, 7, 9, 5]),
    `got ${roots.join(', ')} — wanted C G A F`);

/* ── Every bass control changes the notes ──────────────────────────────── */
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

const pickOption = async (picker, option) => {
    await page.click(`[data-session-picker="${picker}"]`);
    await page.waitForTimeout(350);
    await page.click(`[data-session-picker-option="${picker}:${option}"]`);
    await page.waitForTimeout(800);
};

const beforeMelody = await bassClip();
await pickOption('melody', 'root-only');
const rootOnly = await bassClip();
check('the Melody picker changes which notes the line uses',
    rootOnly.settings?.melody === 'root-only'
    && rootOnly.classes.length <= beforeMelody.classes.length,
    `${beforeMelody.classes.length} -> ${rootOnly.classes.length} pitch classes`);

await pickOption('melody', 'passing');
const passing = await bassClip();
check('and passing notes reach outside the chord',
    passing.classes.length > rootOnly.classes.length,
    `${rootOnly.classes.length} -> ${passing.classes.length} pitch classes`);

await page.click('[data-session-tab="details"]');
await page.waitForTimeout(600);
const beforeDead = await bassClip();
await dragKnob('deadNotes', 90);
const withDead = await bassClip();
check('Dead Notes adds notes to the line',
    withDead.count > beforeDead.count, `${beforeDead.count} -> ${withDead.count} notes`);

const beforeSlides = await bassClip();
await dragKnob('slides', 90);
const withSlides = await bassClip();
check('Slides adds lead-in notes',
    withSlides.count > beforeSlides.count, `${beforeSlides.count} -> ${withSlides.count} notes`);

await page.click('[data-session-toggle="pickupHits"]');
await page.waitForTimeout(800);
const withPickups = await bassClip();
check('Pickup Hits adds them again',
    withPickups.count > withSlides.count, `${withSlides.count} -> ${withPickups.count} notes`);

/* ── The keyboard's two hands ──────────────────────────────────────────── */
await openEditorFor(ids.keyboard);
await page.waitForTimeout(600);
await page.click('[data-session-tab="main"]');
await page.waitForTimeout(500);

const keysClip = () => page.evaluate(t => {
    const c = window.__projectStore.getState().clips.filter(x => x.trackId === t).at(-1);
    const notes = c?.notes ?? [];
    return {
        count: notes.length,
        low: notes.length ? Math.min(...notes.map(n => n.pitch)) : 0,
        high: notes.length ? Math.max(...notes.map(n => n.pitch)) : 0,
        settings: c?.keyboardSettings ?? null,
    };
}, ids.keyboard);

const bothHands = await keysClip();
check('the keyboard part spans both hands',
    bothHands.high - bothHands.low > 12,
    `${bothHands.low}..${bothHands.high}`);

await page.click('[data-session-hand="right"]');
await page.waitForTimeout(900);
const leftOnly = await keysClip();
check('muting the right hand leaves only the left',
    leftOnly.settings?.rightHand === false && leftOnly.high < bothHands.high,
    `top note ${bothHands.high} -> ${leftOnly.high}`);
await page.click('[data-session-hand="right"]');
await page.waitForTimeout(700);

const beforeVoicing = await keysClip();
await pickOption('leftVoicing', 'root-fifth-octave');
const wideVoicing = await keysClip();
check('Left-Hand Voicing changes how many notes it plays',
    wideVoicing.count > beforeVoicing.count,
    `${beforeVoicing.count} -> ${wideVoicing.count} notes`);

await pickOption('leftStyle', 'steady-8ths');
const busy = await keysClip();
check('Left-Hand Style changes how often it plays',
    busy.count > wideVoicing.count, `${wideVoicing.count} -> ${busy.count} notes`);

/* ── Follow Rhythm Of a track ──────────────────────────────────────────── */
const beforeFollow = await keysClip();
await page.click('[data-session-variation="0"]');
await page.waitForTimeout(500);
check('the Patterns dialog offers eight patterns and a Follow section',
    await page.evaluate(() => document.querySelectorAll('[data-session-variation-row]').length === 8
        && !!document.querySelector('[data-session-follow-chords]')));
await page.click(`[data-session-follow-track="${ids.guitar}"]`);
await page.waitForTimeout(1000);
const following = await keysClip();
check('following a track places notes where its notes fall',
    following.settings?.followTrackId === ids.guitar && following.count > beforeFollow.count,
    `${beforeFollow.count} -> ${following.count} notes`);

/* ── The Session Player dialog ─────────────────────────────────────────── */
await page.click('[data-session-player-button]');
await page.waitForTimeout(500);
check('the Session Player dialog opens with a Type and styles',
    await page.evaluate(() => !!document.querySelector('[data-session-kind="bass"]')
        && document.querySelectorAll('[data-session-style-row]').length > 3));

const beforeStyle = await keysClip();
await page.click('[data-session-style-row="Block Chords"]');
await page.waitForTimeout(1000);
const styled = await keysClip();
check('choosing a style changes the performance',
    styled.count !== beforeStyle.count || styled.high !== beforeStyle.high,
    `${beforeStyle.count} -> ${styled.count} notes`);
check('and it loads the style\'s instrument',
    await page.evaluate(id => window.__projectStore.getState().tracks.find(t => t.id === id)?.instrument,
        ids.keyboard) === 'Grand Piano');

// Changing Type turns this region into a different player's.
await page.click('[data-session-player-button]');
await page.waitForTimeout(400);
await page.click('[data-session-kind="bass"]');
await page.waitForTimeout(1000);
check('the Type pop-up changes which player performs the region',
    await page.evaluate(() => document.querySelector('[data-session-player]')?.dataset.sessionKind === 'bass'));
await page.click('[data-session-player-button]');
await page.waitForTimeout(400);
await page.click('[data-session-kind="keyboard"]');
await page.waitForTimeout(900);

/* ── Manual view ───────────────────────────────────────────────────────── */
await page.click('[data-session-tab="manual"]');
await page.waitForTimeout(600);
check('the keyboard\'s Manual view offers a row per hand',
    await page.evaluate(() => !!document.querySelector('[data-session-manual-mute="left"]')
        && !!document.querySelector('[data-session-manual-mute="right"]')));

const beforeManual = await keysClip();
for (const step of [0, 4, 8, 12]) {
    await page.click(`[data-session-manual-step="right:${step}"]`);
    await page.waitForTimeout(300);
}
const manual = await keysClip();
check('typing a pattern in replaces the generated one',
    manual.settings?.manual != null && manual.count !== beforeManual.count,
    `${beforeManual.count} -> ${manual.count} notes`);

await page.click('[data-session-manual-action]');
await page.waitForTimeout(400);
await page.click('[data-session-manual-reset]');
await page.waitForTimeout(800);
check('Reset goes back to the chosen pattern',
    await page.evaluate(t => {
        const c = window.__projectStore.getState().clips.filter(x => x.trackId === t).at(-1);
        return c?.keyboardSettings?.manual == null && (c?.notes?.length ?? 0) > 0;
    }, ids.keyboard));

/* ── Screenshots ───────────────────────────────────────────────────────── */
await page.click('[data-session-tab="main"]');
await page.waitForTimeout(700);
const shot = async (name) => {
    const box = await (await page.$('[data-session-player]'))?.boundingBox();
    if (box) {
        await page.screenshot({
            path: name,
            clip: { x: box.x, y: box.y, width: Math.min(1600 - box.x, box.width), height: box.height },
        });
    }
};
await shot('session-keyboard.png');
await openEditorFor(ids.bass);
await page.click('[data-session-tab="main"]');
await page.waitForTimeout(700);
await shot('session-bass.png');

const ours = consoleErrors.filter(t => !/RSC payload|CLIENT_FETCH_ERROR/i.test(t));
check('no console errors', ours.length === 0, ours.slice(0, 2).join(' | ') || 'clean');

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
