/**
 * The studio's file set: every .tsx reachable from the project page.
 *
 * Shared by `restyle-studio.mjs` and the audit scripts so the codemod and the
 * checks that verify it can never disagree about what "the studio" means.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(ROOT, 'app', 'project', '[projectId]', 'page.tsx');

/** Shared with the rest of the app — restyling it would leak out of the studio. */
export const NEVER_TOUCH = new Set(['components/Toast.tsx']);

export const rel = (f) => relative(ROOT, f).split('\\').join('/');

function resolveImport(spec, fromFile) {
    let base;
    if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
    else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
    else return null; // node_modules

    for (const candidate of [
        base, `${base}.tsx`, `${base}.ts`,
        join(base, 'index.tsx'), join(base, 'index.ts'),
    ]) {
        if ((candidate.endsWith('.tsx') || candidate.endsWith('.ts')) && existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

/** @param {{ ext?: string }} [opts] */
export function studioFiles({ ext = '.tsx' } = {}) {
    const seen = new Set();
    const queue = [ENTRY];

    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);

        let source;
        try { source = readFileSync(file, 'utf8'); } catch { continue; }

        for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
            const resolved = resolveImport(match[1], file);
            if (resolved && !seen.has(resolved)) queue.push(resolved);
        }
    }

    return [...seen]
        .filter(f => f.endsWith(ext))
        .filter(f => !NEVER_TOUCH.has(rel(f)))
        .sort();
}
