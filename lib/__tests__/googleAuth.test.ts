/**
 * Google sign-in.
 *
 * Two things here are security-relevant rather than cosmetic:
 *
 * 1. Matching on email is what links a Google login to an account that already
 *    exists. On an unverified address that would be a way to claim someone
 *    else's account, so the verification flag is a gate, not a nicety.
 * 2. A Google-only account has no password hash. Passing null to `bcrypt`
 *    throws, which would turn an ordinary failed login into a 500 — and the
 *    difference in behaviour would reveal which addresses are Google accounts.
 */

const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: (...args: unknown[]) => mockFindUnique(...args),
            upsert: (...args: unknown[]) => mockUpsert(...args),
        },
    },
}));

const mockCompare = jest.fn();
jest.mock('bcryptjs', () => ({
    __esModule: true,
    default: { compare: (...args: unknown[]) => mockCompare(...args) },
}));

/** Load `authOptions` with a chosen set of Google env vars. */
function loadAuth(env: Record<string, string | undefined> = {}) {
    let options: typeof import('@/lib/auth').authOptions;
    let enabled = false;

    jest.isolateModules(() => {
        const previous = { ...process.env };
        Object.assign(process.env, env);
        for (const [k, v] of Object.entries(env)) {
            if (v === undefined) delete process.env[k];
        }

        const mod = require('@/lib/auth');
        options = mod.authOptions;
        enabled = mod.googleAuthEnabled;

        process.env = previous;
    });

    return { options: options!, enabled };
}

const WITH_GOOGLE = {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('provider registration', () => {
    it('offers Google only when both halves of the credential are set', () => {
        expect(loadAuth(WITH_GOOGLE).enabled).toBe(true);

        // A button that fails with an opaque NextAuth error is worse than no
        // button, so the UI reads this flag.
        expect(loadAuth({
            GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: undefined,
        }).enabled).toBe(false);
        expect(loadAuth({
            GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: 'secret',
        }).enabled).toBe(false);
    });

    it('keeps credentials sign-in working when Google is not configured', () => {
        const { options } = loadAuth({
            GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined,
        });

        expect(options.providers).toHaveLength(1);
        expect(options.providers[0].id).toBe('credentials');
    });

    it('registers both providers when configured', () => {
        const { options } = loadAuth(WITH_GOOGLE);

        expect(options.providers.map(p => p.id).sort()).toEqual(['credentials', 'google']);
    });
});

describe('credentials read from the environment', () => {
    /** The client_id the Google provider will actually send. */
    function clientIdSentToGoogle(env: Record<string, string | undefined>) {
        const provider = loadAuth(env).options.providers
            .find(p => p.id === 'google') as unknown as { options: { clientId: string } };
        return provider?.options.clientId;
    }

    it('strips a trailing newline from a pasted value', () => {
        // Exactly what broke production: pasting into a hosting dashboard
        // carried a newline, and Google answered `invalid_client` — which reads
        // like a deleted client, not one extra byte.
        const id = clientIdSentToGoogle({
            GOOGLE_CLIENT_ID: '278715348010-abc.apps.googleusercontent.com\n',
            GOOGLE_CLIENT_SECRET: 'GOCSPX-secret\n',
        });

        expect(id).toBe('278715348010-abc.apps.googleusercontent.com');
        expect(id).not.toMatch(/\s/);
    });

    it('strips surrounding spaces and carriage returns', () => {
        expect(clientIdSentToGoogle({
            GOOGLE_CLIENT_ID: '  id.apps.googleusercontent.com \r\n',
            GOOGLE_CLIENT_SECRET: ' secret ',
        })).toBe('id.apps.googleusercontent.com');
    });

    it('trims the secret too, since the token exchange would fail on it', () => {
        const provider = loadAuth({
            GOOGLE_CLIENT_ID: 'id',
            GOOGLE_CLIENT_SECRET: 'GOCSPX-secret\n',
        }).options.providers.find(p => p.id === 'google') as unknown as {
            options: { clientSecret: string };
        };

        expect(provider.options.clientSecret).toBe('GOCSPX-secret');
    });

    it('treats a whitespace-only value as unset', () => {
        // Otherwise the provider registers and every sign-in fails.
        expect(loadAuth({
            GOOGLE_CLIENT_ID: '   ', GOOGLE_CLIENT_SECRET: 'secret',
        }).enabled).toBe(false);

        expect(loadAuth({
            GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: '\n',
        }).enabled).toBe(false);
    });
});

describe('error routing', () => {
    it('sends failures to the login page, not NextAuth\'s own error page', () => {
        const { options } = loadAuth(WITH_GOOGLE);

        // The default error page shows a bare code like "OAuthCallback" with no
        // way to retry. /login?error=<code> is where the message mapping lives.
        expect(options.pages?.error).toBe('/login');
        expect(options.pages?.signIn).toBe('/login');
    });
});

describe('signIn callback', () => {
    const signIn = () => loadAuth(WITH_GOOGLE).options.callbacks!.signIn!;

    it('accepts a Google account with a verified email', async () => {
        const allowed = await signIn()({
            account: { provider: 'google' },
            profile: { email: 'user@gmail.com', email_verified: true },
        } as never);

        expect(allowed).toBe(true);
    });

    it('refuses an unverified email', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => { });

        // Otherwise an unverified address could be used to claim the existing
        // account that shares it.
        const allowed = await signIn()({
            account: { provider: 'google' },
            profile: { email: 'victim@gmail.com', email_verified: false },
        } as never);

        expect(allowed).toBe(false);
        warn.mockRestore();
    });

    it('refuses when the flag is missing entirely', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => { });

        // Absent is not the same as true — fail closed.
        const allowed = await signIn()({
            account: { provider: 'google' },
            profile: { email: 'user@gmail.com' },
        } as never);

        expect(allowed).toBe(false);
        warn.mockRestore();
    });

    it('refuses a profile with no email at all', async () => {
        const allowed = await signIn()({
            account: { provider: 'google' },
            profile: { email_verified: true },
        } as never);

        expect(allowed).toBe(false);
    });

    it('leaves credentials sign-in alone', async () => {
        const allowed = await signIn()({
            account: { provider: 'credentials' },
            profile: undefined,
        } as never);

        expect(allowed).toBe(true);
    });
});

