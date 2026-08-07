"use client";

import { useState } from "react";
import { RotateCcw, Music } from "lucide-react";

/**
 * RotateToLandscape.tsx
 * Shown over the studio when a small screen is held upright.
 *
 * The studio is a timeline: track headers on the left, bars running to the
 * right. In portrait on a phone the headers take roughly three quarters of the
 * width and the timeline gets a sliver, while the transport and toolbar rows
 * both run off the edge. It is not a matter of tightening spacing — the layout
 * wants width it does not have.
 *
 * So this asks for a rotation rather than pretending. There is still a way
 * past it: the threshold catches small tablets in portrait too, where the
 * result is cramped but usable, and refusing outright would be wrong for them.
 */
export default function RotateToLandscape() {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-daw-bg px-8 text-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rotate-title"
        >
            <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-daw-primary/20 blur-2xl" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-daw-panel">
                    <Music className="h-9 w-9 text-daw-primary" />
                </div>
            </div>

            <div>
                <h1 id="rotate-title" className="font-display text-2xl font-bold text-white">
                    Turn your device sideways
                </h1>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-gray-400">
                    The studio lays tracks out along a timeline, so it needs the
                    width. Rotate to landscape to start making music.
                </p>
            </div>

            <RotateCcw className="h-6 w-6 animate-pulse text-gray-500" aria-hidden="true" />

            <button
                onClick={() => setDismissed(true)}
                className="text-xs text-gray-500 underline underline-offset-4 transition hover:text-gray-300"
            >
                Continue anyway
            </button>
        </div>
    );
}
