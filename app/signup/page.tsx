"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Music, Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !confirm) {
      setError("All fields are required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but login failed. Please try logging in.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
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
          <h1 className="text-2xl text-white font-bold">Create Account</h1>
          <p className="text-gray-400 text-sm mt-1">Sign up to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 block mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-daw-surface border border-daw-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-daw-primary"
              placeholder="Your name"
            />
          </div>

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
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-daw-surface border border-daw-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-daw-primary"
              placeholder="Repeat password"
              autoComplete="new-password"
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
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-gray-500 text-sm text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-daw-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
