"use client";

import { signIn } from "next-auth/react";
import { Music } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="flex h-screen items-center justify-center bg-daw-bg">
            <div className="bg-daw-panel p-10 rounded-xl shadow-2xl border border-daw-border w-96 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-daw-primary rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
                    <Music className="text-white w-8 h-8" />
                </div>
                <h1 className="text-2xl text-white font-bold mb-2">DAW Studio</h1>
                <p className="text-gray-400 mb-8 text-sm">Sign in to access your sessions and projects.</p>

                <button
                    onClick={() => signIn("credentials", { callbackUrl: "/dashboard" })}
                    className="w-full bg-daw-primary text-white py-3 rounded-lg hover:bg-blue-600 transition font-medium shadow-md flex items-center justify-center gap-2"
                >
                    Access Demo Account
                </button>
            </div>
        </div>
    );
}
