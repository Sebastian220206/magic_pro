import { googleAuthEnabled } from "@/lib/auth";
import LoginForm from "./LoginForm";

/**
 * Server component wrapper.
 *
 * Whether Google sign-in is available depends on `GOOGLE_CLIENT_ID` and
 * `GOOGLE_CLIENT_SECRET`, which are server-only — the secret must never reach
 * the browser, so it cannot be a `NEXT_PUBLIC_` variable. Deciding here and
 * passing a boolean keeps the credential server-side and renders the correct
 * page on the first paint, rather than fetching the provider list on the
 * client and popping a button in afterwards.
 */
export default function LoginPage({
    searchParams,
}: {
    searchParams?: { error?: string };
}) {
    // NextAuth sends a failed provider sign-in back here as `?error=<code>`.
    return (
        <LoginForm
            googleEnabled={googleAuthEnabled}
            oauthError={searchParams?.error}
        />
    );
}
