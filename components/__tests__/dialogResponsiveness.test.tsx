/**
 * Every modal must be able to fit a phone.
 *
 * This is a source audit, not a render test — jsdom computes no layout, so it
 * cannot tell whether a 900px panel overflows an 844px screen. What it *can*
 * do is check that each dialog is built in a shape the responsive safety net
 * in `app/globals.css` actually reaches.
 *
 * That net keys off structure:
 *
 *     <div class="fixed inset-0 flex items-center ...">   ← backdrop
 *       <div class="w-[900px] ...">                       ← panel, constrained
 *
 * A dialog written any other way — a floating panel positioned with `left-[400px]`,
 * say — falls straight through it and lands off the side of the screen, which is
 * exactly how several of them behaved. So the rule is: if you set a width wider
 * than a phone, you must either sit inside a flex backdrop or cap your own width.
 *
 * The failure this guards against is silent. Nothing errors; the dialog simply
 * opens somewhere the user cannot reach.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const COMPONENTS = join(process.cwd(), 'components');
const GLOBALS = join(process.cwd(), 'app', 'globals.css');

/** Narrowest phone worth supporting. */
const NARROW_PHONE = 390;

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            return entry === '__tests__' ? [] : walk(full);
        }
        return full.endsWith('.tsx') ? [full] : [];
    });
}

const files = walk(COMPONENTS).map(path => ({
    path,
    name: path.replace(COMPONENTS, '').replace(/\\/g, '/').slice(1),
    source: readFileSync(path, 'utf8'),
}));

/**
 * Fixed pixel widths this file declares, e.g. `w-[900px]`.
 *
 * `max-w-[720px]` is excluded — it is already a cap, and a naive `\bw-\[`
 * matches its tail because a word boundary sits between the hyphen and the `w`.
 */
function fixedWidths(source: string): number[] {
    return [...source.matchAll(/(?<!max-)\bw-\[(\d+)px\]/g)].map(m => Number(m[1]));
}

/**
 * Is this component rendered by anything?
 *
 * A component nothing imports cannot break a phone. Three plugin editors —
 * ChromaVerb, TapeDelay, Compressor — carry 600-940px widths and sit in the
 * repository's unreachable-code baseline, so failing the audit on them would be
 * noise that trains people to ignore it.
 */
function isRendered(name: string, all: { source: string; name: string }[]): boolean {
    const base = name.replace(/^.*\//, '').replace(/\.tsx$/, '');
    return all.some(f =>
        f.name !== name && new RegExp(`from ['"][^'"]*${base}['"]`).test(f.source));
}

/** Sits inside a full-screen flex backdrop, so the safety net constrains it. */
function insideFlexBackdrop(source: string): boolean {
    return /fixed inset-0[^"]*\bflex\b/.test(source);
}

/**
 * Caps its own width against the viewport, one way or another.
 *
 * Either an explicit max-width, or being pinned to both edges — `left-2 right-2`
 * constrains a panel just as effectively as a max-width does.
 */
function capsOwnWidth(source: string): boolean {
    const explicitCap = /max-w-\[calc\(100vw|max-w-\[100vw\]|max-w-full|max-w-screen|max-w-\[\d+px\]/.test(source);
    const pinnedBothEdges = /\bleft-\d/.test(source) && /\bright-\d/.test(source);
    return explicitCap || pinnedBothEdges;
}

describe('the responsive safety net exists', () => {
    const css = readFileSync(GLOBALS, 'utf8');

    it('constrains panels inside a full-screen flex backdrop', () => {
        expect(css).toMatch(/\[class~="fixed"\]\[class~="inset-0"\]\[class~="flex"\]>\*/);
    });

    it('top-aligns those backdrops rather than centring them', () => {
        // Centring a panel taller than the viewport pushes half of it above the
        // scroll origin, where nothing can reach it. This is the same bug that
        // made the login form's submit button unreachable.
        expect(css).toMatch(/align-items:\s*flex-start\s*!important/);
    });

    it('caps free-floating fixed panels to the viewport', () => {
        expect(css).toMatch(/\[class~="fixed"\]:not\(\[class~="inset-0"\]\)/);
    });

    it('uses attribute selectors rather than Tailwind utility class names', () => {
        // `.fixed.inset-0.items-center` was rewritten during the build to
        // `.fixed.inset-0.logic-button`, because `.logic-button` @applies
        // `items-center` — so the rule ended up targeting every Logic button
        // instead of any dialog. Attribute selectors cannot be reinterpreted.
        //
        // Comments are stripped first: the explanation above that very bug
        // lives in globals.css and names the selector it warns against.
        const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

        expect(withoutComments).not.toMatch(/\.fixed\.inset-0\.items-center\s*[,{]/);
    });

    it('scopes the net to small screens only', () => {
        expect(css).toMatch(/@media \(max-width: 900px\)/);
    });
});

describe('every wide component is reachable on a phone', () => {
    const wide = files
        .map(f => ({ ...f, widths: fixedWidths(f.source).filter(w => w > NARROW_PHONE) }))
        .filter(f => f.widths.length > 0)
        // ChromaVerb, TapeDelay and Compressor are in the unreachable baseline —
        // no route or component renders them, so their widths reach no user.
        .filter(f => isRendered(f.name, files));

    it('finds the wide components to check', () => {
        // If this drops to zero the audit has stopped auditing anything.
        expect(wide.length).toBeGreaterThan(5);
    });

    it.each(wide.map(f => [f.name, f] as const))(
        '%s is inside a flex backdrop or caps its own width',
        (name, file) => {
            const diagnosis = {
                file: name,
                widthsOverPhone: file.widths,
                insideFlexBackdrop: insideFlexBackdrop(file.source),
                capsOwnWidth: capsOwnWidth(file.source),
            };

            // Reported as an object so a failure says which check missed rather
            // than just "expected true".
            expect(diagnosis).toMatchObject(
                expect.objectContaining({
                    ...(insideFlexBackdrop(file.source)
                        ? { insideFlexBackdrop: true }
                        : { capsOwnWidth: true }),
                }),
            );
        },
    );
});

describe('no dialog is positioned off the side of a phone', () => {
    /**
     * A hard horizontal offset on a `fixed` element, e.g. `left-[400px]`.
     *
     * Anything past ~390px puts the panel entirely beyond a phone's screen, and
     * the width safety net cannot help — the element is off-viewport before its
     * width is even considered. It needs a responsive variant instead.
     */
    const offenders = files.flatMap(file =>
        [...file.source.matchAll(/\b(?<!:)(left|right)-\[(\d+)px\]/g)]
            .filter(m => Number(m[2]) > NARROW_PHONE)
            .map(m => ({ name: file.name, match: m[0] })),
    );

    it('has none', () => {
        expect(offenders).toEqual([]);
    });
});
