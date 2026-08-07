#!/usr/bin/env node
/**
 * build-hero-video.mjs
 * Turn the source vision film into the assets the site actually serves.
 *
 * ## Why this is a script and not a one-off command
 *
 * The settings below are load-bearing and easy to get subtly wrong in ways that
 * only show up on a slow connection, so they belong in the repository rather
 * than in somebody's shell history. Re-run it whenever the film changes.
 *
 * ## The two things that matter most
 *
 * **`-movflags +faststart`.** By default ffmpeg writes the `moov` atom — the
 * index a player needs before it can decode anything — at the *end* of the file.
 * The source film has exactly this problem: its `moov` sits after 50 MB of
 * `mdat`, so a browser must download the whole thing before showing one frame.
 * Locally that is invisible, because the file loads from disk instantly. On a
 * real connection it is the difference between a background that fades in and
 * one that appears half a minute later.
 *
 * **Length.** The source is 100 seconds. As a looping background that is ~50 MB
 * on every page load, which exhausts a 5 GB monthly egress allowance in about a
 * hundred visits. A 12 s loop of the same footage is ~1.8 MB.
 *
 * The source is abstract motion graphics — falling gold notes — with no
 * narrative, so nothing is lost by looping a slice of it. Its final ~12 seconds
 * are a stock-pack advertisement, which `USABLE_END_SECONDS` exists to exclude.
 *
 * Usage:
 *   node scripts/build-hero-video.mjs                 # loop + poster
 *   node scripts/build-hero-video.mjs --thumbs        # contact sheet, to pick a segment
 *   node scripts/build-hero-video.mjs --start 34 --duration 12
 */

import { spawn } from 'child_process';
import { mkdir, readdir, stat, rm } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ffmpegPath from 'ffmpeg-static';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'media', 'source', 'welcome-vision.mp4');
const DIST = join(ROOT, 'media', 'dist');
const THUMBS = join(DIST, 'thumbs');

/**
 * The source film stops being usable at ~88 s.
 *
 * The last ~12 seconds are a bright pink "FREE GFX / CLICK HERE TO SUBSCRIBE"
 * promo card belonging to the stock pack it came from. It must never reach the
 * site, so any segment is clamped to end before it.
 */
const USABLE_END_SECONDS = 88;

/** Defaults chosen to be safe rather than ideal — see --thumbs to pick better. */
const DEFAULTS = {
    start: 20,
    duration: 12,
    /**
     * Seconds of crossfade wrapping the loop's end back onto its own beginning.
     * Without it the loop restarts on a hard cut, which on a slow full-screen
     * background reads as a glitch rather than a loop.
     */
    crossfade: 1,
};

/**
 * Encode settings, chosen by measuring rather than by taste.
 *
 * The loop plays full-bleed at full brightness with no scrim over it, so
 * compression artefacts are directly visible and resolution is worth paying
 * for. (It was 720p while a heavy overlay hid both.) Measured on this footage,
 * 12 s:
 *
 *   1920×1080 CRF 28   5.38 MB
 *   1920×1080 CRF 30   4.44 MB
 *   1920×1080 CRF 32   3.64 MB   <- chosen; clean at 1:1, no visible blocking
 *   1280×720  CRF 33   1.84 MB   <- previous, when a dark overlay covered it
 *
 * There is deliberately no WebM sibling. VP9 was measured on the same segment
 * and lost at every setting tried — 3.05 MB at CRF 45, 2.50 MB at CRF 48, both
 * worse than H.264 at 720p. libvpx handles this dense particle motion badly. A
 * second format only earns its bandwidth and encode time if it is smaller, and
 * H.264 is supported everywhere anyway.
 */
const LOOP_SCALE = '1920:-2';
const LOOP_CRF = '32';

function parseArgs(argv) {
    const args = { ...DEFAULTS, thumbs: false };
    for (let i = 2; i < argv.length; i++) {
        const flag = argv[i];
        if (flag === '--thumbs') args.thumbs = true;
        else if (flag === '--start') args.start = Number(argv[++i]);
        else if (flag === '--duration') args.duration = Number(argv[++i]);
        else if (flag === '--crossfade') args.crossfade = Number(argv[++i]);
    }
    return args;
}

function run(label, ffmpegArgs) {
    return new Promise((resolve, reject) => {
        process.stdout.write(`  ${label}… `);
        const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...ffmpegArgs]);

        let stderr = '';
        child.stderr.on('data', d => { stderr += d.toString(); });

        child.on('error', reject);
        child.on('close', code => {
            if (code === 0) { console.log('ok'); resolve(); }
            else {
                console.log('FAILED');
                reject(new Error(`${label} exited ${code}\n${stderr.trim()}`));
            }
        });
    });
}

async function sizeMb(path) {
    try { return (await stat(path)).size / 1024 / 1024; } catch { return 0; }
}

/**
 * Assert the `moov` atom precedes `mdat`.
 *
 * This is the whole point of `+faststart`, it is silent when wrong, and a single
 * dropped flag reintroduces it. So it is checked rather than assumed.
 */
