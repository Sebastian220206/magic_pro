#!/usr/bin/env node
/**
 * upload-media.mjs
 * Publish the encoded hero assets to Supabase Storage.
 *
 * A script rather than a manual drag-and-drop because the bucket has to be
 * public and the cache headers have to be long — both easy to forget, and both
 * silent when wrong. A private bucket returns 400 to the video element, which
 * shows as an empty box with no error.
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY from .env. That key bypasses row-level
 * security, so this is a local developer tool; it must never run in the browser
 * or in a request handler.
 *
 * Usage:
 *   node scripts/upload-media.mjs
 *   node scripts/upload-media.mjs --bucket media
 */

import { readFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'media', 'dist');

/** Files to publish, and the content type each must be served with. */
const ASSETS = [
    { file: 'hero-loop.mp4', contentType: 'video/mp4' },
    { file: 'hero-poster.jpg', contentType: 'image/jpeg' },
];

/** Minimal .env reader — no dependency, and this only ever runs locally. */
function loadEnv() {
    const path = join(ROOT, '.env');
    if (!existsSync(path)) return;

    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
}

function parseArgs(argv) {
    const args = { bucket: 'media' };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--bucket') args.bucket = argv[++i];
    }
    return args;
}

async function main() {
    loadEnv();
    const { bucket } = parseArgs(process.argv);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!url || !serviceKey) {
        console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
        return 1;
    }

    const missing = ASSETS.filter(a => !existsSync(join(DIST, a.file)));
    if (missing.length) {
        console.error(`Missing: ${missing.map(m => m.file).join(', ')}`);
        console.error('Run `node scripts/build-hero-video.mjs` first.');
        return 1;
    }

    const supabase = createClient(url, serviceKey);

    // The bucket must be public: the video element fetches it unauthenticated.
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        console.error('Could not list buckets:', listError.message);
        return 1;
    }

    const existing = buckets?.find(b => b.name === bucket);
    if (!existing) {
        console.log(`Creating public bucket "${bucket}"…`);
        const { error } = await supabase.storage.createBucket(bucket, { public: true });
        if (error) {
            console.error('Could not create bucket:', error.message);
            return 1;
        }
    } else if (!existing.public) {
        console.error(
            `Bucket "${bucket}" exists but is private. The video element fetches ` +
            `it without credentials, so it must be public.`);
        return 1;
    }

    console.log(`\nUploading to "${bucket}":\n`);
    const urls = {};

    for (const { file, contentType } of ASSETS) {
        const body = await readFile(join(DIST, file));

        const { error } = await supabase.storage.from(bucket).upload(file, body, {
            contentType,
            // These are immutable in practice — re-encoding produces a new file
            // that is uploaded over the same name, so a long max-age is only
            // safe alongside `upsert`. Change the filename if that stops being
            // true.
            cacheControl: '31536000',
            upsert: true,
        });

        if (error) {
            console.error(`  ${file}: FAILED — ${error.message}`);
            return 1;
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(file);
        urls[file] = data.publicUrl;
        console.log(`  ${file.padEnd(18)} ${(body.length / 1024 / 1024).toFixed(2)} MB  ok`);
    }

    console.log('\nSet these — locally in .env, and in your host\'s dashboard:\n');
    console.log(`NEXT_PUBLIC_HERO_LOOP_URL="${urls['hero-loop.mp4']}"`);
    console.log(`NEXT_PUBLIC_HERO_POSTER_URL="${urls['hero-poster.jpg']}"`);
    console.log(`NEXT_PUBLIC_DASHBOARD_LOOP_URL="${urls['hero-loop.mp4']}"`);
    console.log();
    return 0;
}

main().then(code => process.exit(code)).catch(error => {
    console.error(error);
    process.exit(1);
});
