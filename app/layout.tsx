import type { Metadata } from "next";
import { authClient } from "@/lib/auth/client";
import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
    // canonical·OG URL은 환경과 무관하게 운영 도메인으로 고정한다.
    metadataBase: new URL(SITE_URL),
    title: {
        default: SITE_TITLE,
        template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    icons: {
        icon: [
            { url: "/logo/logo.svg", type: "image/svg+xml" },
            { url: "/logo/logo-32.png", sizes: "32x32", type: "image/png" },
            { url: "/logo/logo-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: [{ url: "/logo/logo-180.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
        type: "website",
        url: "/",
        siteName: SITE_NAME,
        title: SITE_TITLE,
        description: "Start a session on one PC and continue it on another.",
        images: [
            {
                url: "/og/og.png",
                width: 1200,
                height: 630,
                alt: "LocalAgents: start on one PC, continue everywhere.",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: SITE_TITLE,
        description: "Start a session on one PC and continue it on another.",
        images: ["/og/og.png"],
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <NeonAuthUIProvider
                    authClient={authClient}
                    social={{ providers: ["google", "github"] }}
                    credentials={false}
                    signUp={false}
                >
                    {children}
                </NeonAuthUIProvider>
            </body>
        </html>
    );
}
