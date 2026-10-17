"use client";

import Link from "next/link";

const STEPS = [
    {
        code: "$ npx localagents login",
        title: "Pair this PC",
        body: "One command. The daemon finds your OpenCode server and attaches. Nothing to configure.",
    },
    {
        code: "$ localagents push",
        title: "Share the tabs you pick",
        body: "Push on demand, or let the schedule sync for you. Only the current session travels.",
    },
    {
        code: "Allow / Deny",
        title: "Approve from anywhere",
        body: "Permission prompts land in your inbox. Answer from your phone while the PC keeps working.",
    },
    {
        code: "$ localagents pull",
        title: "Continue on another PC",
        body: "Pick a tab from the list. It lands as a real session, ready to continue.",
    },
] as const;

const TRANSCRIPT = [
    { text: "$ localagents push", tone: "prompt" },
    { text: "  TailoredAd (AI +12 · User +3)  [####################] 100%", tone: "out" },
    { text: "  Done: 1 tab pushed.", tone: "out" },
    { text: "", tone: "out" },
    { text: "# on your phone, in the inbox:", tone: "dim" },
    { text: "#   bash  npm run build        [Allow]  [Deny]", tone: "dim" },
    { text: "", tone: "out" },
    { text: "$ localagents pull", tone: "prompt" },
    { text: "  Updated local tab TailoredAd.", tone: "out" },
    { text: "  Done: 106 messages applied.", tone: "out" },
] as const;

export default function LandingPageClient() {
    return (
        <main className="mx-auto max-w-3xl px-4 py-16">
            <p className="font-mono text-sm text-go">$ localagents --help</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
                Mission control for your CLI agents.
            </h1>
            <p className="mt-4 text-dim">
                Your tabs follow you from desktop to laptop to phone. No SSH. No lost sessions.
                Approvals answerable from anywhere.
            </p>
            <div className="mt-6 flex gap-3">
                <Link
                    href="/auth/sign-in"
                    className="rounded bg-go px-4 py-2 font-mono text-sm font-bold text-ink"
                >
                    Get started
                </Link>
                <Link
                    href="#how"
                    className="rounded border border-line px-4 py-2 font-mono text-sm text-fog"
                >
                    See how it works
                </Link>
            </div>

            <section aria-label="Supported agents" className="mt-14 flex items-center gap-3">
                <p className="text-sm text-dim">Works with</p>
                <img
                    src="https://cdn.simpleicons.org/opencode/9ca3af"
                    alt="OpenCode"
                    width={20}
                    height={20}
                    className="h-5 w-5"
                />
                <img
                    src="https://cdn.simpleicons.org/claude/9ca3af"
                    alt="Claude Code"
                    width={20}
                    height={20}
                    className="h-5 w-5"
                />
            </section>

            <section id="how" className="mt-14 scroll-mt-8">
                <h2 className="text-xl font-bold tracking-tight">How it works</h2>
                <ol className="mt-4 divide-y divide-line border-y border-line">
                    {STEPS.map((step, i) => (
                        <li key={step.title} className="flex gap-4 py-5">
                            <span className="pt-1 font-mono text-xs text-go">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <div>
                                <p className="font-mono text-xs text-fog">{step.code}</p>
                                <h3 className="mt-1 font-bold">{step.title}</h3>
                                <p className="mt-1 text-sm text-dim">{step.body}</p>
                            </div>
                        </li>
                    ))}
                </ol>
                <div className="mt-6 rounded border border-line bg-ink p-4">
                    <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
                        {TRANSCRIPT.map((line, i) => (
                            <span
                                key={i}
                                className={
                                    line.tone === "prompt"
                                        ? "block text-go"
                                        : line.tone === "dim"
                                          ? "block text-dim"
                                          : "block text-fog"
                                }
                            >
                                {line.text || "\u00A0"}
                            </span>
                        ))}
                    </pre>
                </div>
            </section>

            <section className="mt-16 border-t border-line pt-10">
                <h2 className="text-2xl font-bold tracking-tight">
                    Start on your desktop. Finish anywhere.
                </h2>
                <p className="mt-2 text-dim">One daemon per PC. One inbox for approvals.</p>
                <Link
                    href="/auth/sign-in"
                    className="mt-5 inline-block rounded bg-go px-4 py-2 font-mono text-sm font-bold text-ink"
                >
                    Get started
                </Link>
            </section>

            <p className="mt-12 font-mono text-xs text-dim">
                $ sync: periodic + manual · $ approve: allow | deny · $ status: online | stale | offline
            </p>
        </main>
    );
}
