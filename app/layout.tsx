import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Providers } from "./providers";
import { getSession } from "@/lib/auth";

/**
 * Display face for headings on the marketing pages.
 *
 * `next/font` self-hosts the files at build time, which matters here beyond the
 * usual performance argument: the app sends
 * `Cross-Origin-Embedder-Policy: require-corp`, so a `<link>` to
 * fonts.googleapis.com would be blocked outright and the page would silently
 * fall back to the system stack.
 *
 * Exposed as a variable rather than applied to `<body>` — see the `fontFamily`
 * note in tailwind.config.ts for why the studio keeps the system stack.
 */
const display = Outfit({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-display",
});

export const metadata: Metadata = {
    title: "Magic Pro DAW",
    description: "A professional browser-based Digital Audio Workstation",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Magic Pro",
    },
    icons: {
        icon: "/favicon.ico",
        apple: "/icons/icon-192x192.png",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    /*
     * `cover` lets content reach under the notch and home indicator; the studio
     * shell pads itself back out with `env(safe-area-inset-*)` (see
     * globals.css). Without it a landscape phone loses a strip down each side.
     */
    viewportFit: "cover",
    /*
     * Zoom is deliberately left enabled — `maximumScale: 1` would block
     * pinch-zoom, which is an accessibility failure and something a DAW's dense
     * timeline genuinely benefits from. The iOS zoom-on-focus problem is solved
     * properly instead, by giving inputs a 16px font size (globals.css); iOS
     * only zooms when the field's text is smaller than that.
     */
    themeColor: "#1a1a2e",
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    return (
        <html lang="en" className={display.variable}>
            {/*
              * `overflow-hidden` used to live here. It is what the studio needs,
              * but it applied to every route — so /welcome, /dashboard and
              * /login could not scroll past the viewport no matter how tall
              * their content was. The studio sets its own on an h-screen
              * container (app/project/[projectId]/page.tsx:151-152), so it is
              * not lost.
              */}
            <body className="bg-daw-bg text-gray-200 antialiased select-none">
                <Providers session={session}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
