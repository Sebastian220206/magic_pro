/**
 * localSoundfonts.ts
 * SoundFonts served from `public/soundfonts/` rather than from Supabase.
 *
 * The library previously had exactly one source: fonts uploaded to Supabase by
 * an admin, recorded as `SoundFontLibraryItem` rows. A `.sf2` dropped into
 * `public/soundfonts/` was served statically by Next but never appeared in the
 * app, because nothing created a row for it and the preset reader could only
 * download from Supabase.
 *
 * ## Two sources, because a deployment cannot use the filesystem
 *
 * `public/soundfonts/` is gitignored — a GM bank is ~30 MB of binary. The build
 * fetches one (`npm run soundfont:gm`) so the CDN can serve it, which is enough
 * for the browser to *play* it.
 *
 * Listing it is a different problem. On a serverless host the function has no
 * `public/` directory at all: those files are served by the CDN and the
 * function never sees them. A directory scan therefore returns nothing in
 * production — silently, because a missing directory is indistinguishable from
 * an empty one. That is exactly how the deployed app ended up with an empty
 * instrument picker and no error anywhere.
 *
 * So bundled fonts come from `data/soundfontManifest.json`, generated at build
 * time and imported like any other module. The directory scan remains, but only
 * as a development convenience for fonts a developer has on disk and the
 * deployment does not.
 */

import { promises as fs } from 'fs';
import path from 'path';

import manifest from '@/data/soundfontManifest.json';
import { soundfontFileUrl } from './soundfontUrl';

/** Ids are prefixed so a local font is never confused with a database row. */
export const LOCAL_ID_PREFIX = 'local:';

export const SOUNDFONT_DIR = path.join(process.cwd(), 'public', 'soundfonts');

export interface LocalSoundfont {
    id: string;
    name: string;
    category: string;
    /** Public URL Next serves the file from. */
    fileUrl: string;
    fileSizeKb: number;
    storagePath: string;
    /** True for a General MIDI bank — surfaced first, since it covers everything. */
    isGeneralMidi: boolean;
}

/** A preset as recorded in the build-time manifest. */
export interface ManifestPreset {
    index: number;
    name: string;
    bank: number;
    program: number;
}

const SF_EXTENSIONS = new Set(['.sf2', '.sf3']);

/** Guess a category from the filename so the picker can group sensibly. */
function categorise(fileName: string): string {
    const n = fileName.toLowerCase();
    if (/general\s*midi|generaluser|fluid|gm\b|_gm/.test(n)) return 'General MIDI';
    if (/piano|grand|rhodes|clav/.test(n)) return 'Piano & Keys';
    if (/drum|percussion|kit/.test(n)) return 'Drums & Percussion';
    if (/guitar|bass/.test(n)) return 'Guitar & Bass';
    if (/violin|cello|string|orchestr/.test(n)) return 'Strings';
    if (/brass|horn|trumpet|sax/.test(n)) return 'Brass & Winds';
    if (/organ|jeux/.test(n)) return 'Organ';
    if (/synth|pad|lead/.test(n)) return 'Synths';
    return 'Other';
}

/** A stable, readable name from the filename. */
function displayName(fileName: string): string {
    return fileName
        .replace(/\.(sf2|sf3)$/i, '')
        // Drop size annotations like "(22,719KB)" that some packs carry.
        .replace(/\s*\([\d,]+\s*[kKmM]B\)\s*/g, '')
        .trim();
}

/** Encode a filename into an id that survives a URL path segment. */
export function toLocalId(fileName: string): string {
    return LOCAL_ID_PREFIX + encodeURIComponent(fileName);
}

/** Recover the filename from a local id, or null when the id isn't local. */
export function fromLocalId(id: string): string | null {
    if (!id.startsWith(LOCAL_ID_PREFIX)) return null;

    const decoded = decodeURIComponent(id.slice(LOCAL_ID_PREFIX.length));
    // The id becomes a filesystem path, so reject anything that could escape
    // the soundfont directory.
    if (!decoded || decoded.includes('/') || decoded.includes('\\') || decoded.includes('..')) {
        return null;
    }
    if (!SF_EXTENSIONS.has(path.extname(decoded).toLowerCase())) return null;

    return decoded;
}

