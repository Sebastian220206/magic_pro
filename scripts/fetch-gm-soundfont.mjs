#!/usr/bin/env node
/**
 * fetch-gm-soundfont.mjs
 * Download a General MIDI SoundFont into `public/soundfonts/`.
 *
 * A GM bank contains all 128 General MIDI programs — acoustic and electric
 * pianos, the brass section, strings and ensembles, basses, organs, guitars,
 * woodwinds and percussion — in a single file. Because the app enumerates every
 * preset in a font, one GM bank turns into a complete instrument list.
 *
 * The file is not committed: `.gitignore` excludes `*.sf2`, and a binary of this
 * size does not belong in git history. Run this after cloning, or point a
 * deployment at a CDN copy instead.
 *
 * Usage:
 *   node scripts/fetch-gm-soundfont.mjs            # default bank
 *   node scripts/fetch-gm-soundfont.mjs --list     # show the options
 *   node scripts/fetch-gm-soundfont.mjs --bank fluid
 */

import { createWriteStream } from 'fs';
import { mkdir, stat, unlink } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { BANKS, DEFAULT_BANK } from './gmBanks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_DIR = join(ROOT, 'public', 'soundfonts');

function parseArgs(argv) {
    const args = { bank: DEFAULT_BANK, list: false, force: false };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--list') args.list = true;
        else if (argv[i] === '--force') args.force = true;
        else if (argv[i] === '--bank') args.bank = argv[++i];
    }
    return args;
}

function showBanks() {
    console.log('\nAvailable General MIDI banks:\n');
    for (const [key, bank] of Object.entries(BANKS)) {
        console.log(`  ${key.padEnd(12)} ${bank.name} (~${bank.approxMb} MB)`);
        console.log(`  ${''.padEnd(12)} ${bank.credit}`);
        console.log(`  ${''.padEnd(12)} Licence: ${bank.license}\n`);
    }
    console.log(`Default: ${DEFAULT_BANK}\n`);
}

async function alreadyPresent(filePath) {
    try {
        const info = await stat(filePath);
        return info.size > 1024 * 1024 ? info.size : 0;
    } catch {
        return 0;
    }
}

async function download(url, filePath, approxMb) {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
    }

    const total = Number(response.headers.get('content-length') ?? 0);
    let received = 0;
    let lastPrinted = 0;

    const source = Readable.fromWeb(response.body);
    source.on('data', chunk => {
        received += chunk.length;
        const mb = received / (1024 * 1024);
        // Report roughly every 5 MB so the log stays readable.
        if (mb - lastPrinted >= 5) {
            lastPrinted = mb;
            const pct = total ? ` (${Math.round((received / total) * 100)}%)` : '';
            process.stdout.write(`  ${mb.toFixed(0)} / ~${approxMb} MB${pct}\n`);
        }
    });

    await pipeline(source, createWriteStream(filePath));
    return received;
}

async function main() {
    const args = parseArgs(process.argv);

    if (args.list) {
        showBanks();
        return 0;
    }

    // This runs as `prebuild`, so a failure fails the build — which is what we
    // want, because a deployment without a bank has no instruments and says so
    // nowhere. The escape hatch is for building deliberately without one.
    if (process.env.SKIP_SOUNDFONT_FETCH) {
        console.log('SKIP_SOUNDFONT_FETCH is set — not fetching a GM bank.');
        console.log('The build will have no bundled instruments.\n');
        return 0;
    }

    const bank = BANKS[args.bank];
    if (!bank) {
        console.error(`Unknown bank "${args.bank}". Run with --list to see the options.`);
        return 1;
    }

    await mkdir(TARGET_DIR, { recursive: true });
    const filePath = join(TARGET_DIR, bank.fileName);

    const existing = await alreadyPresent(filePath);
    if (existing && !args.force) {
        console.log(`${bank.fileName} is already present (${(existing / 1024 / 1024).toFixed(1)} MB).`);
        console.log('Pass --force to download it again.');
        return 0;
    }

    console.log(`\nDownloading ${bank.name} (~${bank.approxMb} MB)`);
    console.log(`  ${bank.credit}`);
    console.log(`  Licence: ${bank.license}\n`);

    let lastError;
    for (const url of bank.urls) {
        try {
            const bytes = await download(url, filePath, bank.approxMb);
            console.log(`\nSaved ${bank.fileName} (${(bytes / 1024 / 1024).toFixed(1)} MB) to public/soundfonts/`);
            console.log('It will appear in the instrument picker on the next page load.\n');
            return 0;
        } catch (error) {
            lastError = error;
            console.warn(`  Source failed (${error.message}), trying the next one…`);
            // Remove the partial file so a half-download is never mistaken for
            // a real font.
            await unlink(filePath).catch(() => { });
        }
    }

    console.error(`\nCould not download ${bank.name}: ${lastError?.message ?? 'unknown error'}`);
    console.error('Download it manually and place the .sf2 in public/soundfonts/ instead.\n');
    return 1;
}

main().then(code => process.exit(code)).catch(error => {
    console.error(error);
    process.exit(1);
});
