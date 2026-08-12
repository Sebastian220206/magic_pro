#!/usr/bin/env node
/**
 * Find panels the store can show but nothing can open.
 *
 * A `showX` flag plus a `toggleX` action plus a rendered `{showX && <X/>}` looks
 * complete from every angle — the component exists, the state exists, the render
 * exists — and is still unreachable if no button calls `toggleX`. `ListEditors`
 * was rendered by the studio page with `showListEditors` permanently false.
 *
 * Known blind spot: a panel's own close button calls the same toggle, so a
 * panel that can only ever be *closed* still reads as triggered. Telling open
 * from close needs more than a static scan. What this reliably catches is the
 * case where nothing anywhere references the action — which is exactly how
 * ListEditors presented, and why it went unnoticed.
 *
 *   node scripts/find-untriggered-panels.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { ROOT, rel } from './studio-files.mjs';

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (['node_modules', '.next', '.git', 'scripts'].includes(name) || name.startsWith('.')) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(full) && !full.includes('__tests__')) out.push(full);
    }
    return out;
}

const files = walk(ROOT);
const appSrc = files
    .filter(f => !rel(f).startsWith('store/'))
    .map(f => ({ file: f, src: readFileSync(f, 'utf8') }));

const storeSrc = files
    .filter(f => rel(f).startsWith('store/'))
    .map(f => readFileSync(f, 'utf8'))
    .join('\n');

/*
 * Every `showX: boolean` on the main store state.
 *
 * Scoped to the interface that also declares `isDirty`, because nested settings
 * objects declare their own `showX` flags — `ControlBarSettings` has three —
 * which are set through `updateControlBar`, not through a `toggleX` action, and
 * were reported as unreachable panels.
 */
const stateBlock = (() => {
    // Brace-matched, not `indexOf('\n}')`: the state interface contains nested
    // object types, so the naive scan stopped at the first one, failed the
    // isDirty check and fell back to the whole file — which put the nested
    // settings flags straight back in.
    for (const m of storeSrc.matchAll(/interface\s+(\w+)\s*\{/g)) {
        let depth = 0;
        let i = m.index + m[0].length - 1;
        for (; i < storeSrc.length; i++) {
            if (storeSrc[i] === '{') depth++;
            else if (storeSrc[i] === '}' && --depth === 0) break;
        }
        const block = storeSrc.slice(m.index, i);
        if (/isDirty:\s*boolean/.test(block)) return block;
    }
    return storeSrc;
})();

const flags = [...stateBlock.matchAll(/^\s{2,4}(show[A-Z]\w*):\s*boolean;/gm)].map(m => m[1]);

const problems = [];
for (const flag of [...new Set(flags)]) {
    /*
     * The action is not always named after the flag. `showNoteRepeatDialog` is
     * driven by `toggleNoteRepeat`, and `showLiveLoopsGrid` by
     * `toggleLiveLoops`, so a strict flag-to-action mapping reports working
     * panels as unreachable. Try the suffix variants too.
     */
    const stem = flag.slice(4);
    const stems = [...new Set([
        stem,
        stem.replace(/(Dialog|Grid|Panel|Window|Editor|Keyboard)$/, ''),
    ])].filter(Boolean);
    const names = stems.flatMap(x => [
        'toggle' + x,
        'set' + flag.slice(0, 1).toUpperCase() + flag.slice(1),
        'setShow' + x,
    ]);
    const toggle = names[0];
    const setter = names.join('|');
    /*
     * A toggle counts as triggered whether it is called — `toggleX()` — or
     * passed by reference — `onClick={toggleX}`. The mixer uses the latter,
     * which an earlier version of this check read as unreachable.
     *
     * Destructuring and selector lines are stripped first, or every panel
     * looks triggered by its own `showX, toggleX,` import line.
     */
    // A destructure or selector line mentions the action without triggering it.
    // The character class must allow commas — `showX, toggleX,` is one line.
    const isPlumbing = new RegExp(
        `^\\s*(?:${setter})\\s*[,:]|^\\s*[\\w:.,\\s]*\\b(?:${setter})\\s*,?\\s*$`
    );
    const callers = appSrc.filter(({ src }) => {
        const body = src.split('\n').filter(l => !isPlumbing.test(l)).join('\n');
        return new RegExp(`\\b(?:${setter})\\b`).test(body);
    });
    if (callers.length) continue;

    // Only interesting if something actually renders behind the flag.
    const renderers = appSrc.filter(({ src }) => new RegExp(`\\b${flag}\\b`).test(src));
    if (!renderers.length) continue;

    problems.push({ flag, toggle, renderers: renderers.map(r => rel(r.file)) });
}

console.log(`\n  ${problems.length} panels rendered behind a flag nothing can set\n`);
for (const p of problems) {
    console.log(`    ${p.flag.padEnd(28)} no caller of ${p.toggle}()`);
    console.log(`      rendered in: ${p.renderers.join(', ')}`);
}
console.log();
