import type { Metadata } from "next";
import { authClient } from "@/lib/auth/client";
import { NeonAuthUIProvider, UserButton } from "@neondatabase/auth-ui";
import "./globals.css";

export const metadata: Metadata = {
    title: "cliagents",
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
                    <header>
                        <span>cliagents</span>
                        <UserButton size={"icon"} />
                    </header>
                    {children}
                </NeonAuthUIProvider>
            </body>
        </html>
    );
}
