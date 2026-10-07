import type { Metadata } from "next";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { NeonAuthUIProvider, UserButton } from "@neondatabase/auth-ui";
import "./globals.css";

export const metadata: Metadata = {
    title: "agentgit",
    description: "Mission control for your CLI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <NeonAuthUIProvider
                    authClient={authClient}
                    social={{ providers: ["google", "github"] }}
                >
                    <header className="flex h-14 items-center justify-between border-b border-line px-4">
                        <nav className="flex items-center gap-5">
                            <Link href="/" className="font-mono font-bold">
                                agentgit
                            </Link>
                            <Link href="/sessions" className="text-sm text-dim hover:text-fog">
                                Sessions
                            </Link>
                            <Link href="/devices" className="text-sm text-dim hover:text-fog">
                                Devices
                            </Link>
                        </nav>
                        <UserButton size={"icon"} />
                    </header>
                    {children}
                </NeonAuthUIProvider>
            </body>
        </html>
    );
}
