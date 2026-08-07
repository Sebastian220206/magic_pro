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
    viewportFit: "cover",
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
