import type { Metadata } from "next";
import { authClient } from "@/lib/auth/client";
import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import "./globals.css";

export const metadata: Metadata = {
    title: "Local AI Agent Sync Service | localagents",
    description: "Session sync for your local AI agents. Start on one PC, finish on another. No SSH, nothing left behind.",
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
