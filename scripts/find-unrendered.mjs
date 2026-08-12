#!/usr/bin/env node
/**
 * Report components that are imported but never rendered.
 *
 * `find-unreachable.py` catches modules nothing imports. It cannot catch the
 * next failure along: a component that *is* imported, so it looks wired, but
 * whose JSX tag appears nowhere — or appears only behind a flag that is never
 * set. `ProjectSettingsDialog` was imported by `TracksAreaMenuBar`, which also
 * declared `showProjectSettings` state and then never rendered the dialog or
 * set the flag. It typechecks, it has no unused-import warning in this config,
 * and the feature is simply unreachable by any user.
 *
 *   node scripts/find-unrendered.mjs
 */
import { readFileSync } from 'fs';
import { studioFiles, ROOT, rel } from './studio-files.mjs';
import { readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

/** Every .tsx in the repo, not just the studio's. */
function allTsx(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) allTsx(full, out);
        else if (full.endsWith('.tsx') && !full.includes('__tests__')) out.push(full);
    }
    return out;
}

const files = allTsx(ROOT).filter(f => !rel(f).startsWith('scripts/'));
const sources = new Map(files.map(f => [f, readFileSync(f, 'utf8')]));

/** Component names each file imports from a local module. */
const importedBy = new Map(); // name -> [importer files]
for (const [file, src] of sources) {
    for (const m of src.matchAll(/import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"](\.|@\/)[^'"]+['"]/g)) {
        const names = (m[1] ?? m[2] ?? '')
            .split(',')
            .map(s => s.trim().split(/\s+as\s+/).pop().trim())
            .filter(n => /^[A-Z]/.test(n));
        for (const n of names) {
            if (!importedBy.has(n)) importedBy.set(n, []);
            importedBy.get(n).push(file);
        }
    }
}

const problems = [];
for (const [name, importers] of importedBy) {
    // Rendered anywhere in the repo?
    const rendered = [...sources.values()].some(src =>
        new RegExp(`<${name}[\\s/>]`).test(src)
    );
    if (rendered) continue;
    // Referenced as a value (a factory, a map entry) rather than a tag?
    const usedAsValue = importers.some(f => {
        const src = sources.get(f);
        const withoutImports = src.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?$/gm, '');
        return new RegExp(`\\b${name}\\b`).test(withoutImports);
    });
    problems.push({ name, importers: importers.map(rel), usedAsValue });
}

const never = problems.filter(p => !p.usedAsValue);
console.log(`\n  ${never.length} components imported but never rendered or referenced:\n`);
for (const p of never.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`    ${p.name.padEnd(28)} imported by ${p.importers.join(', ')}`);
}
console.log();
