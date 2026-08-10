import {
    buildInstrumentMenu,
    countInstrumentLeaves,
    choiceLabel,
    sameChoice,
    trackFieldsFor,
    DEFAULT_INSTRUMENT,
    type MenuNode,
    type InstrumentChoice,
} from '../instrumentCatalog';
import { instrumentRegistry, hasInstrument } from '@/engine/instruments/instrumentRegistry';

const menu = buildInstrumentMenu();

/** Every leaf choice in the tree, depth-first. */
function leaves(nodes: MenuNode[] = menu): InstrumentChoice[] {
    return nodes.flatMap(n =>
        n.kind === 'item' ? [n.choice] : n.kind === 'submenu' ? leaves(n.children) : []
    );
}

function submenuNamed(label: string, nodes: MenuNode[] = menu): MenuNode | undefined {
    for (const n of nodes) {
        if (n.kind !== 'submenu') continue;
        if (n.label === label) return n;
        const deeper = submenuNamed(label, n.children);
        if (deeper) return deeper;
    }
    return undefined;
}

describe('buildInstrumentMenu', () => {
    it('leads with an empty strip and the default patch', () => {
        expect(menu[0]).toMatchObject({ kind: 'item', label: 'Empty Channel Strip', emphasis: true });
        expect(menu[1]).toMatchObject({ kind: 'item', label: 'Default Patch' });
        expect(menu[2]).toMatchObject({ kind: 'separator' });
    });

    it('offers every registry instrument exactly once', () => {
        const fromMenu = leaves()
            .filter((c): c is Extract<InstrumentChoice, { kind: 'registry' }> => c.kind === 'registry')
            .map(c => c.name);
        // Default Patch repeats Grand Piano deliberately, so compare as sets.
        expect(new Set(fromMenu)).toEqual(new Set(Object.keys(instrumentRegistry)));
    });

    /**
     * The point of building from the registry rather than transcribing Logic's
     * plugin list: every leaf has to be something this build can load.
     */
    it('never lists a registry instrument the engine does not know', () => {
        for (const c of leaves()) {
            if (c.kind === 'registry') expect(hasInstrument(c.name)).toBe(true);
        }
    });

    it('groups the 128 General MIDI programs into families of eight', () => {
        const gm = submenuNamed('General MIDI');
        expect(gm).toBeDefined();

        const piano = submenuNamed('Piano', (gm as any).children);
        expect(piano).toBeDefined();
        expect((piano as any).children).toHaveLength(8);
        expect((piano as any).children[0].label).toBe('Grand Piano');

        // All sixteen families present, and together exactly the 128 programs.
        const families = ['Piano', 'Chromatic Percussion', 'Organ', 'Guitar', 'Bass', 'Strings',
            'Ensemble', 'Brass', 'Reed', 'Pipe', 'Synth Lead', 'Synth Pad',
            'Synth Effects', 'Ethnic', 'Percussive', 'Sound Effects'];
        let total = 0;
        for (const f of families) {
            const node = submenuNamed(f, (gm as any).children);
            expect(node).toBeDefined();
            total += (node as any).children.length;
        }
        expect(total).toBe(128);
    });

    it('keeps drum kits out of the melodic families', () => {
        const gm = submenuNamed('General MIDI');
        const drums = submenuNamed('Drum Kits', (gm as any).children);
        expect(drums).toBeDefined();
        expect((drums as any).children.length).toBeGreaterThan(0);
    });

    it('gives every soundfont leaf a preset index', () => {
        const sf = leaves().filter(c => c.kind === 'soundfont');
        expect(sf.length).toBeGreaterThan(128);
        for (const c of sf) {
            expect(typeof (c as any).presetIndex).toBe('number');
            expect((c as any).fileName).toMatch(/\.sf2$/i);
        }
    });

    it('has no empty submenu', () => {
        const walk = (nodes: MenuNode[]) => {
            for (const n of nodes) {
                if (n.kind !== 'submenu') continue;
                expect(n.children.length).toBeGreaterThan(0);
                walk(n.children);
            }
        };
        walk(menu);
    });

    it('counts every leaf', () => {
        expect(countInstrumentLeaves()).toBe(leaves().length);
    });
});

describe('trackFieldsFor', () => {
    it('gives an empty strip no instrument at all', () => {
        expect(trackFieldsFor({ kind: 'none' })).toEqual({});
    });

    it('gives a registry instrument just a name', () => {
        expect(trackFieldsFor({ kind: 'registry', name: 'Deep Bass' }))
            .toEqual({ instrument: 'Deep Bass' });
    });

    /**
     * A name alone cannot rebuild a SoundFont voice — the engine needs the file
     * and the preset index, which is why the Track model carries `soundFont`.
     */
    it('gives a soundfont preset the file and index as well as the name', () => {
        const fields = trackFieldsFor({
            kind: 'soundfont', name: 'Marimba', fileName: 'GeneralUser-GS.sf2', presetIndex: 12,
        });
        expect(fields.instrument).toBe('Marimba');
        expect(fields.soundFont).toEqual({
            url: '/soundfonts/GeneralUser-GS.sf2',
            presetIndex: 12,
            presetName: 'Marimba',
        });
    });

    it('percent-encodes a filename with a space', () => {
        const fields = trackFieldsFor({
            kind: 'soundfont', name: 'X', fileName: 'My Font.sf2', presetIndex: 0,
        });
        expect(fields.soundFont!.url).toBe('/soundfonts/My%20Font.sf2');
    });
});

describe('the default', () => {
    it('is an instrument the engine recognises', () => {
        expect(DEFAULT_INSTRUMENT.kind).toBe('registry');
        expect(hasInstrument((DEFAULT_INSTRUMENT as any).name)).toBe(true);
    });

    /** Regression: the dialog hard-coded 'Steinway Piano', which is not registered. */
    it('is not the old unregistered name', () => {
        expect((DEFAULT_INSTRUMENT as any).name).not.toBe('Steinway Piano');
        expect(hasInstrument('Steinway Piano')).toBe(false);
    });
});

describe('sameChoice', () => {
    it('separates two presets from the same file', () => {
        const a: InstrumentChoice = { kind: 'soundfont', name: 'A', fileName: 'f.sf2', presetIndex: 1 };
        const b: InstrumentChoice = { kind: 'soundfont', name: 'B', fileName: 'f.sf2', presetIndex: 2 };
        expect(sameChoice(a, a)).toBe(true);
        expect(sameChoice(a, b)).toBe(false);
    });

    it('separates the same preset index in different files', () => {
        expect(sameChoice(
            { kind: 'soundfont', name: 'A', fileName: 'one.sf2', presetIndex: 1 },
            { kind: 'soundfont', name: 'A', fileName: 'two.sf2', presetIndex: 1 },
        )).toBe(false);
    });

    it('separates kinds', () => {
        expect(sameChoice({ kind: 'none' }, { kind: 'registry', name: 'Grand Piano' })).toBe(false);
    });
});

describe('choiceLabel', () => {
    it('names the empty strip rather than showing a blank button', () => {
        expect(choiceLabel({ kind: 'none' })).toBe('Empty Channel Strip');
    });

    it('uses the instrument name otherwise', () => {
        expect(choiceLabel({ kind: 'registry', name: 'Wobble Bass' })).toBe('Wobble Bass');
        expect(choiceLabel({ kind: 'soundfont', name: 'Ocarina', fileName: 'f.sf2', presetIndex: 79 }))
            .toBe('Ocarina');
    });
});
