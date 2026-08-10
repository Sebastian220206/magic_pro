#!/usr/bin/env node
/**
 * Report colour tokens in the studio that are still off-palette.
 *
 * Run after `restyle-studio.mjs` to see what the mapping table missed. Prints
 * a token histogram and, with `--files <token>`, where a given token lives.
 *
 *   node scripts/audit-studio-palette.mjs
 *   node scripts/audit-studio-palette.mjs --files bg-gray-700
 */
import { readFileSync } from 'fs';
import { studioFiles, rel } from './studio-files.mjs';

const UTIL = '(?:bg|border|text|from|to|via|ring|divide|fill|stroke|shadow|outline|decoration|placeholder|caret|accent)';
const OFF_PALETTE = new RegExp(
    `${UTIL}-\\[#[0-9a-fA-F]{3,8}\\]` +
    `|${UTIL}-(?:sky|blue|indigo|gray|slate|zinc|neutral|stone)-[0-9]{2,3}`,
    'g'
);

const wanted = process.argv.includes('--files')
    ? process.argv[process.argv.indexOf('--files') + 1]
    : null;

const counts = new Map();
const places = new Map();

for (const file of studioFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const [token] of source.matchAll(OFF_PALETTE)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
        if (!places.has(token)) places.set(token, new Map());
        const byFile = places.get(token);
        byFile.set(rel(file), (byFile.get(rel(file)) ?? 0) + 1);
    }
}

if (wanted) {
    const byFile = places.get(wanted);
    if (!byFile) { console.log(`  ${wanted}: not found`); process.exit(0); }
    console.log(`\n  ${wanted}\n`);
    for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${String(n).padStart(4)}  ${file}`);
    }
    console.log();
    process.exit(0);
}

const sorted = [...counts].sort((a, b) => b[1] - a[1]);
const total = sorted.reduce((s, [, n]) => s + n, 0);
console.log(`\n  ${total} off-palette tokens, ${sorted.length} distinct\n`);
for (const [token, n] of sorted.slice(0, 40)) {
    console.log(`    ${String(n).padStart(4)}  ${token}`);
}
console.log();
