/**
 * Simulates what `SamplePlayer` would actually do for a note-on, for every
 * preset in the installed General MIDI bank.
 *
 * The zone-level audit (gmPresetAudit) only proves the parser produced zones.
 * This one asks the question that matters: when the piano roll plays middle C,
 * how many sample zones match, and are they the right ones? A preset that
 * fires 40 voices for one key is "loaded" but unusable.
 *
 * Skips itself when the font is not installed.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { SoundFontParser } from '@/engine/instruments/soundfont/SoundFontParser';

const FONT = path.join(process.cwd(), 'public', 'soundfonts', 'GeneralUser-GS.sf2');

const GEN_SAMPLE_ID = 53;
const GEN_KEY_RANGE = 43;
const GEN_VEL_RANGE = 44;

interface Zone { lo: number; hi: number; vlo: number; vhi: number; sample: number }

/** Mirror of SamplePlayer.loadPreset's zone resolution. */
function resolve(preset: { zones: { generators: { genOper: number; genValue: number }[] }[] }): Zone[] {
    const out: Zone[] = [];
    for (const zone of preset.zones ?? []) {
        const m = new Map<number, number>();
        for (const g of zone.generators) m.set(g.genOper, g.genValue);
        const sample = m.get(GEN_SAMPLE_ID) ?? -1;
        if (sample < 0) continue;
        const kr = m.get(GEN_KEY_RANGE);
        const vr = m.get(GEN_VEL_RANGE);
        out.push({
            lo: kr === undefined ? 0 : kr & 0xff,
            hi: kr === undefined ? 127 : (kr >> 8) & 0xff,
            vlo: vr === undefined ? 0 : vr & 0xff,
            vhi: vr === undefined ? 127 : (vr >> 8) & 0xff,
            sample,
        });
    }
    return out;
}

/** Mirror of SamplePlayer.noteOn's zone selection, including its fallback. */
function voicesFor(zones: Zone[], note: number, vel: number): Zone[] {
    const byKey = zones.filter(z => note >= z.lo && note <= z.hi);
    if (byKey.length === 0) return [];
    const exact = byKey.filter(z => vel >= z.vlo && vel <= z.vhi);
    if (exact.length > 0) return exact;
    let min = Infinity;
    const scored = byKey.map(z => {
        const d = vel < z.vlo ? z.vlo - vel : vel > z.vhi ? vel - z.vhi : 0;
        if (d < min) min = d;
        return { z, d };
    });
    return scored.filter(s => s.d === min).map(s => s.z);
}

describe('GeneralUser GS voice audit', () => {
    test('each preset produces a sane number of voices per note', async () => {
        let buffer: ArrayBuffer;
        try {
            const data = await fs.readFile(FONT);
            buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        } catch {
            console.warn('[audit] GeneralUser-GS.sf2 not installed — skipping.');
            return;
        }

        const parsed = new SoundFontParser().parse(buffer);
        const MAX_VOICES = 64;

        const silent: string[] = [];
        const overloaded: { label: string; worst: number; note: number }[] = [];
        let worstOverall = 0;
        const histogram = new Map<number, number>();

        parsed.presets.forEach((preset, index) => {
            const label = `#${index} ${preset.name.trim()} (bank ${preset.bank}, prog ${preset.preset})`;
            const zones = resolve(preset as never);

            let worst = 0;
            let worstNote = -1;
            let anySound = false;

            for (let note = 21; note <= 108; note++) {
                for (const vel of [1, 40, 80, 100, 127]) {
                    const n = voicesFor(zones, note, vel).length;
                    if (n > 0) anySound = true;
                    if (n > worst) { worst = n; worstNote = note; }
                }
            }

            if (!anySound) silent.push(label);
            if (worst > 4) overloaded.push({ label, worst, note: worstNote });
            worstOverall = Math.max(worstOverall, worst);
            histogram.set(worst, (histogram.get(worst) ?? 0) + 1);
        });

        console.log('\n──────── GM voice audit ────────');
        console.log(`presets:                 ${parsed.presets.length}`);
        console.log(`silent for every note:   ${silent.length}`);
        console.log(`>4 voices for one key:   ${overloaded.length}`);
        console.log(`worst single key:        ${worstOverall} voices (allocator holds ${MAX_VOICES})`);

        console.log('\nvoices-per-key distribution:');
        [...histogram.entries()].sort((a, b) => a[0] - b[0]).forEach(([voices, count]) =>
            console.log(`  ${String(voices).padStart(4)} voices : ${count} presets`));

        if (silent.length) console.log('\nsilent:\n  ' + silent.slice(0, 20).join('\n  '));
        if (overloaded.length) {
            console.log('\nworst offenders:');
            overloaded.sort((a, b) => b.worst - a.worst).slice(0, 20).forEach(o =>
                console.log(`  ${o.worst} voices @ note ${o.note} — ${o.label}`));
        }
        console.log('────────────────────────────────\n');
    }, 120000);
});
