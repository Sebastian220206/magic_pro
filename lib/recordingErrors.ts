/**
 * Why a take failed, in words a musician can act on.
 *
 * The failures here arrive as DOMExceptions from getUserMedia, and the most
 * common one — OverconstrainedError, thrown when the input device stored in
 * settings no longer resolves — carries an **empty** `.message`. Reading
 * `error.message` therefore produced `''`, which is indistinguishable from no
 * error at all. The transport rolled, the record light came on, the recorder
 * sat idle, and nothing anywhere said why.
 *
 * Device ids are origin-scoped and rotate: clearing site data, replugging a USB
 * interface, or opening a project saved on another machine all leave a stored
 * id that no longer exists. It is a routine situation and deserves a sentence,
 * not silence.
 */
export function describeRecordingError(error: unknown): string {
    const name = (error as DOMException)?.name;
    const message = (error as Error)?.message;

    switch (name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Microphone access was blocked. Allow it for this site, then arm the track again.';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'The input device chosen in Settings > Audio is not available. Pick another one.';
        case 'NotReadableError':
        case 'AbortError':
            return 'The input device is in use by another application.';
        default:
            return message || String(name || error) || 'Recording could not start.';
    }
}
