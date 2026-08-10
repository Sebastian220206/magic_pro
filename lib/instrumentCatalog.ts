/**
 * The instrument menu, built from what this DAW can actually load.
 *
 * Two sources, deliberately kept separate:
 *
 *   - `instrumentRegistry` — 36 built-in engines (samplers, synths, wavetable,
 *     drum kits), each addressed by display name.
 *   - `data/soundfontManifest.json` — the presets inside the bundled GM font,
 *     addressed by preset index. Bank 0 is the 128 standard GM programs, which
 *     is what the General MIDI submenu exposes, grouped into the 16 families
 *     the GM spec defines. The other banks are that font's own variations and
 *     are offered as one flat "Variations" list rather than pretending to a
 *     structure the spec does not give them.
 *
 * Everything here is client-safe: `instrumentRegistry` is pure data and the
 * manifest is a plain JSON import. `lib/localSoundfonts.ts` cannot be used —
 * it imports `fs`.
 */
import { instrumentRegistry } from '@/engine/instruments/instrumentRegistry';
import manifest from '@/data/soundfontManifest.json';
import { soundfontFileUrl } from './soundfontUrl';

/** What the user picked. */
export type InstrumentChoice =
    /** An empty channel strip — a track with no instrument at all. */
    | { kind: 'none' }
    /** One of the built-in engines, by registry name. */
    | { kind: 'registry'; name: string }
    /** A preset inside a bundled SoundFont. */
    | { kind: 'soundfont'; name: string; fileName: string; presetIndex: number };

export type MenuNode =
    | { kind: 'item'; label: string; choice: InstrumentChoice; emphasis?: boolean }
    | { kind: 'separator' }
    | { kind: 'submenu'; label: string; children: MenuNode[] };

/** The 16 General MIDI families, in spec order. Each covers eight programs. */
const GM_FAMILIES = [
    'Piano', 'Chromatic Percussion', 'Organ', 'Guitar',
    'Bass', 'Strings', 'Ensemble', 'Brass',
    'Reed', 'Pipe', 'Synth Lead', 'Synth Pad',
    'Synth Effects', 'Ethnic', 'Percussive', 'Sound Effects',
];

/** The GM drum bank. Kits, not melodic programs. */
const DRUM_BANK = 128;

interface ManifestPreset { index: number; name: string; bank: number; program: number }
interface ManifestFont { fileName: string; fileSizeKb: number; presets: ManifestPreset[] }

const FONTS: ManifestFont[] = (manifest.fonts ?? []) as ManifestFont[];

/**
 * The default a new software-instrument track gets.
 *
 * Grand Piano rather than the previous hard-coded `'Steinway Piano'`, which is
 * not in the registry — `hasInstrument()` returns false for it, so anything
 * validating the track's instrument saw a name it did not recognise.
 */
export const DEFAULT_INSTRUMENT: InstrumentChoice = { kind: 'registry', name: 'Grand Piano' };

export function sameChoice(a: InstrumentChoice, b: InstrumentChoice): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'none') return true;
    if (a.kind === 'registry' && b.kind === 'registry') return a.name === b.name;
    if (a.kind === 'soundfont' && b.kind === 'soundfont') {
        return a.fileName === b.fileName && a.presetIndex === b.presetIndex;
    }
    return false;
}

/** What to show on the closed trigger button. */
export function choiceLabel(choice: InstrumentChoice): string {
    switch (choice.kind) {
        case 'none': return 'Empty Channel Strip';
        case 'registry': return choice.name;
        case 'soundfont': return choice.name;
    }
}

/**
 * The fields a track needs to carry the choice.
 *
 * A SoundFont preset needs both: `instrument` is only a display name, and the
 * engine cannot rebuild anything from a name — it needs the file and the
 * preset index. See the `soundFont` field on the Track model.
 */
