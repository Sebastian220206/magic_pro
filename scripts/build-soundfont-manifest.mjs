#!/usr/bin/env node
/**
 * build-soundfont-manifest.mjs
 * Record the preset list of every SoundFont in `public/soundfonts/` into
 * `data/soundfontManifest.json`.
 *
 * ## Why this exists
 *
 * `public/soundfonts/` is not in git — a GM bank is ~30 MB of binary. It is
 * fetched at build time by `fetch-gm-soundfont.mjs`, which puts it where the
 * CDN can serve it. That covers *playing* the font: the browser downloads the
 * `.sf2` directly.
 *
 * It does not cover *listing* it. The library and preset endpoints used to read
 * the directory with `fs`, and on a serverless host the function has no
 * `public/` directory at all — the CDN serves those files, the function never
 * sees them. `listLocalSoundfonts` catches the failure and returns an empty
 * list, so the instrument picker came up empty with nothing logged anywhere.
 *
 * The fix is to move that knowledge to build time. Preset lists are fixed
 * properties of a font, so they are extracted once here and committed as JSON.
 * The manifest is a static import, so it is bundled into the function like any
 * other module and needs no filesystem access and no 30 MB in the bundle.
 *
 * ## Preset indices
 *
 * `Track.soundFont.presetIndex` is a raw index into the parser's preset array,
 * which is built in `phdr` record order. Preset extraction lives in
 * `sf2Presets.mjs` and is pinned against `SoundFontParser` by
 * `tests/smoke/soundfontManifest.test.ts`, because these indices are stored in
 * saved projects — if the two disagreed, every instrument in every project
 * would silently change.
 *
 * Usage:
 *   node scripts/build-soundfont-manifest.mjs
 *   node scripts/build-soundfont-manifest.mjs --check   # fail if out of date
 */

import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';

import { BANK_FILENAMES } from './gmBanks.mjs';
import { extractPresets } from './sf2Presets.cjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOUNDFONT_DIR = join(ROOT, 'public', 'soundfonts');
const MANIFEST_PATH = join(ROOT, 'data', 'soundfontManifest.json');

const SF_EXTENSIONS = new Set(['.sf2', '.sf3']);

/** Describe every font currently sitting in `public/soundfonts/`. */
async function buildManifest() {
    let entries;
    try {
        entries = await readdir(SOUNDFONT_DIR);
    } catch {
        return { fonts: [] };
    }

    const fonts = [];

    for (const fileName of entries.sort()) {
        if (!SF_EXTENSIONS.has(extname(fileName).toLowerCase())) continue;

        // Only banks the build actually fetches belong in the manifest. A
        // developer's `public/soundfonts/` typically also holds hundreds of
        // megabytes of gitignored fonts; listing those would put instruments in
        // the production picker whose files were never deployed.
        if (!BANK_FILENAMES.has(fileName)) {
            console.log(`  ${fileName}: not a shipped bank, skipping`);
            continue;
        }

        const filePath = join(SOUNDFONT_DIR, fileName);
        const info = await stat(filePath);
        if (!info.isFile()) continue;

        try {
            const data = await readFile(filePath);
            const buffer = data.buffer.slice(
                data.byteOffset, data.byteOffset + data.byteLength);
            const presets = extractPresets(buffer);

            fonts.push({
                fileName,
                fileSizeKb: Math.round(info.size / 1024),
                presets,
            });
            console.log(`  ${fileName}: ${presets.length} presets`);
        } catch (error) {
            // A font that cannot be parsed is left out rather than failing the
            // build — the rest of the library still works without it.
            console.warn(`  ${fileName}: skipped (${error.message})`);
        }
    }

    return { fonts };
}

/**
 * Naming and ordering deliberately live in `lib/localSoundfonts.ts`, not here.
 * The manifest carries only raw facts, so a font discovered on disk in
 * development and one listed from the manifest in production get identical
 * names, categories and ids from the same code.
 */
async function main() {
    const check = process.argv.includes('--check');

    console.log('Reading SoundFonts from public/soundfonts/');
    const manifest = await buildManifest();

    const serialised = JSON.stringify(manifest, null, 2) + '\n';

    if (check) {
        let existing = '';
        try {
            existing = await readFile(MANIFEST_PATH, 'utf8');
        } catch {
            // Treated as a mismatch below.
        }

        // Compare content, not bytes. Git rewrites line endings on checkout,
        // so on Windows the committed file comes back as CRLF while this
        // script writes LF — a byte comparison then reports "out of date"
        // forever, on a file nobody touched.
        const normalise = text => text.replace(/\r\n/g, '\n');

        if (normalise(existing) !== normalise(serialised)) {
            console.error(
                '\ndata/soundfontManifest.json is out of date.\n' +
                'Run: npm run soundfont:manifest\n');
            return 1;
        }

        console.log('\nManifest is up to date.\n');
        return 0;
    }

    await writeFile(MANIFEST_PATH, serialised, 'utf8');

    const total = manifest.fonts.reduce((n, f) => n + f.presets.length, 0);
    console.log(
        `\nWrote data/soundfontManifest.json — ` +
        `${manifest.fonts.length} font(s), ${total} presets.\n`);
    return 0;
}

main().then(code => process.exit(code)).catch(error => {
    console.error(error);
    process.exit(1);
});