describe('jwt callback for Google users', () => {
    const jwt = () => loadAuth(WITH_GOOGLE).options.callbacks!.jwt!;

    it('puts our database id on the token, not Google subject id', async () => {
        mockUpsert.mockResolvedValue({ id: 'cuid-123', role: 'user' });

        const token = await jwt()({
            token: {},
            user: { id: 'google-subject-999', email: 'User@Gmail.com', name: 'A' },
            account: { provider: 'google' },
        } as never);

        // Everything downstream treats token.id as a User.id and would query a
        // row that does not exist.
        expect(token.id).toBe('cuid-123');
        expect(token.id).not.toBe('google-subject-999');
        expect(token.role).toBe('user');
    });

    it('normalises the email so it cannot create a duplicate account', async () => {
        mockUpsert.mockResolvedValue({ id: 'cuid-1', role: 'user' });

        await jwt()({
            token: {},
            user: { id: 'g', email: '  User@GMAIL.com ', name: 'A' },
            account: { provider: 'google' },
        } as never);

        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({ where: { email: 'user@gmail.com' } }));
    });

    it('reuses an existing row rather than overwriting the display name', async () => {
        mockUpsert.mockResolvedValue({ id: 'cuid-1', role: 'admin' });

        await jwt()({
            token: {},
            user: { id: 'g', email: 'a@b.com', name: 'Google Name' },
            account: { provider: 'google' },
        } as never);

        // An empty update is "find or create": a returning user may have edited
        // their name, and the Google profile must not silently undo that.
        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({ update: {} }));
    });

    it('preserves an existing role instead of resetting it', async () => {
        mockUpsert.mockResolvedValue({ id: 'cuid-1', role: 'admin' });

        const token = await jwt()({
            token: {},
            user: { id: 'g', email: 'admin@b.com' },
            account: { provider: 'google' },
        } as never);

        expect(token.role).toBe('admin');
    });

    it('creates the row with no password hash', async () => {
        mockUpsert.mockResolvedValue({ id: 'cuid-1', role: 'user' });

        await jwt()({
            token: {},
            user: { id: 'g', email: 'a@b.com', name: 'A' },
            account: { provider: 'google' },
        } as never);

        expect(mockUpsert.mock.calls[0][0].create.passwordHash).toBeNull();
    });

    it('fails the sign-in rather than issuing a token with no id', async () => {
        mockUpsert.mockRejectedValue(new Error('database down'));
        const err = jest.spyOn(console, 'error').mockImplementation(() => { });

        // A token without an id looks like a valid session and then fails every
        // authorized request — worse than a visible sign-in failure.
        await expect(jwt()({
            token: {},
            user: { id: 'g', email: 'a@b.com' },
            account: { provider: 'google' },
        } as never)).rejects.toThrow('database down');

        err.mockRestore();
    });

    it('does not touch the database on later requests', async () => {
        // `user` is only present on initial sign-in.
        const token = await jwt()({ token: { id: 'cuid-1', role: 'user' } } as never);

        expect(mockUpsert).not.toHaveBeenCalled();
        expect(token.id).toBe('cuid-1');
    });
});

describe('credentials sign-in against a Google-only account', () => {
    const authorize = () => {
        const provider = loadAuth(WITH_GOOGLE).options.providers
            .find(p => p.id === 'credentials') as unknown as {
                options: { authorize: (c: unknown) => Promise<unknown> };
            };
        return provider.options.authorize;
    };

    it('refuses when the account has no password hash', async () => {
        mockFindUnique.mockResolvedValue({
            id: 'u1', email: 'g@gmail.com', name: 'G', role: 'user', passwordHash: null,
        });

        const result = await authorize()({ email: 'g@gmail.com', password: 'anything' });

        expect(result).toBeNull();
        // bcrypt.compare throws on null; reaching it at all would be a 500 on
        // an ordinary failed login.
        expect(mockCompare).not.toHaveBeenCalled();
    });

    it('still works for an account that has one', async () => {
        mockFindUnique.mockResolvedValue({
            id: 'u1', email: 'a@b.com', name: 'A', role: 'user', passwordHash: 'hash',
        });
        mockCompare.mockResolvedValue(true);

        const result = await authorize()({ email: 'a@b.com', password: 'correct' });

        expect(result).toMatchObject({ id: 'u1', email: 'a@b.com' });
    });

    it('refuses a wrong password', async () => {
        mockFindUnique.mockResolvedValue({
            id: 'u1', email: 'a@b.com', name: 'A', role: 'user', passwordHash: 'hash',
        });
        mockCompare.mockResolvedValue(false);

        expect(await authorize()({ email: 'a@b.com', password: 'wrong' })).toBeNull();
    });

    it('refuses an unknown account without probing bcrypt', async () => {
        mockFindUnique.mockResolvedValue(null);

        expect(await authorize()({ email: 'nobody@b.com', password: 'x' })).toBeNull();
        expect(mockCompare).not.toHaveBeenCalled();
    });
});