async function assertFaststart(path) {
    const { open } = await import('fs/promises');
    const handle = await open(path, 'r');
    try {
        const size = (await handle.stat()).size;
        const buf = Buffer.alloc(16);
        let pos = 0;
        const order = [];

        while (pos < size && order.length < 12) {
            const { bytesRead } = await handle.read(buf, 0, 16, pos);
            if (bytesRead < 8) break;
            let len = buf.readUInt32BE(0);
            const type = buf.toString('latin1', 4, 8);
            if (len === 1) len = Number(buf.readBigUInt64BE(8));
            if (len < 8) break;
            order.push(type);
            pos += len;
        }

        const moov = order.indexOf('moov');
        const mdat = order.indexOf('mdat');
        if (moov === -1) throw new Error(`no moov atom in ${path}`);
        if (mdat !== -1 && moov > mdat) {
            throw new Error(
                `${path}: moov comes after mdat — playback would need the whole ` +
                `file downloaded first. Is -movflags +faststart missing?`);
        }
        return order.join(' ');
    } finally {
        await handle.close();
    }
}

/**
 * Filter graph that makes the loop seamless.
 *
 * Splits the trimmed segment, takes a copy of its first `crossfade` seconds,
 * fades that copy in on the alpha channel, shifts it to land on the segment's
 * final seconds, and overlays it. The last frame therefore already looks like
 * the first, so the jump back is invisible.
 */
function seamlessLoopFilter(duration, crossfade, scale) {
    if (crossfade <= 0) return null;
    const offset = duration - crossfade;
    return [
        `[0:v]scale=${scale},split[body][head]`,
        `[head]trim=duration=${crossfade},setpts=PTS-STARTPTS,` +
        `format=yuva420p,fade=t=in:st=0:d=${crossfade}:alpha=1,` +
        `setpts=PTS+${offset}/TB[fadein]`,
        `[body]trim=duration=${duration},setpts=PTS-STARTPTS[main]`,
        `[main][fadein]overlay=format=auto[out]`,
    ].join(';');
}

/** Evenly spaced stills, so a human can choose a loop segment. */
async function buildThumbnails() {
    await rm(THUMBS, { recursive: true, force: true });
    await mkdir(THUMBS, { recursive: true });

    // One frame every 5 s, scaled small — these are for choosing, not shipping.
    await run('thumbnails', [
        '-i', SOURCE,
        '-vf', 'fps=1/5,scale=480:-2',
        join(THUMBS, 'at-%03d.jpg'),
    ]);

    const files = (await readdir(THUMBS)).sort();
    console.log(`\n  ${files.length} stills in media/dist/thumbs/, one every 5 s.`);
    console.log('  The Nth file starts at (N-1)*5 seconds. Pick a start, then:');
    console.log('    node scripts/build-hero-video.mjs --start <seconds>\n');
}

async function main() {
    const args = parseArgs(process.argv);

    if (!ffmpegPath) {
        console.error('ffmpeg-static did not provide a binary path.');
        return 1;
    }
    try {
        await stat(SOURCE);
    } catch {
        console.error(`Source film not found at ${SOURCE}`);
        console.error('Place the vision film there (it is gitignored) and re-run.');
        return 1;
    }

    await mkdir(DIST, { recursive: true });

    if (args.thumbs) {
        await buildThumbnails();
        return 0;
    }

    const { start, crossfade } = args;
    let { duration } = args;

    // Never let a segment run into the promo card at the tail of the source.
    if (start + duration > USABLE_END_SECONDS) {
        const clamped = Math.max(0, USABLE_END_SECONDS - start);
        console.warn(
            `  Segment would reach ${start + duration}s, but the source's ` +
            `"FREE GFX" promo card starts around ${USABLE_END_SECONDS}s.`);
        if (clamped < 2) {
            console.error(`  Start ${start}s leaves no usable footage. Choose an earlier start.`);
            return 1;
        }
        console.warn(`  Clamping duration to ${clamped}s.\n`);
        duration = clamped;
    }

    console.log(`\nBuilding from ${start}s, ${duration}s long, ${crossfade}s crossfade\n`);

    const loopMp4 = join(DIST, 'hero-loop.mp4');
    const poster = join(DIST, 'hero-poster.jpg');

    const filter = seamlessLoopFilter(duration, crossfade, LOOP_SCALE);
    const videoMap = filter
        ? ['-filter_complex', filter, '-map', '[out]']
        : ['-t', String(duration), '-vf', `scale=${LOOP_SCALE}`];

    // -ss before -i seeks by keyframe, which is fast and accurate enough here.
    const trim = ['-ss', String(start), '-i', SOURCE];

    await run('hero-loop.mp4', [
        ...trim, ...videoMap,
        '-an',                       // the background is always muted; audio is dead weight
        '-c:v', 'libx264',
        '-profile:v', 'high',
        '-crf', LOOP_CRF,
        '-preset', 'slow',
        '-pix_fmt', 'yuv420p',       // Safari will not decode yuv444
        '-movflags', '+faststart',
        loopMp4,
    ]);

    await run('hero-poster.jpg', [
        '-ss', String(start), '-i', SOURCE,
        '-frames:v', '1',
        '-vf', `scale=${LOOP_SCALE}`,
        '-q:v', '6',
        poster,
    ]);


    console.log('\nVerifying faststart (moov must precede mdat):');
    for (const file of [loopMp4]) {
        const order = await assertFaststart(file);
        console.log(`  ${file.replace(ROOT, '.')}  ->  ${order}`);
    }

    console.log('\nOutputs:');
    for (const file of [loopMp4, poster]) {
        console.log(`  ${String((await sizeMb(file)).toFixed(2)).padStart(7)} MB  ${file.replace(ROOT, '.')}`);
    }
    console.log('\nUpload media/dist/ to the Supabase `media` bucket and set the');
    console.log('NEXT_PUBLIC_*_URL variables. See README → Hero video.\n');
    return 0;
}

main().then(code => process.exit(code)).catch(error => {
    console.error('\n' + error.message);
    process.exit(1);
});