/** Absolute path of a local font, or null if the id is not valid. */
export function localSoundfontPath(id: string): string | null {
    const fileName = fromLocalId(id);
    if (!fileName) return null;

    const full = path.join(SOUNDFONT_DIR, fileName);
    // Belt and braces: confirm the resolved path really is inside the directory.
    if (!full.startsWith(SOUNDFONT_DIR)) return null;

    return full;
}

/**
 * Describe a font from its filename.
 *
 * Shared by both sources so a font discovered on disk in development and the
 * same font listed from the manifest in production get an identical id, name
 * and category — otherwise a project saved locally would reference an id that
 * production could not resolve.
 */
function describe(fileName: string, fileSizeKb: number): LocalSoundfont {
    const category = categorise(fileName);
    return {
        id: toLocalId(fileName),
        name: displayName(fileName),
        category,
        fileUrl: soundfontFileUrl(fileName),
        fileSizeKb,
        storagePath: fileName,
        isGeneralMidi: category === 'General MIDI',
    };
}

interface ManifestFont {
    fileName: string;
    fileSizeKb: number;
    presets: ManifestPreset[];
}

const MANIFEST_FONTS: ManifestFont[] = manifest.fonts ?? [];

/** Fonts the build ships. Available everywhere, filesystem or not. */
export function listBundledSoundfonts(): LocalSoundfont[] {
    return MANIFEST_FONTS.map(font => describe(font.fileName, font.fileSizeKb));
}

/**
 * How many fonts this build ships.
 *
 * Read by `/api/health`: a deployment with none has no instruments, which is
 * otherwise invisible — the picker is simply empty and nothing errors.
 */
export function bundledSoundfontCount(): number {
    return MANIFEST_FONTS.length;
}

/**
 * The presets of a bundled font, or null if it is not in the manifest.
 *
 * Indices match `SoundFontParser` exactly — see
 * `tests/smoke/soundfontManifest.test.ts`, which pins the two together.
 */
export function bundledPresets(id: string): ManifestPreset[] | null {
    const fileName = fromLocalId(id);
    if (!fileName) return null;

    return MANIFEST_FONTS.find(font => font.fileName === fileName)?.presets ?? null;
}

/** Fonts sitting in `public/soundfonts/`, empty when there is no such directory. */
async function scanSoundfontDir(): Promise<LocalSoundfont[]> {
    let entries: string[];
    try {
        entries = await fs.readdir(SOUNDFONT_DIR);
    } catch {
        // No directory: a serverless deployment, or a clone that has not run
        // `npm run soundfont:gm`. Either way the manifest still applies.
        return [];
    }

    const fonts: LocalSoundfont[] = [];

    for (const fileName of entries) {
        if (!SF_EXTENSIONS.has(path.extname(fileName).toLowerCase())) continue;

        try {
            const stat = await fs.stat(path.join(SOUNDFONT_DIR, fileName));
            if (!stat.isFile()) continue;
            fonts.push(describe(fileName, Math.round(stat.size / 1024)));
        } catch {
            continue;
        }
    }

    return fonts;
}

/**
 * Every SoundFont available without a Supabase upload.
 *
 * The manifest is authoritative — it describes what was actually deployed. The
 * directory scan adds anything else a developer happens to have locally, which
 * is how a font dropped into `public/soundfonts/` still shows up immediately
 * without regenerating the manifest.
 */
export async function listLocalSoundfonts(): Promise<LocalSoundfont[]> {
    const fonts = listBundledSoundfonts();
    const seen = new Set(fonts.map(f => f.storagePath));

    for (const font of await scanSoundfontDir()) {
        if (!seen.has(font.storagePath)) fonts.push(font);
    }

    // A General MIDI bank covers piano, brass, bass, strings and more in one
    // file, so it belongs at the top of the list.
    return fonts.sort((a, b) => {
        if (a.isGeneralMidi !== b.isGeneralMidi) return a.isGeneralMidi ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}
