"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

interface Props {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}

export function AccountForm({ user }: Props) {
  const router = useRouter();
  const [name, setName] = useState(user.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/account/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        setMessage("Saved");
      } else {
        setMessage("Failed to save");
      }
    } catch {
      setMessage("Failed to save");
    }

    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="bg-daw-panel border border-daw-border rounded-xl p-6 space-y-6">
      <div>
        <label className="text-sm text-gray-300 block mb-1">Email</label>
        <input
          type="email"
          value={user.email || ""}
          disabled
          className="w-full bg-daw-surface border border-daw-border rounded-lg px-4 py-2.5 text-gray-400 cursor-not-allowed"
        />
      </div>

      <div>
        <label className="text-sm text-gray-300 block mb-1">Display Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-daw-surface border border-daw-border rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-daw-primary"
          placeholder="Your name"
        />
      </div>

      {message && (
        <p className="text-sm text-green-400">{message}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-daw-primary text-white py-2.5 rounded-lg hover:bg-blue-600 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? "Saving..." : "Save Changes"}
      </button>

      <hr className="border-daw-border" />

      <button
        onClick={handleSignOut}
        className="w-full bg-red-900/30 text-red-400 border border-red-800 py-2.5 rounded-lg hover:bg-red-900/50 transition font-medium flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );
}
