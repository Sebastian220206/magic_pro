#!/usr/bin/env python3
"""
find-unreachable.py — report modules that nothing imports.

Why this exists
---------------
Roughly 23% of this codebase is unreachable from any entry point: finished
features that were written, compiled, marked done, and never wired into the
application. `tsc` cannot catch this (dead code typechecks perfectly) and
neither can the test suite (nothing imports it, so nothing tests it).

Run this before claiming a feature is complete. If your new module appears in
the output, it is not wired in.

Usage
-----
    python3 scripts/find-unreachable.py             # full report
    python3 scripts/find-unreachable.py --count     # just the totals
    python3 scripts/find-unreachable.py --check     # exit 1 if above baseline

BASELINE is the count recorded during the 2026-08-04 ownership pass. Lower it as
dead code is removed; never raise it to make a build pass.
"""

import argparse
import os
import re
import sys

BASELINE_FILES = 136

ROOTS = ['app', 'components', 'engine', 'store', 'lib', 'models', 'hooks',
         'templates', 'data', 'types']

SKIP_DIRS = {'node_modules', '.next', '.git', '__tests__'}

# Next.js App Router conventions: the framework imports these, not our code.
ENTRYPOINT_FILES = {
    'page.tsx', 'layout.tsx', 'route.ts', 'providers.tsx', 'error.tsx',
    'loading.tsx', 'not-found.tsx', 'template.tsx', 'default.tsx',
}

IMPORT_RE = re.compile(
    r'''(?:from\s+|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]'''
)

SEP = chr(92)  # backslash, kept out of string literals for portability


def repo_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def collect_sources() -> dict:
    sources = {}
    for root in ROOTS:
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for filename in filenames:
                if not filename.endswith(('.ts', '.tsx')):
                    continue
                if filename.endswith('.d.ts'):
                    continue
                path = os.path.join(dirpath, filename).replace(SEP, '/')
                try:
                    with open(path, encoding='utf-8', errors='ignore') as handle:
                        sources[path] = handle.read()
                except OSError:
                    continue
    return sources


def resolve_imports(sources: dict) -> set:
    """Every module path that is the target of an import somewhere."""
    referenced = set()
    for path, text in sources.items():
        directory = os.path.dirname(path)
        for match in IMPORT_RE.finditer(text):
            spec = match.group(1)
            if spec.startswith('@/'):
                target = spec[2:]
            elif spec.startswith('.'):
                target = os.path.normpath(
                    os.path.join(directory, spec)
                ).replace(SEP, '/')
            else:
                continue  # bare package import
            for suffix in ('.ts', '.tsx', '/index.ts', '/index.tsx'):
                referenced.add(target + suffix)
    return referenced


def find_unreachable(sources: dict, referenced: set) -> list:
    results = []
    for path, text in sources.items():
        basename = os.path.basename(path)
        if path.startswith('app/') and basename in ENTRYPOINT_FILES:
            continue
        if path in referenced:
            continue
        results.append((len(text.splitlines()), path))
    results.sort(reverse=True)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--count', action='store_true',
                        help='print totals only')
    parser.add_argument('--check', action='store_true',
                        help='exit 1 if the count exceeds the baseline')
    args = parser.parse_args()

    os.chdir(repo_root())

    sources = collect_sources()
    referenced = resolve_imports(sources)
    unreachable = find_unreachable(sources, referenced)

    total_files = len(unreachable)
    total_loc = sum(loc for loc, _ in unreachable)

    if not args.count:
        print('Unreachable modules (nothing imports these):')
        print()
        for loc, path in unreachable:
            print('%6d  %s' % (loc, path))
        print()

    print('%d files, %d LOC unreachable (baseline: %d files)'
          % (total_files, total_loc, BASELINE_FILES))

    if args.check:
        if total_files > BASELINE_FILES:
            print()
            print('FAIL: %d new unreachable module(s) since the baseline.'
                  % (total_files - BASELINE_FILES))
            print('A module nothing imports is not wired into the app.')
            return 1
        if total_files < BASELINE_FILES:
            print('Improved by %d file(s) — lower BASELINE_FILES to lock it in.'
                  % (BASELINE_FILES - total_files))

    return 0


if __name__ == '__main__':
    sys.exit(main())
