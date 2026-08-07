import { NextAuthOptions, getServerSession, type Profile } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

/**
 * Whether Google sign-in is configured.
 *
 * The provider is registered only when both halves of the credential exist.
 * Registering it regardless would put a button on the login page that fails
 * with an opaque NextAuth error, which is worse than not offering it — so the
 * UI reads this to decide whether to render one.
 */
export const googleAuthEnabled = Boolean(googleClientId && googleClientSecret);

/** Google's profile carries a verification flag the base `Profile` type omits. */
interface GoogleProfile extends Profile {
  email_verified?: boolean;
  picture?: string;
}

/**
 * Find or create the local row for an OAuth sign-in.
 *
 * There is no NextAuth database adapter here — sessions are JWTs — so nothing
 * writes an OAuth user to the database automatically. Every project, plugin
 * and rate-limit key in this app hangs off `User.id`, so a Google user without
 * a row would authenticate successfully and then fail on the first query.
 *
 * An existing row is reused rather than duplicated, which is what links a
 * Google login to an account originally created with a password. See the
 * `signIn` callback for why that is only safe on a verified address.
 */
async function findOrCreateOAuthUser(email: string, name?: string | null) {
  const normalizedEmail = email.toLowerCase().trim();

  return prisma.user.upsert({
    where: { email: normalizedEmail },
    // Deliberately empty: a returning user may have edited their display name,
    // and overwriting it from the Google profile on every sign-in would undo
    // that silently.
    update: {},
    create: {
      email: normalizedEmail,
      name: name ?? null,
      // No password. The column is nullable precisely for this.
      passwordHash: null,
    },
  });
}

const providers: Provider[] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      try {
        const normalizedEmail = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user) return null;

        // A Google-only account has no hash. `bcrypt.compare` throws on null,
        // which would surface as a 500 on an ordinary failed login — and would
        // also reveal, by the difference in behaviour, which addresses are
        // registered through Google.
        if (!user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      } catch (err) {
        console.error("[Auth] Database error during authorize:", err);
        return null;
      }
    },
  }),
];

if (googleAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId!,
      clientSecret: googleClientSecret!,
      authorization: {
        params: {
          // `select_account` so a shared machine does not silently reuse
          // whichever Google session happens to be active.
          prompt: "select_account",
        },
      },
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  pages: {
    signIn: "/login",
    // Without this, a failed OAuth callback lands on NextAuth's own error page
    // — a bare "Sign in" heading and a code like `OAuthCallback`. Routing it to
    // /login?error=<code> is what lets `OAUTH_ERRORS` there turn the code into
    // a sentence, next to the form the user can actually retry with.
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const googleProfile = profile as GoogleProfile | undefined;
      if (!googleProfile?.email) return false;

      // Matching on email is what links a Google login to an existing account,
      // so an unverified address would be a way to claim someone else's. Google
      // sets this flag; requiring it costs nothing and closes that door.
      if (!googleProfile.email_verified) {
        console.warn("[Auth] Rejected Google sign-in with an unverified email.");
        return false;
      }

      return true;
    },

    async jwt({ token, user, account }) {
      // Only on initial sign-in — `user` is absent on subsequent requests, so
      // this does not hit the database on every call.
      if (user && account?.provider === "google" && user.email) {
        try {
          const dbUser = await findOrCreateOAuthUser(user.email, user.name);
          // Our cuid, not Google's subject id. The rest of the app treats
          // `token.id` as a `User.id` and would otherwise query for a row that
          // does not exist.
          token.id = dbUser.id;
          token.role = dbUser.role;
        } catch (err) {
          console.error("[Auth] Could not persist Google user:", err);
          // Leaving `token.id` unset would produce a session that looks valid
          // and fails every authorized request.
          throw err;
        }
        return token;
      }

      if (user) {
        token.id = user.id;
        token.role = user.role ?? "user";
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}
