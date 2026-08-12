#!/usr/bin/env node
/**
 * Find live UI that renders hard-coded sample data.
 *
 * Worse than dead code: a panel wired to a literal array looks like a working
 * feature and reports the same invented values whatever the project contains.
 * `ListEditors` displayed the same five notes — C3, E3, G3, C4, F3 — for every
 * project in the app's history.
 *
 * Heuristic: a component-local array literal of three or more object entries
 * that is then mapped into JSX. Reports candidates for a human to judge; a
 * static list of, say, menu items is a legitimate hit and should be ignored.
 *
 *   node scripts/find-mock-data.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { studioFiles, rel } from './studio-files.mjs';

/** Names that are obviously configuration rather than data. */
const CONFIG_LIKE = /tab|menu|option|preset|category|column|icon|label|shortcut|key|palette|colou?r|mode|group|type|item|field|section|step|resolution|scale|chord|genre|kit|lane/i;

const rows = [];
for (const file of studioFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\[\s*\n((?:\s*\{[^\n]*\},?\s*\n){3,})\s*\]/g)) {
        const [, name, body] = m;
        if (CONFIG_LIKE.test(name)) continue;
        // Only care if it reaches the DOM.
        if (!new RegExp(`\\b${name}\\.map\\(`).test(src)) continue;
        rows.push({
            file: rel(file),
            name,
            entries: body.trim().split('\n').length,
            sample: body.trim().split('\n')[0].trim().slice(0, 72),
        });
    }
}

console.log(`\n  ${rows.length} candidate mock-data arrays rendered into the UI\n`);
for (const r of rows) {
    console.log(`    ${r.file}`);
    console.log(`      const ${r.name} — ${r.entries} entries, e.g. ${r.sample}`);
}
console.log();
