import type { Metadata } from "next";
import { authClient } from "@/lib/auth/client";
import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import "./globals.css";

export const metadata: Metadata = {
    // canonical·OG URL은 환경과 무관하게 운영 도메인으로 고정한다. dev의 localhost가 메타에 새면 안 된다.
    metadataBase: new URL("https://localagents.link"),
    title: {
        default: "LocalAgents — Session sync for OpenCode and Claude Code",
        template: "%s · LocalAgents",
    },
    description:
        "Start a session on one PC and continue it on another. LocalAgents syncs OpenCode and Claude Code sessions between your machines, with an inbox for approvals on your phone.",
    applicationName: "LocalAgents",
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
        siteName: "LocalAgents",
        title: "LocalAgents — Session sync for OpenCode and Claude Code",
        description: "Start a session on one PC and continue it on another.",
        images: [
            {
                url: "/og/og.png",
                width: 1200,
                height: 630,
                alt: "LocalAgents — start on one PC, continue everywhere.",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "LocalAgents — Session sync for OpenCode and Claude Code",
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
