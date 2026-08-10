#!/usr/bin/env node
/**
 * Remove the per-component scrollbar `<style jsx>` blocks now that
 * `app/globals.css` defines `.custom-scrollbar{,-v,-h}` and `.no-scrollbar`
 * once.
 *
 * A block is only rewritten if every rule in it is a scrollbar rule. Blocks
 * that also carry something else — `.animate-spin-slow`, `.bg-brushed-metal`,
 * a bare `textarea` rule — keep those and lose only the scrollbar lines.
 *
 *   node scripts/dedupe-scrollbar-styles.mjs --dry
 */
import { readFile, writeFile } from 'fs/promises';
import { studioFiles, rel } from './studio-files.mjs';

const SCROLLBAR_RULE = /^\s*\.(?:custom-scrollbar(?:-[vh])?|no-scrollbar)(?:::-webkit-scrollbar[a-z-]*)?(?::[a-z-]+)?\s*\{[^}]*\}\s*$/;

const dry = process.argv.includes('--dry');
let blocksRemoved = 0;
let blocksTrimmed = 0;
let filesTouched = 0;

for (const file of studioFiles()) {
    const before = await readFile(file, 'utf8');
    let after = before;

    after = after.replace(/([ \t]*)<style jsx>\{`([\s\S]*?)`\}<\/style>\n?/g, (whole, indent, body) => {
        const lines = body.split('\n');
        const kept = lines.filter(line => line.trim() && !SCROLLBAR_RULE.test(line));
        const removed = lines.filter(line => line.trim() && SCROLLBAR_RULE.test(line)).length;
        if (!removed) return whole;

        if (!kept.length) {
            blocksRemoved++;
            return '';
        }
        blocksTrimmed++;
        return `${indent}<style jsx>{\`\n${kept.join('\n')}\n${indent}\`}</style>\n`;
    });

    if (after !== before) {
        filesTouched++;
        console.log(`  ${rel(file)}`);
        if (!dry) await writeFile(file, after, 'utf8');
    }
}

console.log(
    `\n  ${blocksRemoved} blocks removed, ${blocksTrimmed} trimmed, ` +
    `${filesTouched} files${dry ? ' (dry run)' : ''}\n`
);
