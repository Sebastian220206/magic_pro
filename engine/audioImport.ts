/**
 * audioImport.ts
 * Browser-side audio file import utility.
 *
 * Flow:
 *   File  →  ArrayBuffer  →  decodeAudioData  →  AudioBuffer
 *
 * Works with mp3, wav, flac, ogg — anything the browser's
 * built-in codec can decode via decodeAudioData.
 *
 * No external libraries, no server round-trips.
 */

import { audioEngine2 } from './AudioEngineAdapter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportResult {
    /** The decoded AudioBuffer ready for playback/analysis. */
    buffer: AudioBuffer;
    /** Original file name as given by the user. */
    fileName: string;
    /** MIME type reported by the File object. */
    mimeType: string;
    /** File size in bytes. */
    sizeBytes: number;
    /** Duration in seconds (derived from the AudioBuffer). */
    durationSeconds: number;
    /**
     * A blob: URL created for this file.
     * Store this in `Clip.fileUrl` so the engine can re-fetch later.
     * Revoke with URL.revokeObjectURL() when the file is no longer needed.
     */
    blobUrl: string;
}

// ─── Supported types ─────────────────────────────────────────────────────────

const SUPPORTED_TYPES = [
    'audio/mpeg',       // mp3
    'audio/wav',        // wav
    'audio/x-wav',      // wav (alternative MIME)
    'audio/flac',       // flac
    'audio/ogg',        // ogg/vorbis
    'audio/webm',       // webm audio
    'audio/aac',        // aac / m4a
    'audio/mp4',        // m4a
];

function isSupportedType(mimeType: string): boolean {
    // Be lenient: also accept any 'audio/*' the browser might accept
    return mimeType.startsWith('audio/') || SUPPORTED_TYPES.includes(mimeType.toLowerCase());
}

// ─── Core import function ─────────────────────────────────────────────────────

/**
 * Import a single audio File, decode it, and return the result.
 *
 * @throws if the file type is not recognised or decoding fails.
 */
export async function importAudioFile(file: File): Promise<ImportResult> {
    if (!isSupportedType(file.type)) {
        throw new Error(
            `Unsupported file type "${file.type}". ` +
            `Supported: mp3, wav, flac, ogg, aac, webm.`,
        );
    }

    // Read the file as an ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);

    // Decode via the shared AudioContext
    const ctx = ensureContext();
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0)); // slice to avoid detached buffer issues

    // Create a stable blob URL so we can reload the file later without re-importing
    const blobUrl = URL.createObjectURL(file);

    return {
        buffer,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        durationSeconds: buffer.duration,
        blobUrl,
    };
}

/**
 * Import multiple files at once.
 * Resolves with an array of ImportResult in the same order as `files`.
 * Individual failures reject the entire promise — wrap in try/catch if needed.
 */
export async function importAudioFiles(files: File[] | FileList): Promise<ImportResult[]> {
    const fileArray = Array.from(files);
    return Promise.all(fileArray.map(importAudioFile));
}

/**
 * Decode an audio file from a URL (http/https or blob:) and return an AudioBuffer.
 * Convenience wrapper around fetch + decodeAudioData — same as audioEngine2.loadAudio()
 * but exposed here for use in import pipelines.
 */
export async function decodeFromUrl(url: string): Promise<AudioBuffer> {
    const ctx = ensureContext();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch "${url}": ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return ctx.decodeAudioData(arrayBuffer);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureContext(): AudioContext {
    // Piggyback on the shared engine context (also creates it if not yet done)
    const existing = audioEngine2.getContext();
    if (existing) return existing;

    // Fallback: create an isolated context for decoding only
    const Ctor =
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext ?? AudioContext;
    return new Ctor();
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error(`FileReader error: ${reader.error?.message}`));
        reader.readAsArrayBuffer(file);
    });
}
