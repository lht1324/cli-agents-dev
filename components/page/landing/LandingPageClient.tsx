"use client";

import Link from "next/link";

const STEPS = [
    {
        code: "$ npx agentgit login",
        title: "Install the daemon",
        body: "One resident daemon per PC. It finds your OpenCode server and attaches. Nothing to configure.",
    },
    {
        code: "$ agentgit register",
        title: "Pair the device",
        body: "Your PC appears in the device list with live presence. Rename it anything you like.",
    },
    {
        code: "Allow / Deny",
        title: "Approve from anywhere",
        body: "Permission prompts land in your inbox. Answer from your phone while the PC keeps working.",
    },
] as const;

export default function LandingPageClient() {
    return (
        <main className="mx-auto max-w-3xl px-4 py-16">
            <p className="font-mono text-sm text-go">$ agentgit --help</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
                Mission control for your CLI agents.
            </h1>
            <p className="mt-4 text-dim">
                Tabs live on your PCs. agentgit keeps them in sync, so a session started on your
                desktop is waiting on your laptop — and approvable from your phone.
            </p>
            <div className="mt-6 flex gap-3">
                <Link
                    href="/auth/sign-in"
                    className="rounded bg-go px-4 py-2 font-mono text-sm font-bold text-ink"
                >
                    Get started
                </Link>
                <Link
                    href="/sessions"
                    className="rounded border border-line px-4 py-2 font-mono text-sm text-fog"
                >
                    Open inbox
                </Link>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
                {STEPS.map((step) => (
                    <section key={step.title} className="rounded border border-line bg-panel p-4">
                        <p className="rounded bg-ink px-2 py-1 font-mono text-xs text-go">{step.code}</p>
                        <h2 className="mt-3 font-bold">{step.title}</h2>
                        <p className="mt-1 text-sm text-dim">{step.body}</p>
                    </section>
                ))}
            </div>
            <p className="mt-12 font-mono text-xs text-dim">
                $ sync: periodic + manual · $ approve: allow | deny · $ status: online | stale | offline
            </p>
        </main>
    );
}
