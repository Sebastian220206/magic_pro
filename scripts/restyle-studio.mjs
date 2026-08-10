#!/usr/bin/env node
/**
 * restyle-studio.mjs
 * Retheme the studio's chrome from the old grey scale onto the studio palette.
 *
 * ## Why a script
 *
 * The grey scheme was ~380 hard-coded hex tokens spread over 26 files —
 * `bg-[#1a1a1a]` alone appears 159 times. Doing that by hand invites both
 * misses and overreach, and leaves no record of the mapping. This applies one
 * table, prints what it changed, and can be re-run.
 *
 * ## Why an allowlist derived from imports
 *
 * The brief was the project page and nothing else. Rather than trust a
 * hand-written list, the file set is computed by walking the import graph from
 * `app/project/[projectId]/page.tsx`. That automatically excludes:
 *
 *   - every other route (/welcome, /dashboard, /login, /p/[shareId], /account)
 *   - the ~40 dead components that look like studio files but are imported by
 *     nothing — restyling `components/mixer/Mixer.tsx` does nothing, because
 *     `components/Mixer.tsx` is what actually renders
 *
 * `components/Toast.tsx` is excluded explicitly: it is the one component the
 * studio shares with the rest of the app, via app/providers.tsx.
 *
 * Usage:
 *   node scripts/restyle-studio.mjs --dry
 *   node scripts/restyle-studio.mjs
 */

import { readFile, writeFile } from 'fs/promises';
import { studioFiles } from './studio-files.mjs';

/**
 * Old grey scale to studio palette.
 *
 * Order matters: longer tokens first, so `bg-[#1a1a1a]` is never partially
 * matched by a shorter pattern.
 */
