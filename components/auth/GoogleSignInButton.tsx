"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

/**
 * Google's mark, inline.
 *
 * Inline rather than an <img> because the app sends
 * `Cross-Origin-Embedder-Policy: require-corp` — a remote logo would need a
 * CORP header from Google's CDN and would simply not render.
 */
function GoogleLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
    );
}

interface Props {
    /** Where to land after Google returns. */
    callbackUrl?: string;
    /** Verb shown in the label — "Sign in" or "Sign up". */
    action?: string;
    /** Disabled while a sibling form is mid-submit. */
    disabled?: boolean;
}

/**
 * Start the Google OAuth redirect.
 *
 * `redirect: true` (the default) is deliberate: OAuth is a full navigation to
 * Google and back, so there is no result to hand back to the page. The loading
 * state exists to stop a second click during the moment before the browser
 * leaves.
 */
export default function GoogleSignInButton({
    callbackUrl = "/dashboard",
    action = "Sign in",
    disabled = false,
}: Props) {
    const [loading, setLoading] = useState(false);

    return (
        <button
            type="button"
            onClick={() => {
                setLoading(true);
                void signIn("google", { callbackUrl });
            }}
            disabled={disabled || loading}
            className="w-full bg-white text-gray-800 py-2.5 rounded-lg hover:bg-gray-100 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2.5 border border-gray-300"
        >
            {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <GoogleLogo className="w-[18px] h-[18px]" />}
            {loading ? "Redirecting…" : `${action} with Google`}
        </button>
    );
}

/** "or" rule between the Google button and the email form. */
export function AuthDivider() {
    return (
        <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-daw-border" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">or</span>
            <div className="h-px flex-1 bg-daw-border" />
        </div>
    );
}
