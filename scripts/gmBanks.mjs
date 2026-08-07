/**
 * gmBanks.mjs
 * The General MIDI banks a deployment may ship.
 *
 * Shared by `fetch-gm-soundfont.mjs`, which downloads them, and
 * `build-soundfont-manifest.mjs`, which records their preset lists. Keeping one
 * list means the manifest can never describe a font the build does not fetch —
 * which would put an instrument in the picker that 404s when selected.
 *
 * `public/soundfonts/` on a developer's machine usually holds far more than
 * this: large commercial-quality fonts that are gitignored and never deployed.
 * Those are still discovered at runtime by `listLocalSoundfonts`, so they work
 * locally, but they are deliberately excluded from the manifest.
 */

export const BANKS = {
    generaluser: {
        name: 'GeneralUser GS',
        fileName: 'GeneralUser-GS.sf2',
        approxMb: 30,
        license: 'Free to use and distribute; see the author\'s terms.',
        credit: 'S. Christian Collins — https://schristiancollins.com/generaluser.php',
        urls: [
            // The author's own repository.
            'https://github.com/mrbumpy409/GeneralUser-GS/raw/main/GeneralUser-GS.sf2',
        ],
    },
    fluid: {
        name: 'FluidR3 GM',
        fileName: 'FluidR3-GM.sf2',
        approxMb: 148,
        license: 'MIT',
        credit: 'Frank Wen — FluidR3',
        urls: [
            'https://github.com/Jacalz/fluid-soundfont/raw/master/original-files/FluidR3_GM.sf2',
        ],
    },
};

/**
 * The bank a deployment ships by default.
 *
 * GeneralUser GS is the best quality-per-megabyte GM set and small enough for a
 * browser to fetch and cache. FluidR3 sounds better but is ~5x the size, which
 * is a long first load for every user.
 */
export const DEFAULT_BANK = 'generaluser';

/** Filenames of every bank that could legitimately be deployed. */
export const BANK_FILENAMES = new Set(
    Object.values(BANKS).map(bank => bank.fileName));

/**
 * Deliberately excluded: MuseScore_General. Its `.sf2` is 215 MB — far too much
 * for a browser to fetch — and its `.sf3` variant stores samples as Ogg Vorbis,
 * which `SoundFontParser` does not decode.
 */
