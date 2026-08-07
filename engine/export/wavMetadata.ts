/**
 * wavMetadata.ts
 * Write delivery tags into a rendered WAV.
 *
 * Metadata was carried on the export *result* but never reached the file, so a
 * delivered master arrived untagged and an ISRC had to be added by hand.
 *
 * Tags go in a RIFF `LIST`/`INFO` chunk, which is the form every DAW and
 * library reads. Implemented as a pass over a finished WAV rather than inside
 * `encodeWav`, so the encoder's per-bit-depth fast paths stay untouched.
 */

import type { ExportMetadata } from './projectExport';

/** INFO tag ids, in the order they are written. */
const INFO_TAGS: [keyof ExportMetadata, string][] = [
    ['title', 'INAM'],
    ['artist', 'IART'],
    ['album', 'IPRD'],
    ['year', 'ICRD'],
    ['isrc', 'ISRC'],
    ['comment', 'ICMT'],
];

/**
 * RIFF INFO tags are single-byte text, not UTF-8, so encode by char code
 * rather than through `TextEncoder` — which also keeps this usable anywhere
 * that global is absent. Anything outside Latin-1 becomes '?' rather than
 * silently writing a byte a reader would mis-decode.
 */
function ascii(text: string): Uint8Array {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        out[i] = code < 0x100 ? code : 0x3f;
    }
    return out;
}

function decodeAscii(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
}

function writeTag(id: string, value: string): Uint8Array {
    // RIFF strings are NUL-terminated and padded to an even length.
    const body = ascii(value);
    const withNul = body.length + 1;
    const padded = withNul + (withNul % 2);

    const out = new Uint8Array(8 + padded);
    out.set(ascii(id), 0);
    new DataView(out.buffer).setUint32(4, withNul, true);
    out.set(body, 8);
    return out;
}

/**
 * Build a `LIST`/`INFO` chunk, or null when there is nothing to write.
 */
export function buildInfoChunk(metadata: ExportMetadata): Uint8Array | null {
    const tags = INFO_TAGS
        .map(([key, id]) => {
            const value = metadata[key];
            return typeof value === 'string' && value.trim().length > 0
                ? writeTag(id, value.trim())
                : null;
        })
        .filter((t): t is Uint8Array => t !== null);

    if (tags.length === 0) return null;

    const bodyLength = tags.reduce((n, t) => n + t.length, 0);
    // 'INFO' + the tags.
    const chunkPayload = 4 + bodyLength;

    const out = new Uint8Array(8 + chunkPayload);
    out.set(ascii('LIST'), 0);
    new DataView(out.buffer).setUint32(4, chunkPayload, true);
    out.set(ascii('INFO'), 8);

    let at = 12;
    for (const tag of tags) { out.set(tag, at); at += tag.length; }
    return out;
}

const readId = (view: DataView, offset: number) =>
    String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3),
    );

/**
 * Insert an INFO chunk into a WAV.
 *
 * The chunk is placed before `data`, which is where readers expect it, and the
 * RIFF size field is corrected. Returns the input unchanged if there is nothing
 * to write or the buffer is not a RIFF/WAVE file — a bad tag should never cost
 * someone their bounce.
 */
export function withWavMetadata(
    wav: ArrayBuffer,
    metadata: ExportMetadata | undefined,
): ArrayBuffer {
    if (!metadata) return wav;

    const chunk = buildInfoChunk(metadata);
    if (!chunk) return wav;

    if (wav.byteLength < 12) return wav;
    const view = new DataView(wav);
    if (readId(view, 0) !== 'RIFF' || readId(view, 8) !== 'WAVE') return wav;

    // Walk the chunk list to find where `data` begins.
    let cursor = 12;
    let dataOffset = -1;
    while (cursor + 8 <= wav.byteLength) {
        const id = readId(view, cursor);
        const size = view.getUint32(cursor + 4, true);
        if (id === 'data') { dataOffset = cursor; break; }
        cursor += 8 + size + (size % 2);
    }
    if (dataOffset < 0) return wav;

    const out = new Uint8Array(wav.byteLength + chunk.length);
    const source = new Uint8Array(wav);

    out.set(source.subarray(0, dataOffset), 0);
    out.set(chunk, dataOffset);
    out.set(source.subarray(dataOffset), dataOffset + chunk.length);

    // RIFF size counts everything after the first 8 bytes.
    new DataView(out.buffer).setUint32(4, out.length - 8, true);
    return out.buffer;
}

/** Convenience wrapper for a `Blob` straight out of `encodeWav`. */
export async function tagWavBlob(
    blob: Blob,
    metadata: ExportMetadata | undefined,
): Promise<Blob> {
    if (!metadata) return blob;
    const tagged = withWavMetadata(await blob.arrayBuffer(), metadata);
    return new Blob([tagged], { type: blob.type || 'audio/wav' });
}

/** Read INFO tags back out of a WAV, for tests and for verifying a delivery. */
export function readWavMetadata(wav: ArrayBuffer): ExportMetadata {
    const found: ExportMetadata = {};
    if (wav.byteLength < 12) return found;

    const view = new DataView(wav);
    if (readId(view, 0) !== 'RIFF' || readId(view, 8) !== 'WAVE') return found;

    const byId = new Map(INFO_TAGS.map(([key, id]) => [id, key]));

    let cursor = 12;
    while (cursor + 8 <= wav.byteLength) {
        const id = readId(view, cursor);
        const size = view.getUint32(cursor + 4, true);

        if (id === 'LIST' && cursor + 12 <= wav.byteLength && readId(view, cursor + 8) === 'INFO') {
            let at = cursor + 12;
            const end = Math.min(cursor + 8 + size, wav.byteLength);
            while (at + 8 <= end) {
                const tagId = readId(view, at);
                const tagSize = view.getUint32(at + 4, true);
                const key = byId.get(tagId);
                if (key) {
                    const bytes = new Uint8Array(wav, at + 8, Math.max(0, tagSize - 1));
                    found[key] = decodeAscii(bytes);
                }
                at += 8 + tagSize + (tagSize % 2);
            }
        }
        cursor += 8 + size + (size % 2);
    }
    return found;
}
