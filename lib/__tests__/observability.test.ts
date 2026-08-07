/**
 * Error reporting must never become a way to exfiltrate secrets.
 *
 * A report is sent to an external collector and written to a log platform, so
 * anything in it has left the application's trust boundary. Error messages from
 * a query layer routinely quote the row that failed, which is how a password
 * hash or a token ends up in a third-party service.
 */

import { reportError } from '../observability';

describe('reportError', () => {
    let logged: string[];
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        logged = [];
        consoleSpy = jest.spyOn(console, 'error').mockImplementation((line: unknown) => {
            logged.push(String(line));
        });
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    /** The JSON line written for the most recent report. */
    function record(): Record<string, unknown> {
        return JSON.parse(logged[logged.length - 1]);
    }

    it('writes one line of JSON, not a multi-line stack', () => {
        reportError(new Error('boom'), { context: 'test' });

        expect(logged).toHaveLength(1);
        // A log platform groups by event. A stack split across entries becomes
        // a dozen unrelated errors.
        expect(() => JSON.parse(logged[0])).not.toThrow();
    });

    it('captures the error type, message and stack', () => {
        reportError(new TypeError('bad input'), { context: 'project.save' });

        expect(record()).toMatchObject({
            level: 'error',
            context: 'project.save',
            errorType: 'TypeError',
            message: 'bad input',
        });
        expect(record().stack).toContain('bad input');
    });

    it('handles a thrown non-Error', () => {
        // `throw 'string'` and `throw {code}` both reach here in real code.
        reportError('just a string', { context: 'test' });

        expect(record()).toMatchObject({
            errorType: 'UnknownError',
            message: 'just a string',
        });
    });

    it('returns a request id, and reuses one that was supplied', () => {
        const generated = reportError(new Error('x'), { context: 'test' });
        expect(typeof generated).toBe('string');
        expect(generated.length).toBeGreaterThan(0);

        const supplied = reportError(new Error('x'), {
            context: 'test', requestId: 'req-123',
        });
        expect(supplied).toBe('req-123');
        expect(record().requestId).toBe('req-123');
    });

    it('scrubs a connection-string password out of the message', () => {
        // The realistic case: a driver quoting its own DSN back at you.
        reportError(
            new Error('connect failed: postgres://admin:hunter2@db.internal:5432/app'),
            { context: 'test' },
        );

        const line = logged[0];
        expect(line).not.toContain('hunter2');
        // Still diagnosable — host, user and port survive.
        expect(line).toContain('db.internal:5432');
        expect(line).toContain('admin');
    });

    it('scrubs vendor API keys and bearer tokens', () => {
        const secrets = [
            'sk-proj-AbCdEfGhIjKlMnOpQrSt',
            'sk_live_51H8xKLmNoPqRsTuV',
            'whsec_9fK2mNpQrStUvWxYz123',
            'ghp_AbCdEfGhIjKlMnOpQrStUvWxYz012345',
            'github_pat_11ABCDEFG0abcdefghijklmnop',
            'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123',
        ];

        for (const secret of secrets) {
            logged.length = 0;
            reportError(new Error(`request rejected: ${secret}`), { context: 'test' });
            expect(logged[0]).not.toContain(secret.replace(/^Bearer /, ''));
            expect(logged[0]).toContain('[redacted]');
        }
    });

    it('scrubs self-describing assignments', () => {
        reportError(
            new Error('invalid body: {"password":"hunter2","apiKey":"abc123xyz"}'),
            { context: 'test' },
        );

        expect(logged[0]).not.toContain('hunter2');
        expect(logged[0]).not.toContain('abc123xyz');
    });

    it('scrubs the stack as well as the message', () => {
        // The stack embeds the message, so scrubbing only the message would
        // leave the secret in the report anyway.
        const error = new Error('token=supersecretvalue123');

        reportError(error, { context: 'test' });

        expect(logged[0]).not.toContain('supersecretvalue123');
    });

    it('leaves ordinary messages untouched', () => {
        reportError(new Error('Cannot read property length of undefined'), {
            context: 'test',
        });

        expect(record().message).toBe('Cannot read property length of undefined');
    });

    it('keeps ordinary diagnostic fields', () => {
        reportError(new Error('x'), {
            context: 'upload',
            userId: 'user-1',
            method: 'POST',
            path: '/api/upload',
        });

        expect(record()).toMatchObject({
            context: 'upload',
            userId: 'user-1',
            method: 'POST',
            path: '/api/upload',
        });
    });

    it('omits fields that were not supplied rather than writing null', () => {
        reportError(new Error('x'), { context: 'test' });

        expect(record()).not.toHaveProperty('userId');
        expect(record()).not.toHaveProperty('path');
    });

    it('does not throw when no collector is configured', () => {
        // The default path: ERROR_WEBHOOK_URL unset. Reporting must still work.
        expect(() => reportError(new Error('x'), { context: 'test' })).not.toThrow();
    });
});
