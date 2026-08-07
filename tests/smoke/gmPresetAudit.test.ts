/**
 * Diagnostic audit of every preset in the installed General MIDI bank.
 *
 * Not a unit test of a pure function — it reads the real .sf2 from
 * `public/soundfonts/` and reports which presets resolve to playable sample
 * zones. Skips itself when the font is not installed.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { SoundFontParser } from '@/engine/instruments/soundfont/SoundFontParser';

const FONT = path.join(process.cwd(), 'public', 'soundfonts', 'GeneralUser-GS.sf2');

const GEN_SAMPLE_ID = 53;
const GEN_KEY_RANGE = 43;
const GEN_VEL_RANGE = 44;

describe('GeneralUser GS preset audit', () => {
    test('every preset resolves to playable sample zones', async () => {
        let buffer: ArrayBuffer;
        try {
            const data = await fs.readFile(FONT);
            buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        } catch {
            console.warn('[audit] GeneralUser-GS.sf2 not installed — skipping.');
            return;
        }

        const parsed = new SoundFontParser().parse(buffer);

        const empty: string[] = [];
        const noSample: string[] = [];
        const badKeyRange: string[] = [];
        let totalZones = 0;

        parsed.presets.forEach((preset, index) => {
            const label = `#${index} ${preset.name.trim()} (bank ${preset.bank}, prog ${preset.preset})`;

            if (!preset.zones || preset.zones.length === 0) {
                empty.push(label);
                return;
            }
            totalZones += preset.zones.length;

            const withSample = preset.zones.filter(z =>
                z.generators.some(g => g.genOper === GEN_SAMPLE_ID));
            if (withSample.length === 0) {
                noSample.push(label);
                return;
            }

            // A zone whose key range excludes middle C would be silent for a
            // normal piano-roll note even though it "loaded".
            const covers60 = withSample.some(z => {
                const kr = z.generators.find(g => g.genOper === GEN_KEY_RANGE);
                if (!kr) return true; // no range = full range
                const lo = kr.genValue & 0xff;
                const hi = (kr.genValue >> 8) & 0xff;
                return 60 >= Math.min(lo, hi) && 60 <= Math.max(lo, hi);
            });
            if (!covers60) badKeyRange.push(label);
        });

        console.log('\n──────── GM preset audit ────────');
        console.log(`presets:          ${parsed.presets.length}`);
        console.log(`instruments:      ${parsed.instruments.length}`);
        console.log(`sample headers:   ${parsed.sampleHeaders.length}`);
        console.log(`sample data:      ${(parsed.sampleData.length / 1_000_000).toFixed(1)}M samples`);
        console.log(`sampleRate:       ${parsed.sampleRate}`);
        console.log(`total zones:      ${totalZones}`);
        console.log(`\nzero zones:       ${empty.length}`);
        console.log(`no sampleID:      ${noSample.length}`);
        console.log(`no coverage @C4:  ${badKeyRange.length}`);

        if (empty.length) console.log('\nempty:\n  ' + empty.slice(0, 15).join('\n  '));
        if (noSample.length) console.log('\nno sample:\n  ' + noSample.slice(0, 15).join('\n  '));
        if (badKeyRange.length) console.log('\nno C4 coverage:\n  ' + badKeyRange.slice(0, 15).join('\n  '));

        // Spot-check the instruments the user asked about.
        const wanted = ['Grand Piano', 'Trumpet', 'Acoustic Bass', 'Violin', 'Tonewheel Organ'];
        console.log('\nspot checks:');
        for (const name of wanted) {
            const p = parsed.presets.find(x => x.name.trim() === name);
            if (!p) { console.log(`  ${name}: NOT FOUND`); continue; }
            const zones = p.zones?.length ?? 0;
            const withSample = (p.zones ?? []).filter(z =>
                z.generators.some(g => g.genOper === GEN_SAMPLE_ID)).length;
            console.log(`  ${name}: ${zones} zones, ${withSample} with sampleID`);
        }
        console.log('─────────────────────────────────\n');
    }, 120000);
});
