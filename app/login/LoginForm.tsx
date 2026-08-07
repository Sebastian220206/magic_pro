"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Music, Loader2 } from "lucide-react";
import GoogleSignInButton, { AuthDivider } from "@/components/auth/GoogleSignInButton";

/**
 * Why a Google sign-in bounced back here.
 *
 * NextAuth redirects to the sign-in page with an opaque code rather than a
 * message. Left unmapped the user sees nothing at all and simply assumes the
 * button is broken.
 */
const OAUTH_ERRORS: Record<string, string> = {
  // Our `signIn` callback refused — currently only for an unverified address.
  AccessDenied: "That Google account could not be used to sign in.",
  OAuthAccountNotLinked:
    "An account with this email already exists. Sign in with your password instead.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
  OAuthCallback: "Google sign-in did not complete. Please try again.",
  Configuration: "Sign-in is not configured correctly. Please contact support.",
};

interface Props {
  googleEnabled?: boolean;
  /** `error` query parameter NextAuth appends when a provider fails. */
  oauthError?: string;
}

export default function LoginForm({ googleEnabled = false, oauthError }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    oauthError ? (OAUTH_ERRORS[oauthError] ?? "Sign-in failed. Please try again.") : "",
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "Configuration") {
          setError("Unable to connect to database. Please try again later.");
        } else {
          setError("Invalid email or password");
        }
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("[Login] Unexpected error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-daw-bg">
      <div className="bg-daw-panel p-10 rounded-xl shadow-2xl border border-daw-border w-96">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-daw-primary rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
            <Music className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl text-white font-bold">Welcome Back</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {googleEnabled && (
          <>
            <GoogleSignInButton callbackUrl="/dashboard" action="Sign in" disabled={loading} />
            <AuthDivider />
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-daw-surface border border-daw-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-daw-primary"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-daw-surface border border-daw-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-daw-primary"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-daw-primary text-white py-2.5 rounded-lg hover:bg-blue-600 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-gray-500 text-sm text-center mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-daw-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
