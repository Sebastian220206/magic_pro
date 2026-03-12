import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
    title: "Next.js DAW",
    description: "A browser-based Digital Audio Workstation",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="bg-daw-bg text-gray-200 antialiased overflow-hidden select-none">
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
