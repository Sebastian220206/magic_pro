"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import HeroFallback from "./HeroFallback";

/**
 * BackgroundVideo.tsx
 * A looping video behind page content, with a fallback that is not a failure
 * state.
 *
 * ## crossOrigin is load-bearing
 *
 * The app sends `Cross-Origin-Embedder-Policy: require-corp`. Under that policy
 * a cross-origin subresource must either carry a
 * `Cross-Origin-Resource-Policy` header or be fetched in CORS mode. Supabase
 * Storage — where these files live — sends `Access-Control-Allow-Origin: *` but
 * **no** CORP header, verified directly against the project.
 *
 * A bare `<video src>` is a *no-cors* request, so it is blocked. Setting
 * `crossOrigin="anonymous"` makes it a CORS request, which the ACAO header then
 * satisfies. Remove that attribute and the element goes silently blank, with a
 * console warning and no JavaScript error — nothing throws, nothing calls
 * `onError`, the page simply has no video. `engine/video/VideoEngine.ts:60`
 * sets it for the same reason.
 */

interface BackgroundVideoProps {
    /** Video URL. Absent → the fallback renders. */
    src?: string;
    /** Poster frame, shown until enough video has buffered. */
    poster?: string;
    /**
     * How hard to darken the footage. `heavy` for a full-bleed hero carrying
     * headline text; `light` for a decorative strip.
     */
    overlay?: "heavy" | "light" | "none";
    /** Slow zoom, so a short loop reads as less repetitive. */
    kenBurns?: boolean;
    className?: string;
    /** Content laid over the video. */
    children?: ReactNode;
}

/**
 * Does this visitor want reduced motion?
 *
 * Returns `undefined` until the answer is known. That third state is the whole
 * point: `window.matchMedia` does not exist during server rendering, so the
 * preference can only be read in an effect. An initial value of `false` would
 * mean the video mounts and autoplays on the first commit and is only torn down
 * on the second — a visitor who asked for stillness would get a flash of moving
 * video, and `play()` would already have been called.
 *
 * Callers must therefore treat `undefined` as "not yet permitted", not as "no".
 */
function usePrefersReducedMotion(): boolean | undefined {
    const [reduced, setReduced] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(query.matches);

        const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    return reduced;
}

const OVERLAYS: Record<NonNullable<BackgroundVideoProps["overlay"]>, string> = {
    // Two layers: a flat scrim for contrast, and a vertical gradient so text
    // near the bottom stays readable without dimming the whole frame.
    heavy: "bg-daw-bg/70 bg-gradient-to-b from-daw-bg/80 via-daw-bg/60 to-daw-bg",
    light: "bg-gradient-to-r from-daw-bg/90 via-daw-bg/60 to-daw-bg/30",
    none: "",
};

export default function BackgroundVideo({
    src,
    poster,
    overlay = "heavy",
    kenBurns = false,
    className = "",
    children,
}: BackgroundVideoProps) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // `=== false` rather than `!prefersReducedMotion`: while the preference is
    // still undefined the video must not mount, or it autoplays for one commit
    // before the answer arrives.
    const showVideo = Boolean(src) && !failed && prefersReducedMotion === false;

    // A src that changes after a failure deserves another attempt.
    useEffect(() => {
        setFailed(false);
        setReady(false);
    }, [src]);

    /**
     * Autoplay can still be refused even when muted — some browsers block it
     * under data-saver or a low battery. The promise rejecting is the only
     * signal, so treat it as a failure and show the fallback rather than
     * leaving a frozen poster.
     */
    useEffect(() => {
        if (!showVideo) return;
        const el = videoRef.current;
        if (!el) return;

        const attempt = el.play();
        if (attempt?.catch) {
            attempt.catch(() => setFailed(true));
        }
    }, [showVideo, src]);

    return (
        <div className={`relative isolate overflow-hidden ${className}`}>
            {/* The fallback sits underneath rather than being swapped out, so
                there is never a gap while the video buffers. */}
            <HeroFallback animated={prefersReducedMotion === false} />

            {showVideo && (
                <video
                    ref={videoRef}
                    // Mandatory under COEP — see the note at the top of this file.
                    crossOrigin="anonymous"
                    src={src}
                    poster={poster}
                    muted
                    loop
                    // iOS refuses to autoplay without this, and goes fullscreen instead.
                    playsInline
                    autoPlay
                    preload="metadata"
                    aria-hidden="true"
                    tabIndex={-1}
                    onCanPlay={() => setReady(true)}
                    onError={() => setFailed(true)}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"
                        } ${kenBurns ? "animate-ken-burns" : ""}`}
                />
            )}

            {overlay !== "none" && (
                <div className={`absolute inset-0 ${OVERLAYS[overlay]}`} aria-hidden="true" />
            )}

            <div className="relative z-10">{children}</div>
        </div>
    );
}
