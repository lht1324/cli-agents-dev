import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "cliagents",
    description: "Mission control for your CLI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
