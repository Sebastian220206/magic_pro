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
                /*
                 * Built from channels with the alpha placeholder, so the
                 * opacity modifier works. As a bare `var()` holding a hex,
                 * `bg-accent-cyan/20` compiled to an invalid colour and
                 * painted nothing — across 184 uses.
                 */
                "accent-cyan": "rgb(var(--accent-cyan-rgb) / <alpha-value>)",
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
                },

                /**
                 * Studio surfaces — see the --studio-* block in globals.css.
                 *
                 * Named rather than left as arbitrary values so the chrome reads
                 * as `bg-studio-panel` instead of `bg-[#0d141d]`, which is what
                 * made the previous grey scheme impossible to retheme: 380
                 * hard-coded hex tokens with no shared name between them.
                 */
                studio: {
                    void: "rgb(var(--studio-void-rgb) / <alpha-value>)",
                    panel: "rgb(var(--studio-panel-rgb) / <alpha-value>)",
                    sunken: "rgb(var(--studio-sunken-rgb) / <alpha-value>)",
                    raised: "rgb(var(--studio-raised-rgb) / <alpha-value>)",
                    control: "rgb(var(--studio-control-rgb) / <alpha-value>)",
                    // The two line colours are already translucent by
                    // definition, so they stay whole rather than gaining a
                    // second alpha on top of their own.
                    line: "var(--studio-line)",
                    "line-strong": "var(--studio-line-strong)",
                    text: "rgb(var(--studio-text-rgb) / <alpha-value>)",
                    "text-mid": "rgb(var(--studio-text-mid-rgb) / <alpha-value>)",
                    "text-dim": "rgb(var(--studio-text-dim-rgb) / <alpha-value>)",
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
                /** Breathing glow for primary calls to action. */
                "pulse-glow": {
                    "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
                    "50%": { opacity: "0.75", transform: "scale(1.04)" },
                },
            },
            animation: {
                float: "float 6s ease-in-out infinite",
                "pulse-glow": "pulse-glow 4s ease-in-out infinite",
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
