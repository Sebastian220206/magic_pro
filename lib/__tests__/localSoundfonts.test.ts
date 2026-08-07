/**
 * Tests for locally-served SoundFont discovery.
 *
 * These ids become filesystem paths, so the traversal cases are security
 * relevant, not just tidiness.
 */

import path from 'path';
import {
    LOCAL_ID_PREFIX,
    SOUNDFONT_DIR,
    fromLocalId,
    localSoundfontPath,
    toLocalId,
} from '@/lib/localSoundfonts';

describe('local soundfont ids', () => {
    test('round-trips an ordinary filename', () => {
        const id = toLocalId('GeneralUser-GS.sf2');
        expect(fromLocalId(id)).toBe('GeneralUser-GS.sf2');
    });

    test('round-trips names with spaces, commas and parentheses', () => {
        // Real fonts on disk look like this.
        const name = 'Drums Douglas Natural Studio Kit V2.0 (22,719KB).sf2';
        expect(fromLocalId(toLocalId(name))).toBe(name);
    });

    test('ids are prefixed so they never collide with database ids', () => {
        expect(toLocalId('a.sf2').startsWith(LOCAL_ID_PREFIX)).toBe(true);
        // A cuid from the database must not be mistaken for a local font.
        expect(fromLocalId('clsx8f2k90000ua47abcd1234')).toBeNull();
    });

    test('accepts sf3 as well as sf2', () => {
        expect(fromLocalId(toLocalId('bank.sf3'))).toBe('bank.sf3');
    });

    test('rejects a non-soundfont extension', () => {
        expect(fromLocalId(toLocalId('notes.txt'))).toBeNull();
        expect(fromLocalId(toLocalId('script.js'))).toBeNull();
    });
});

describe('path traversal', () => {
    test('rejects parent directory segments', () => {
        expect(fromLocalId(toLocalId('../secret.sf2'))).toBeNull();
        expect(fromLocalId(LOCAL_ID_PREFIX + encodeURIComponent('../../etc/passwd.sf2'))).toBeNull();
    });

    test('rejects nested paths', () => {
        expect(fromLocalId(LOCAL_ID_PREFIX + encodeURIComponent('sub/dir/font.sf2'))).toBeNull();
    });

    test('rejects backslash separators', () => {
        expect(fromLocalId(LOCAL_ID_PREFIX + encodeURIComponent('..\\windows\\x.sf2'))).toBeNull();
    });

    test('rejects an empty name', () => {
        expect(fromLocalId(LOCAL_ID_PREFIX)).toBeNull();
    });
});

describe('localSoundfontPath', () => {
    test('resolves inside the soundfont directory', () => {
        const resolved = localSoundfontPath(toLocalId('bank.sf2'));
        expect(resolved).toBe(path.join(SOUNDFONT_DIR, 'bank.sf2'));
    });

    test('returns null for a non-local id', () => {
        expect(localSoundfontPath('clsx8f2k90000ua47abcd1234')).toBeNull();
    });

    test('never escapes the soundfont directory', () => {
        const attempts = [
            '../../../etc/passwd.sf2',
            '..\\..\\config.sf2',
            'a/../../b.sf2',
        ];
        for (const attempt of attempts) {
            const resolved = localSoundfontPath(LOCAL_ID_PREFIX + encodeURIComponent(attempt));
            if (resolved !== null) {
                expect(resolved.startsWith(SOUNDFONT_DIR)).toBe(true);
            }
        }
    });
});
