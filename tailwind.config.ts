import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--daw-bg)",
                foreground: "var(--daw-text)",
                "accent-cyan": "var(--accent-cyan)",
                "accent-cyan-glow": "var(--accent-cyan-glow)",
                "accent-cyan-glow-strong": "var(--accent-cyan-glow-strong)",
                daw: {
                    bg: "var(--daw-bg)",
                    panel: "var(--daw-panel)",
                    border: "var(--daw-border)",
                    header: "var(--daw-header)",
                    surface: "var(--daw-surface)",
                    primary: "var(--daw-primary)",
                    accent: "var(--daw-accent)",
                    text: "var(--daw-text)",
                    "text-dim": "var(--daw-text-dim)",
                }
            },

            /**
             * Display face for the marketing surfaces only.
             *
             * Deliberately not applied to `body`. The studio is a dense,
             * Logic-style interface whose panel, meter and timeline layouts are
             * tuned against the current system stack, and swapping its metrics
             * app-wide would shift text in places nobody would think to check.
             * Headings on /welcome and /dashboard get it via `font-display`.
             */
            fontFamily: {
                display: ["var(--font-display)", "system-ui", "sans-serif"],
            },

            /**
             * Motion belonging to this project.
             *
             * Names are distinct from anything `tailwindcss-animate` provides —
             * that plugin owns `animate-in`/`animate-out` plus the `fade-*`,
             * `zoom-*` and `slide-in-from-*` modifiers, and these must not
             * shadow them.
             */
            keyframes: {
                /** Slow vertical drift, for decorative glows. */
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-12px)" },
                },
                /** Sweep used on gradient text and skeletons. */
                shimmer: {
                    "0%": { backgroundPosition: "-200% 0" },
                    "100%": { backgroundPosition: "200% 0" },
                },
                /** Breathing glow for primary calls to action. */
                "pulse-glow": {
                    "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
                    "50%": { opacity: "0.75", transform: "scale(1.04)" },
                },
                /** Very slow zoom, so a short video loop reads as less repetitive. */
                "ken-burns": {
                    "0%, 100%": { transform: "scale(1.04)" },
                    "50%": { transform: "scale(1.12)" },
                },
            },
            animation: {
                float: "float 6s ease-in-out infinite",
                shimmer: "shimmer 6s linear infinite",
                "pulse-glow": "pulse-glow 4s ease-in-out infinite",
                "ken-burns": "ken-burns 28s ease-in-out infinite",
            },
        },
    },
    /**
     * ~45 files already write `animate-in`, `fade-in`, `zoom-in-95` and
     * `slide-in-from-*`. Those are this plugin's API and were silent no-ops
     * until it was installed, so enabling it makes a lot of previously written
     * intent take effect at once. `app/globals.css` carries a global
     * prefers-reduced-motion override for the same reason.
     */
    plugins: [require("tailwindcss-animate")],
};
export default config;
