#!/usr/bin/env node
/**
 * Gather the signals needed to classify each unreachable module.
 *
 * Wiring a dead module is only correct when nothing live already does its job.
 * `phaseVocoder.ts` looked like missing time-stretch and was actually a second
 * implementation of a feature already working through `FlexTime.ts` — wiring it
 * would have made a working feature worse. So for every dead module this
 * reports what else in the tree claims the same territory.
 *
 *   node scripts/triage-dead.mjs            # table
 *   node scripts/triage-dead.mjs --json     # machine readable
 */
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { basename, extname } from 'path';

const dead = execSync('python3 scripts/find-unreachable.py', { encoding: 'utf8' })
    .split('\n')
    .map(l => l.trim().match(/^(\d+)\s+(\S+)$/))
    .filter(Boolean)
    .map(m => ({ loc: Number(m[1]), path: m[2] }))
    .filter(d => existsSync(d.path));

const deadPaths = new Set(dead.map(d => d.path));

/** First sentence of the module's leading block comment, if it has one. */
function purpose(src) {
    const m = src.match(/^\s*\/\*\*?([\s\S]{0,600}?)\*\//);
    if (!m) return '';
    return m[1]
        .split('\n')
        .map(l => l.replace(/^\s*\*ledge?\s?/, '').replace(/^\s*\*\s?/, '').trim())
        .filter(l => l && !/^[a-zA-Z0-9_.-]+\.(ts|tsx)$/.test(l))
        .join(' ')
        .split(/(?<=\.)\s/)[0]
        .slice(0, 110);
}

/** Live modules whose name shares a distinctive stem with this one. */
function rivals(path) {
    const stem = basename(path, extname(path));
    const core = stem.replace(/(Manager|Engine|Editor|Controller|Processor|Store|Panel|Dialog|Tool|View)$/, '');
    if (core.length < 4) return [];
    let out = [];
    try {
        out = execSync(
            `git ls-files "*.ts" "*.tsx" | grep -iE "${core}" || true`,
            { encoding: 'utf8' }
        ).split('\n').filter(Boolean);
    } catch { /* no matches */ }
    return out
        .filter(f => f !== path && !f.includes('__tests__') && !deadPaths.has(f))
        .slice(0, 3);
}

const rows = dead.map(d => {
    const src = readFileSync(d.path, 'utf8');
    return {
        ...d,
        kind: d.path.endsWith('.tsx') ? 'ui' : 'engine',
        hasTest: existsSync(d.path.replace(/([^/]+)\.(ts|tsx)$/, '__tests__/$1.test.$2')),
        purpose: purpose(src),
        rivals: rivals(d.path),
    };
});

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 1));
} else {
    console.log(`\n${rows.length} unreachable modules, ${rows.reduce((n, r) => n + r.loc, 0)} LOC\n`);
    for (const r of rows) {
        const flag = r.rivals.length ? 'RIVAL' : '     ';
        console.log(`${String(r.loc).padStart(5)}  ${flag}  ${r.path}`);
        if (r.purpose) console.log(`                ${r.purpose}`);
        if (r.rivals.length) console.log(`                vs live: ${r.rivals.join(', ')}`);
    }
}
