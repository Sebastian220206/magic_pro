#!/usr/bin/env node
/**
 * Audit Logic Pro's feature areas against what this DAW can actually reach.
 *
 * "The code exists" is not evidence a feature works. In this codebase a feature
 * can be present at four very different levels, and only the last one counts:
 *
 *   1. a module exists but nothing imports it        (unreachable)
 *   2. it is imported but never rendered              (unrendered)
 *   3. it renders but no control opens it             (untriggered)
 *   4. it renders and is fed real project state       (works)
 *
 * Every earlier attempt to answer "what is missing?" by grepping for feature
 * names got it wrong — time-stretch looked absent because `phaseVocoder.ts` was
 * dead, while the feature had been working through `FlexTime.ts` all along.
 *
 *   node scripts/audit-features.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { ROOT, rel } from './studio-files.mjs';

const dead = new Set(
    execSync('python3 scripts/find-unreachable.py', { encoding: 'utf8' })
        .split('\n').map(l => l.trim().split(/\s+/)[1]).filter(Boolean)
);

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (['node_modules', '.next', '.git'].includes(name) || name.startsWith('.')) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(full) && !full.includes('__tests__')) out.push(full);
    }
    return out;
}

const files = walk(ROOT).map(f => ({ path: rel(f), src: readFileSync(f, 'utf8') }));
const liveSrc = files.filter(f => !dead.has(f.path)).map(f => f.src).join('\n');

/**
 * Each entry names the module(s) that would implement the feature and a token
 * that must appear in *live* source for it to be reachable.
 */
const AREAS = [
    ['Recording', [
        ['Audio recording', 'engine/audioRecording/recorder.ts', 'getAudioRecorder'],
        ['Take folders / comping', null, 'isTakeFolder'],
        ['Punch in / out', null, 'autopunch'],
        ['Count-in / metronome', null, 'metronome'],
        ['Step input', 'components/StepInputKeyboard.tsx', 'StepInputKeyboard'],
    ]],
    ['Editors', [
        ['Piano Roll', 'components/midi/PianoRoll.tsx', 'PianoRoll'],
        ['Step Sequencer', 'components/midi/StepSequencer.tsx', 'StepSequencer'],
        ['Event List', 'components/ListEditors.tsx', 'ListEditors'],
        ['Score / notation', 'engine/score/ScoreRenderer.ts', 'ScoreRenderer'],
        ['Audio Track Editor', 'components/AudioTrackEditor.tsx', 'AudioTrackEditor'],
    ]],
    ['Mixing', [
        ['Mixer / channel strips', 'components/Mixer.tsx', 'Mixer'],
        ['Sends and buses', null, 'sends'],
        ['Track automation', null, 'addAutomationPoint'],
        ['Mute / solo groups', 'engine/mixer/muteSoloGroups.ts', 'muteSoloGroup'],
        ['VCA faders', 'engine/mixer/vcaFader.ts', 'VcaFader'],
        ['Sidechain', null, 'sidechain'],
    ]],
    ['Instruments', [
        ['Sampler / SoundFont', null, 'soundFont'],
        ['Drum machine', null, 'drumMachine'],
        ['Drummer / session player', null, 'drummer'],
        ['Multi-output instruments', 'engine/instruments/multiOutputInstrument.ts', 'MultiOutput'],
    ]],
    ['Audio processing', [
        ['Flex Time (stretch)', 'engine/audio/FlexTime.ts', 'FlexTimeProcessor'],
        ['Flex Pitch', 'engine/audio/FlexPitch.ts', 'FlexPitch'],
        ['Audio quantize', 'engine/audio/AudioQuantizer.ts', 'AudioQuantizer'],
        ['Stem separation', null, 'separateStems'],
        ['Audio to MIDI', 'engine/audio/audioToMidi.ts', 'audioToMidi'],
        ['Spectral editing', 'engine/audio/spectralEditor.ts', 'spectralEdit'],
    ]],
    ['Production', [
        ['Live Loops', 'components/LiveLoopsGrid.tsx', 'LiveLoopsGrid'],
        ['Loop library', 'components/LoopBrowser.tsx', 'LoopBrowser'],
        ['Smart Tempo', null, 'smartTempo'],
        ['Track freeze', 'engine/audioEngine/trackFreeze.ts', 'freezeTrack'],
        ['Bounce / export', null, 'bounceEngine'],
        ['Project alternatives', null, 'alternatives'],
    ]],
    ['Plugins', [
        ['Built-in effects', 'engine/plugins/registerBuiltins.ts', 'getBuiltinManifest'],
        ['Channel EQ editor', 'components/ChannelEQ.tsx', 'ChannelEQ'],
        ['Third-party (WAM)', 'engine/plugins/wam/wamProcessor.ts', 'WamInsertProcessor'],
        ['Plugin latency comp', null, 'latencyComp'],
    ]],
    ['Hardware & sync', [
        ['MIDI input devices', null, 'midiInputRouter'],
        ['Control surfaces', 'engine/midi/ControlSurfaceEngine.ts', 'ControlSurface'],
        ['MTC / external sync', 'engine/midi/mtcSync.ts', 'mtcSync'],
        ['Audio device selection', null, 'outputDevice'],
    ]],
];

const status = (module, token) => {
    if (module && !existsSync(join(ROOT, module))) return ['ABSENT', 'no such module'];
    if (module && dead.has(module)) return ['UNREACHABLE', `${module} imported by nothing`];
    const hit = new RegExp(`\\b${token}`).test(liveSrc);
    return hit ? ['REACHABLE', ''] : ['ABSENT', `no live reference to ${token}`];
};

let counts = { REACHABLE: 0, UNREACHABLE: 0, ABSENT: 0 };
for (const [area, rows] of AREAS) {
    console.log(`\n${area}`);
    for (const [name, module, token] of rows) {
        const [state, note] = status(module, token);
        counts[state]++;
        console.log(`  ${state.padEnd(12)} ${name}${note ? '  — ' + note : ''}`);
    }
}
console.log(`\n  reachable ${counts.REACHABLE} · unreachable ${counts.UNREACHABLE} · absent ${counts.ABSENT}\n`);
