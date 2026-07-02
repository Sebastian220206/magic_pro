import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { getSession } from "@/lib/auth";

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
        <html lang="en">
            <body className="bg-daw-bg text-gray-200 antialiased overflow-hidden select-none">
                <Providers session={session}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
