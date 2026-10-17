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
        <main>
            <section className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
                <div className="grid items-center gap-10 md:grid-cols-2">
                    <div>
                        <p className="font-mono text-sm text-go">$ localagents --help</p>
                        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
                            Mission control for your CLI agents.
                        </h1>
                        <p className="mt-4 max-w-[65ch] text-dim">
                            Your tabs follow you from desktop to laptop to phone. No SSH. No lost
                            sessions. Approvals answerable from anywhere.
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
                        <div className="mt-10 flex items-center gap-3" aria-label="Supported agents">
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
                        </div>
                    </div>
                    <div className="rounded border border-line bg-ink p-4">
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
                </div>
            </section>

            <section id="how" className="scroll-mt-14 border-t border-line">
                <div className="mx-auto w-full max-w-6xl px-4 py-16">
                    <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
                    <ol className="mt-8 grid gap-x-12 md:grid-cols-2">
                        {STEPS.map((step, i) => (
                            <li key={step.title} className="border-t border-line py-6">
                                <div className="flex items-baseline gap-4">
                                    <span className="font-mono text-sm text-go">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <p className="font-mono text-xs text-fog">{step.code}</p>
                                </div>
                                <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
                                <p className="mt-1 max-w-[60ch] text-sm text-dim">{step.body}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="border-t border-line">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">
                            Start on your desktop. Finish anywhere.
                        </h2>
                        <p className="mt-2 text-dim">One daemon per PC. One inbox for approvals.</p>
                    </div>
                    <Link
                        href="/auth/sign-in"
                        className="inline-block shrink-0 rounded bg-go px-5 py-2.5 font-mono text-sm font-bold text-ink"
                    >
                        Get started
                    </Link>
                </div>
            </section>

            <section className="border-t border-line">
                <div className="mx-auto w-full max-w-6xl px-4 py-5">
                    <p className="font-mono text-xs text-dim">
                        $ sync: periodic + manual · $ approve: allow | deny · $ status: online | stale | offline
                    </p>
                </div>
            </section>
        </main>
    );
}
