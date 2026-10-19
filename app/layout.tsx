import type { Metadata } from "next";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { NeonAuthUIProvider, UserButton } from "@neondatabase/auth-ui";
import "./globals.css";

export const metadata: Metadata = {
    title: "Local AI Agent Sync Service | localagents",
    description: "Session sync for your local AI agents. Start on one PC, finish on another. No SSH, nothing left behind.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <NeonAuthUIProvider
                    authClient={authClient}
                    social={{ providers: ["google", "github"] }}
                    credentials={false}
                    signUp={false}
                >
                    <header className="border-b border-line">
                        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
                            <nav className="flex items-center gap-5">
                                <Link href="/" className="font-mono font-bold">
                                    localagents
                                </Link>
                                <Link href="/sessions" className="text-sm text-dim hover:text-fog">
                                    Sessions
                                </Link>
                                <Link href="/devices" className="text-sm text-dim hover:text-fog">
                                    Devices
                                </Link>
                            </nav>
                            <UserButton size={"icon"} />
                        </div>
                    </header>
                    {children}
                </NeonAuthUIProvider>
            </body>
        </html>
    );
}
