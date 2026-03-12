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
        },
    },
    plugins: [],
};
export default config;
