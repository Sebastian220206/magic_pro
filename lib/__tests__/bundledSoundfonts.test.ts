/**
 * The soundfont library must work without a filesystem.
 *
 * This is the deployment-critical property. On a serverless host `public/` is
 * served by the CDN and the function never sees it, so a directory scan finds
 * nothing — and finds nothing *silently*, because a missing directory is
 * indistinguishable from an empty one. That is how a deployed build ends up
 * with an empty instrument picker while every other signal stays green.
 *
 * Id handling and path traversal are covered by `localSoundfonts.test.ts`.
 */

jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn(),
        stat: jest.fn(),
    },
}));

import { promises as fs } from 'fs';
import manifest from '@/data/soundfontManifest.json';
import {
    bundledPresets,
    bundledSoundfontCount,
    listBundledSoundfonts,
    listLocalSoundfonts,
    toLocalId,
} from '@/lib/localSoundfonts';

const readdir = fs.readdir as unknown as jest.Mock;
const stat = fs.stat as unknown as jest.Mock;

/** No `public/soundfonts` directory: a serverless function, or a fresh clone. */
function withoutFilesystem() {
    readdir.mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
}

/** A directory holding exactly these files. */
function withFiles(names: string[]) {
    readdir.mockResolvedValue(names);
    stat.mockResolvedValue({ isFile: () => true, size: 4 * 1024 * 1024 });
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('without a filesystem', () => {
    it('still lists every font the build shipped', async () => {
        withoutFilesystem();

        const fonts = await listLocalSoundfonts();

        expect(fonts).toHaveLength(manifest.fonts.length);
        expect(fonts.length).toBeGreaterThan(0);
    });

    it('still returns presets for a shipped font', async () => {
        withoutFilesystem();

        const [font] = await listLocalSoundfonts();

        // Without these the picker lists the font but cannot open it.
        const presets = bundledPresets(font.id);
        expect(presets).not.toBeNull();
        expect(presets!.length).toBeGreaterThan(0);
    });

    it('numbers presets from zero with no gaps', async () => {
        withoutFilesystem();

        const [font] = await listLocalSoundfonts();
        const presets = bundledPresets(font.id)!;

        // `presetIndex` is stored in saved projects as a position in this
        // array, so the indices must be exactly the positions.
        expect(presets.map(p => p.index)).toEqual(presets.map((_, i) => i));
    });

    it('serves fonts from a public URL, never a filesystem path', async () => {
        withoutFilesystem();

        for (const font of await listLocalSoundfonts()) {
            expect(font.fileUrl.startsWith('/soundfonts/')).toBe(true);
        }
    });

    it('returns null presets for a font that was not shipped', () => {
        expect(bundledPresets(toLocalId('Never Deployed.sf2'))).toBeNull();
    });
});

describe('merging the manifest with local files', () => {
    it('adds fonts a developer has but the build did not ship', async () => {
        withFiles(['Extra Piano.sf2']);

        const fonts = await listLocalSoundfonts();

        expect(fonts.map(f => f.name)).toContain('Extra Piano');
        expect(fonts).toHaveLength(manifest.fonts.length + 1);
    });

    it('does not list a shipped font twice when it is also on disk', async () => {
        // The normal development case: the manifest describes the bank, and the
        // bank is also sitting in public/soundfonts.
        withFiles(manifest.fonts.map(f => f.fileName));

        const fonts = await listLocalSoundfonts();

        expect(fonts).toHaveLength(manifest.fonts.length);
        expect(new Set(fonts.map(f => f.id)).size).toBe(fonts.length);
    });

    it('ignores files that are not soundfonts', async () => {
        withFiles(['cover.jpg', 'notes.txt', 'Extra.sf2']);

        expect(await listLocalSoundfonts()).toHaveLength(manifest.fonts.length + 1);
    });

    it('puts a General MIDI bank first', async () => {
        withFiles(['AAA Piano.sf2']);

        const fonts = await listLocalSoundfonts();

        // A GM bank covers every program in one file, so it belongs at the top
        // even though its name sorts later.
        expect(fonts[0].isGeneralMidi).toBe(true);
    });

    it('describes a font the same way from either source', async () => {
        // A project saved in development references a font by id. If the two
        // sources derived ids differently, production could not resolve it.
        const [shipped] = manifest.fonts;
        withFiles([shipped.fileName]);

        const fromDisk = (await listLocalSoundfonts())
            .find(f => f.storagePath === shipped.fileName)!;
        const fromManifest = listBundledSoundfonts()
            .find(f => f.storagePath === shipped.fileName)!;

        expect(fromDisk.id).toBe(fromManifest.id);
        expect(fromDisk.name).toBe(fromManifest.name);
        expect(fromDisk.category).toBe(fromManifest.category);
        expect(fromDisk.fileUrl).toBe(fromManifest.fileUrl);
    });
});

describe('bundledSoundfontCount', () => {
    it('matches what the manifest describes', () => {
        expect(bundledSoundfontCount()).toBe(manifest.fonts.length);
        expect(bundledSoundfontCount()).toBe(listBundledSoundfonts().length);
    });

    it('is above zero, or the deployment has no instruments', () => {
        // /api/health reports this. A build that shipped no bank is broken in a
        // way nothing else notices.
        expect(bundledSoundfontCount()).toBeGreaterThan(0);
    });
});
