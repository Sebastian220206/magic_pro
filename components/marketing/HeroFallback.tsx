/**
 * HeroFallback.tsx
 * What stands in for the video.
 *
 * This is not a loading placeholder. It renders whenever the video cannot or
 * should not play — no URL configured, the file failed to load, or the visitor
 * has asked for reduced motion — so it has to look like a finished design in its
 * own right rather than like something missing.
 *
 * Pure CSS and inline SVG: no canvas, no dependency, no network request. That
 * also makes it the safe thing to render on the server, avoiding a flash of
 * empty background before hydration decides whether the video can play.
 */

interface HeroFallbackProps {
    /** Whether to animate. False for reduced motion — the gradient stays still. */
    animated?: boolean;
    className?: string;
}

export default function HeroFallback({
    animated = true,
    className = "",
}: HeroFallbackProps) {
    return (
        <div
            className={`absolute inset-0 overflow-hidden bg-daw-bg ${className}`}
            aria-hidden="true"
        >
            {/* Warm base, echoing the amber of the video so the two are
                interchangeable without the page changing character. */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#2a1810] via-[#1a1015] to-[#0d0d14]" />

            {/* Two drifting colour pools. Blurred heavily so they read as light
                rather than as shapes. */}
            <div
                className={`absolute -left-1/4 top-0 h-[70vh] w-[70vh] rounded-full bg-amber-500/20 blur-[120px] ${animated ? "animate-float" : ""
                    }`}
            />
            <div
                className={`absolute -right-1/4 bottom-0 h-[60vh] w-[60vh] rounded-full bg-fuchsia-600/15 blur-[120px] ${animated ? "animate-float [animation-delay:3s]" : ""
                    }`}
            />

            {/* A waveform, because this is a DAW and the motif should say so. */}
            <svg
                className="absolute inset-x-0 bottom-0 h-1/3 w-full opacity-[0.14]"
                viewBox="0 0 1200 200"
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id="hero-fallback-wave" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--accent-cyan)" />
                        <stop offset="50%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="var(--daw-primary)" />
                    </linearGradient>
                </defs>
                <path
                    d="M0,100 C60,40 120,160 180,100 C240,40 300,160 360,100 C420,40 480,160 540,100 C600,40 660,160 720,100 C780,40 840,160 900,100 C960,40 1020,160 1080,100 C1140,40 1170,130 1200,100"
                    fill="none"
                    stroke="url(#hero-fallback-wave)"
                    strokeWidth="2.5"
                />
                <path
                    d="M0,140 C80,110 160,170 240,140 C320,110 400,170 480,140 C560,110 640,170 720,140 C800,110 880,170 960,140 C1040,110 1120,170 1200,140"
                    fill="none"
                    stroke="url(#hero-fallback-wave)"
                    strokeWidth="1.5"
                    opacity="0.6"
                />
            </svg>

            {/* Grain, to stop the large flat gradient from banding on 8-bit panels. */}
            <div
                className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
                }}
            />
        </div>
    );
}