const REPLACEMENTS = [
    // ── Backgrounds ────────────────────────────────────────────────────────
    ['bg-[#050505]', 'bg-studio-void'],
    ['bg-[#0a0a0a]', 'bg-studio-sunken'],
    ['bg-[#161616]', 'bg-studio-panel'],
    ['bg-[#1a1a1a]', 'bg-studio-panel'],
    ['bg-[#1c1c1e]', 'bg-studio-panel'],
    ['bg-[#1e1e1e]', 'bg-studio-panel'],
    ['bg-[#252525]', 'bg-studio-raised'],
    ['bg-[#2a2a2a]', 'bg-studio-control'],
    ['bg-[#2c2c2c]', 'bg-studio-control'],
    ['bg-[#2c2c2e]', 'bg-studio-control'],
    ['bg-[#2d2d2d]', 'bg-studio-control'],
    ['bg-[#3a3a3a]', 'bg-studio-control'],
    ['bg-[#3a3a3c]', 'bg-studio-control'],
    ['bg-[#222]', 'bg-studio-raised'],
    ['bg-[#333]', 'bg-studio-control'],
    ['bg-[#111]', 'bg-studio-sunken'],
    ['bg-[#000]', 'bg-studio-void'],

    // ── Borders ────────────────────────────────────────────────────────────
    // Every divider becomes a faint cyan rather than a grey. A neutral grey
    // line next to a cyan accent reads as dirt.
    ['border-[#1a1a1a]', 'border-studio-line'],
    ['border-[#2a2a2a]', 'border-studio-line'],
    ['border-[#3a3a3c]', 'border-studio-line-strong'],
    ['border-[#4a4a4a]', 'border-studio-line-strong'],
    ['border-[#222]', 'border-studio-line'],
    ['border-[#333]', 'border-studio-line'],
    ['border-[#444]', 'border-studio-line-strong'],
    ['border-[#555]', 'border-studio-line-strong'],
    ['border-[#111]', 'border-studio-line'],
    ['border-[#000]', 'border-studio-line'],

    // ── Gradient stops ─────────────────────────────────────────────────────
    ['from-[#1a1a1a]', 'from-studio-panel'],
    ['from-[#2c2c2c]', 'from-studio-control'],
    ['from-[#3a3a3a]', 'from-studio-control'],
    ['from-[#252525]', 'from-studio-raised'],
    ['from-[#111]', 'from-studio-sunken'],
    ['from-[#000]', 'from-studio-void'],
    ['to-[#1a1a1a]', 'to-studio-panel'],
    ['to-[#252525]', 'to-studio-raised'],
    ['to-[#2c2c2c]', 'to-studio-control'],
    ['to-[#111]', 'to-studio-sunken'],
    ['to-[#000]', 'to-studio-void'],
    ['via-[#1a1a1a]', 'via-studio-panel'],

    // ── Accent unification ─────────────────────────────────────────────────
    // The studio had three accents at once: sky (~500 uses), Apple blue
    // (39) and cyan (99). Everything becomes cyan.
    //
    // Semantic colours are deliberately absent from this table. Red means
    // record and error, amber means solo and warning, green means signal —
    // recolouring those to cyan would delete the meaning.
    ['bg-[#007aff]', 'bg-accent-cyan'],
    ['text-[#007aff]', 'text-accent-cyan'],
    ['border-[#007aff]', 'border-accent-cyan'],
    ['bg-sky-500', 'bg-accent-cyan'],
    ['bg-sky-400', 'bg-accent-cyan'],
    ['text-sky-400', 'text-accent-cyan'],
    ['text-sky-500', 'text-accent-cyan'],
    ['border-sky-400', 'border-accent-cyan'],
    ['border-sky-500', 'border-accent-cyan'],
    ['ring-sky-500', 'ring-accent-cyan'],
    ['ring-sky-400', 'ring-accent-cyan'],
    ['bg-blue-600', 'bg-accent-cyan'],
    ['bg-blue-500', 'bg-accent-cyan'],

    // ── The long tail ──────────────────────────────────────────────────────
    // The table above covered the six tokens that dominate the count. What
    // follows is everything else an audit turned up, so that no grey survives
    // next to a restyled neighbour — a single leftover `#444` button in a
    // panel of cyan-lined controls is more obvious than the whole old scheme.

    // Dark surfaces, arbitrary hex.
    ['bg-[#090909]', 'bg-studio-void'],
    ['bg-[#0c0c0c]', 'bg-studio-void'],
    ['bg-[#0f0f0f]', 'bg-studio-void'],
    ['bg-[#0f1215]', 'bg-studio-sunken'],
    ['bg-[#101010]', 'bg-studio-sunken'],
    ['bg-[#111621]', 'bg-studio-sunken'],
    ['bg-[#141414]', 'bg-studio-sunken'],
    ['bg-[#121821]', 'bg-studio-panel'],
    ['bg-[#18181b]', 'bg-studio-panel'],
    ['bg-[#1a1f2b]', 'bg-studio-panel'],
    ['bg-[#1c1c1f]', 'bg-studio-panel'],
    ['bg-[#1e1e22]', 'bg-studio-panel'],
    ['bg-[#1a2a3a]', 'bg-studio-raised'],
    ['bg-[#202020]', 'bg-studio-raised'],
    ['bg-[#212125]', 'bg-studio-raised'],
    ['bg-[#252527]', 'bg-studio-raised'],
    ['bg-[#252529]', 'bg-studio-raised'],
    ['bg-[#292929]', 'bg-studio-raised'],
    ['bg-[#29323c]', 'bg-studio-control'],
    ['bg-[#2a2a2e]', 'bg-studio-control'],
    ['bg-[#323232]', 'bg-studio-control'],
    ['bg-[#444]', 'bg-studio-control'],
    ['bg-[#4a4a4a]', 'bg-studio-control'],
    ['bg-[#555]', 'bg-studio-control'],
    ['bg-[#666]', 'bg-studio-control'],
    ['bg-[#888]', 'bg-studio-control'],
    ['bg-[#ccc]', 'bg-white/20'],

    // Light Apple sheet surfaces — Stage 7. These five dialogs were white
    // panels; opened from a neon studio a white sheet reads as a bug.
    ['bg-[#fafafa]', 'bg-studio-panel'],
    ['bg-[#f9f9fb]', 'bg-studio-panel'],
    ['bg-[#f2f2f7]', 'bg-studio-panel'],
    ['bg-[#F2F2F7]', 'bg-studio-panel'],
    ['bg-[#f0f0f0]', 'bg-studio-panel'],
    ['bg-[#e5e5ea]', 'bg-studio-raised'],
    ['bg-[#e3e3e3]', 'bg-studio-raised'],
    ['bg-[#e2e2e2]', 'bg-studio-raised'],
    ['bg-[#d1d1d6]', 'bg-studio-control'],
    ['bg-[#D1D1D6]', 'bg-studio-control'],
    ['border-[#d1d1d6]', 'border-studio-line'],
    ['border-[#D1D1D6]', 'border-studio-line'],
    ['border-[#a5a5a5]', 'border-studio-line-strong'],
    ['border-[#a3a3a3]', 'border-studio-line-strong'],
    ['border-[#777]', 'border-studio-line-strong'],
    ['text-[#1c1c1e]', 'text-studio-text'],
    ['text-[#1C1C1E]', 'text-studio-text'],
    ['text-[#8E8E93]', 'text-studio-text-dim'],
    ['text-[#b0b0b0]', 'text-studio-text-mid'],
    ['text-[#888]', 'text-studio-text-dim'],
    ['text-[#eee]', 'text-studio-text'],

    // Remaining gradient stops.
    ['from-[#3a3a3e]', 'from-studio-control'],
    ['from-[#e7e7e7]', 'from-studio-raised'],
    ['from-[#444]', 'from-studio-control'],
    ['from-[#333]', 'from-studio-control'],
    ['to-[#d1d1d1]', 'to-studio-control'],
    ['to-[#3a3a3a]', 'to-studio-control'],
    ['to-[#2a2a2e]', 'to-studio-control'],
    ['to-[#2a2a2a]', 'to-studio-control'],
    ['to-[#333]', 'to-studio-control'],
    ['to-[#222]', 'to-studio-raised'],
    ['via-[#2a2a2a]', 'via-studio-control'],
    ['via-[#222]', 'via-studio-raised'],

    // Named greys. Light-scale backgrounds become translucent white so that
    // hover and selected states still read on a dark panel instead of
    // inverting into a bright block.
    ['bg-gray-50', 'bg-white/[0.03]'],
    ['bg-gray-100', 'bg-white/5'],
    ['bg-gray-200', 'bg-white/10'],
    ['bg-gray-300', 'bg-white/[0.14]'],
    ['bg-gray-400', 'bg-studio-control'],
    ['bg-gray-500', 'bg-studio-control'],
    ['bg-gray-600', 'bg-studio-control'],
    ['bg-gray-700', 'bg-studio-raised'],
    ['bg-gray-800', 'bg-studio-panel'],
    ['bg-gray-900', 'bg-studio-sunken'],
    ['bg-zinc-900', 'bg-studio-sunken'],
    ['border-gray-200', 'border-studio-line'],
    ['border-gray-300', 'border-studio-line'],
    ['border-gray-400', 'border-studio-line'],
    ['border-gray-500', 'border-studio-line-strong'],
    ['border-gray-600', 'border-studio-line-strong'],
    ['border-gray-700', 'border-studio-line'],
    ['border-gray-800', 'border-studio-line'],
    ['border-gray-900', 'border-studio-line'],
    ['border-zinc-700', 'border-studio-line'],

    // Text tiers. gray-500 and gray-600 on the new near-black ground were
    // below AA; the dim token is lighter than both, so this raises contrast
    // as well as unifying the tint.
    ['text-gray-100', 'text-studio-text'],
    ['text-gray-200', 'text-studio-text'],
    ['text-gray-300', 'text-studio-text'],
    ['text-gray-400', 'text-studio-text-mid'],
    ['text-gray-500', 'text-studio-text-dim'],
    ['text-gray-600', 'text-studio-text-dim'],
    ['text-gray-700', 'text-studio-text-dim'],
    ['text-gray-800', 'text-studio-text'],
    ['text-gray-900', 'text-studio-text'],
    ['text-slate-200', 'text-studio-text'],
    ['text-zinc-400', 'text-studio-text-mid'],
    ['text-zinc-500', 'text-studio-text-dim'],
    ['placeholder-gray-700', 'placeholder-studio-text-dim'],
    ['placeholder-gray-800', 'placeholder-studio-text-dim'],

    // The rest of the blues.
    ['bg-[#007AFF]', 'bg-accent-cyan'],
    ['text-[#007AFF]', 'text-accent-cyan'],
    ['border-[#007AFF]', 'border-accent-cyan'],
    ['ring-[#007aff]', 'ring-accent-cyan'],
    ['ring-[#007AFF]', 'ring-accent-cyan'],
    ['bg-[#0a84ff]', 'bg-accent-cyan'],
    ['bg-[#0071E3]', 'bg-accent-cyan'],
    ['bg-[#2563eb]', 'bg-accent-cyan'],
    ['bg-[#3b82f6]', 'bg-accent-cyan'],
    ['text-[#87CEEB]', 'text-accent-cyan'],
    // Apple darkened its blue on press. On a neon theme the pressed state
    // brightens instead — a darker cyan just looks disabled.
    ['bg-[#0062cc]', 'bg-cyan-300'],
    ['bg-[#0058d8]', 'bg-cyan-300'],
    ['bg-[#0051A3]', 'bg-cyan-300'],
    ['border-[#005bb7]', 'border-cyan-300'],
    ['bg-blue-400', 'bg-accent-cyan'],
    ['bg-blue-700', 'bg-accent-cyan'],
    ['border-blue-400', 'border-accent-cyan'],
    ['border-blue-500', 'border-accent-cyan'],
    ['text-blue-400', 'text-accent-cyan'],
    ['fill-blue-400', 'fill-accent-cyan'],
    ['bg-sky-50', 'bg-accent-cyan/10'],
    ['bg-sky-100', 'bg-accent-cyan/15'],
    ['bg-sky-200', 'bg-accent-cyan/30'],
    ['bg-sky-600', 'bg-accent-cyan'],
    ['bg-sky-900', 'bg-accent-cyan/20'],
    ['text-sky-200', 'text-accent-cyan'],
    ['text-sky-300', 'text-accent-cyan'],
    ['text-sky-600', 'text-accent-cyan'],
    ['text-sky-800', 'text-accent-cyan'],
    ['border-sky-300', 'border-accent-cyan'],
    ['border-sky-600', 'border-accent-cyan'],
    ['from-sky-500', 'from-accent-cyan'],
    ['from-sky-600', 'from-accent-cyan'],
    ['from-sky-950', 'from-accent-cyan/20'],
    ['to-sky-400', 'to-accent-cyan'],
    ['to-sky-600', 'to-accent-cyan'],
    ['via-sky-400', 'via-accent-cyan'],
    ['via-sky-900', 'via-accent-cyan/30'],
    ['shadow-sky-500', 'shadow-accent-cyan'],
    ['fill-sky-300', 'fill-accent-cyan'],
    ['fill-sky-400', 'fill-accent-cyan'],
    // `accent-color` on form controls. cyan-400 is #22d3ee, the same value as
    // --accent-cyan, and avoids the unreadable `accent-accent-cyan`.
    ['accent-sky-400', 'accent-cyan-400'],
    ['accent-sky-500', 'accent-cyan-400'],

    // ── Stage 7: the light Apple sheets ────────────────────────────────────
    // `NewTrackDialog`, `SaveDialog`, `ImportProjectDialog`, `ProjectInfoDialog`
    // and `ProjectSettingsDialog` were white sheets. The hex surfaces above
    // handled their panels; these are the inputs, sub-panels and hairlines
    // that used plain `bg-white` and `border-black/N` instead.
    //
    // `bg-white` is not remapped wholesale: it is also a checkbox tick, a
    // ruler hairline and a peak-hold line. Only the phrases where it is a
    // *surface* — sitting next to a border, a radius or padding — are matched.
    ['bg-white/90 border-black/20 text-black', 'bg-[#cfe1ea] border-black/40 text-[#04070b]'],
    ['bg-white border-black text-black', 'bg-accent-cyan border-accent-cyan text-[#04070b]'],
    ['bg-white shadow-sm ring-1 ring-black/5', 'bg-studio-control shadow-sm ring-1 ring-white/10'],
    ['bg-white/50 backdrop-blur-md', 'bg-white/[0.04] backdrop-blur-md'],
    ['bg-white hover:bg-accent-cyan/10', 'bg-[#cfe1ea] hover:bg-accent-cyan/10'],
    ['bg-white/50 p-8', 'bg-studio-sunken/60 p-8'],
    ['bg-white text-studio-text-dim', 'bg-studio-control text-studio-text-dim'],
    ['bg-white cursor-pointer', 'bg-studio-control cursor-pointer'],
    ['bg-white transition-colors', 'bg-studio-control transition-colors'],
    ['bg-white text-black', 'bg-studio-control text-studio-text'],
    ['bg-white shadow-sm', 'bg-studio-control shadow-sm'],
    ['bg-white border', 'bg-studio-control border'],
    ['bg-white rounded', 'bg-studio-control rounded'],
    ['bg-white flex', 'bg-studio-control flex'],
    ['bg-white p-', 'bg-studio-control p-'],
    ['bg-white text-[', 'bg-studio-control text-['],
    ["hover:bg-white'", "hover:bg-studio-raised'"],
    // `bg-white` as the whole class string, typically the off state of a
    // ternary: `${checked ? 'bg-accent-cyan' : 'bg-white'}`.
    [/'bg-white'/g, "'bg-studio-control'"],
    [/\bbg-white"/g, 'bg-studio-control"'],
    ['gap-2 bg-white"', 'gap-2 bg-studio-panel"'],
    ['bg-white/50"', 'bg-white/[0.04]"'],
    ['bg-white/40"', 'bg-white/[0.04]"'],
    ['py-1 text-black font-sans', 'py-1 text-studio-text font-sans'],
    ['bg-black/10 text-black group-hover:bg-black/20', 'bg-white/10 text-studio-text group-hover:bg-white/20'],
    ['p-1 text-black rounded', 'p-1 bg-studio-control text-studio-text border border-studio-line rounded'],
    ['hover:text-black', 'hover:text-white'],

    // Hairlines that were black-on-white. Anchored with a negative lookahead
    // so `border-black/5` cannot eat the leading half of `border-black/50` —
    // which is a real, and correct, dark ring elsewhere in the studio.
    [/\bborder-black\/5(?![0-9])/g, 'border-white/5'],
    [/\bborder-black\/\[0\.05\]/g, 'border-white/5'],
    [/\bring-black\/5(?![0-9])/g, 'ring-white/10'],
]
    // Longest source first, so no token can be eaten by a shorter prefix of
    // itself — `bg-gray-50` would otherwise consume half of `bg-gray-500`.
    // Regexes carry their own anchoring and are applied last.
    .sort((a, b) => {
        const len = (x) => (typeof x === 'string' ? x.length : -1);
        return len(b[0]) - len(a[0]);
    });

/**
 * Phrases the table must not touch.
 *
 * `bg-white` is both a surface and a mark. `bg-white rounded` correctly darkens
 * a white input, and just as correctly destroys the 6px tick inside a checkbox
 * — which is white *because* the box behind it is the accent colour, and stays
 * white however the panel is themed. Same for the 1px hairlines that draw fader
 * scales and notepad rules.
 *
 * These are swapped for a sentinel before the table runs and back afterwards,
 * so no ordering subtlety in the table can reach them.
 */
const PROTECTED = [
    'w-1.5 h-1.5 bg-white rounded-full',
    'w-1.5 h-1.5 bg-white rounded-[1px]',
    'w-2 h-2 bg-white rounded-full',
    'w-1 h-1 bg-white rounded-full',
    'w-full h-px bg-white',
    'h-px w-full bg-white',
    'h-[1px] bg-white',
    'w-px h-full bg-white',
];

const sentinel = (i) => `__RESTYLE_KEEP_${i}__`;
const shield = (src) => PROTECTED.reduce((s, p, i) => s.split(p).join(sentinel(i)), src);
const unshield = (src) => PROTECTED.reduce((s, p, i) => s.split(sentinel(i)).join(p), src);

async function main() {
    const dry = process.argv.includes('--dry');
    const files = studioFiles();

    console.log(`\n${files.length} .tsx files reachable from the studio page\n`);

    let changedFiles = 0;
    let totalTokens = 0;
    const perToken = new Map();

    for (const file of files) {
        const before = await readFile(file, 'utf8');
        let after = shield(before);

        for (const [from, to] of REPLACEMENTS) {
            let count;
            if (typeof from === 'string') {
                count = after.split(from).length - 1;
                if (!count) continue;
                after = after.split(from).join(to);
            } else {
                count = (after.match(from) ?? []).length;
                if (!count) continue;
                after = after.replace(from, to);
            }
            perToken.set(String(from), (perToken.get(String(from)) ?? 0) + count);
            totalTokens += count;
        }

        after = unshield(after);
        if (after !== before) {
            changedFiles++;
            if (!dry) await writeFile(file, after, 'utf8');
        }
    }

    const top = [...perToken.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    console.log('  most-replaced tokens:');
    for (const [token, n] of top) {
        console.log(`    ${String(n).padStart(4)}  ${token}`);
    }

    console.log(`\n  ${totalTokens} tokens across ${changedFiles} files${dry ? ' (dry run, nothing written)' : ''}\n`);
    return 0;
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