export function trackFieldsFor(choice: InstrumentChoice): {
    instrument?: string;
    soundFont?: { url: string; presetIndex: number; presetName: string };
} {
    switch (choice.kind) {
        case 'none':
            return {};
        case 'registry':
            return { instrument: choice.name };
        case 'soundfont':
            return {
                instrument: choice.name,
                soundFont: {
                    url: soundfontFileUrl(choice.fileName),
                    presetIndex: choice.presetIndex,
                    presetName: choice.name,
                },
            };
    }
}

/** Registry instruments grouped by their declared category, category order preserved. */
function registryGroups(): MenuNode[] {
    const byCategory = new Map<string, MenuNode[]>();

    for (const [name, def] of Object.entries(instrumentRegistry)) {
        if (!byCategory.has(def.category)) byCategory.set(def.category, []);
        byCategory.get(def.category)!.push({
            kind: 'item',
            label: def.displayName || name,
            choice: { kind: 'registry', name },
        });
    }

    return [...byCategory].map(([category, children]) => ({
        kind: 'submenu' as const,
        label: category,
        children,
    }));
}

/** One font's presets, as GM families plus whatever else the font carries. */
function soundfontGroups(font: ManifestFont): MenuNode[] {
    const toItem = (p: ManifestPreset): MenuNode => ({
        kind: 'item',
        label: p.name,
        choice: { kind: 'soundfont', name: p.name, fileName: font.fileName, presetIndex: p.index },
    });

    const groups: MenuNode[] = [];

    // Bank 0: the 128 standard programs, in families of eight.
    const melodic = font.presets.filter(p => p.bank === 0);
    for (let family = 0; family < GM_FAMILIES.length; family++) {
        const children = melodic
            .filter(p => Math.floor(p.program / 8) === family)
            .sort((a, b) => a.program - b.program)
            .map(toItem);
        if (children.length) {
            groups.push({ kind: 'submenu', label: GM_FAMILIES[family], children });
        }
    }

    const drums = font.presets.filter(p => p.bank === DRUM_BANK).map(toItem);
    const variations = font.presets
        .filter(p => p.bank !== 0 && p.bank !== DRUM_BANK)
        .sort((a, b) => a.bank - b.bank || a.program - b.program)
        .map(toItem);

    if (drums.length || variations.length) groups.push({ kind: 'separator' });
    if (drums.length) groups.push({ kind: 'submenu', label: 'Drum Kits', children: drums });
    if (variations.length) groups.push({ kind: 'submenu', label: 'Variations', children: variations });

    return groups;
}

/**
 * The whole menu.
 *
 * Mirrors the shape of a Logic instrument popup — an empty strip and the
 * default patch on top, then categories that open to the side — but every leaf
 * is something this build can load. Listing plugin names it does not ship
 * would be a menu of dead ends.
 */
export function buildInstrumentMenu(): MenuNode[] {
    const nodes: MenuNode[] = [
        { kind: 'item', label: 'Empty Channel Strip', choice: { kind: 'none' }, emphasis: true },
        { kind: 'item', label: 'Default Patch', choice: DEFAULT_INSTRUMENT },
        { kind: 'separator' },
        ...registryGroups(),
    ];

    for (const font of FONTS) {
        const children = soundfontGroups(font);
        if (!children.length) continue;
        nodes.push({ kind: 'separator' });
        nodes.push({
            kind: 'submenu',
            // One bundled font today, so the generic label reads better than
            // the filename. More than one and each gets its own name.
            label: FONTS.length === 1 ? 'General MIDI' : font.fileName.replace(/\.sf2$/i, ''),
            children,
        });
    }

    return nodes;
}

/** How many playable instruments the menu offers. Used by tests. */
export function countInstrumentLeaves(nodes: MenuNode[] = buildInstrumentMenu()): number {
    return nodes.reduce((n, node) => {
        if (node.kind === 'item') return n + 1;
        if (node.kind === 'submenu') return n + countInstrumentLeaves(node.children);
        return n;
    }, 0);
}
