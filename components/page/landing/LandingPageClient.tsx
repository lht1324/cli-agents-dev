"use client";

import Link from "next/link";
import FeaturesSection from "./features-section/FeaturesSection";

const WEB_STEPS = [
    {
        code: "$ npx localagents login",
        title: "Pair this PC",
        body: "One command. After this the daemon syncs on its own schedule.",
    },
    {
        code: "https://localagents.link/sessions",
        title: "Steer from your phone",
        body: "The inbox stays current by itself. Watch, send instructions, answer Allow / Deny.",
    },
] as const;

const PC_STEPS = [
    {
        code: "$ localagents push",
        title: "Push the tabs you pick",
        body: "Moving to another machine? Only the current session travels.",
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

type Step = {
    code: string;
    title: string;
    body: string;
};

function StepList({ steps }: { steps: readonly Step[] }) {
    return (
        <ol className="mt-4">
            {steps.map((step, i) => {
                const isCommand = step.code.startsWith("$ ");
                const protocolAt = isCommand ? -1 : step.code.indexOf("://");
                const protocol = protocolAt >= 0 ? step.code.slice(0, protocolAt + 3) : null;
                const code = isCommand ? step.code.slice(2) : protocol ? step.code.slice(protocol.length) : step.code;
                return (
                    <li key={step.title} className="border-t border-line py-6">
                        <div className="flex items-start gap-4">
                            <span className="pt-1.5 font-mono text-sm text-go">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="inline-flex items-center rounded border border-line bg-black px-3 py-1.5">
                                    <span className="font-mono text-xs">
                                        {isCommand ? <span className="text-go">$ </span> : null}
                                        {protocol ? <span className="text-dim">{protocol}</span> : null}
                                        <span className="text-fog">{code}</span>
                                    </span>
                                </div>
                                <h4 className="mt-3 font-bold">{step.title}</h4>
                                <p className="mt-1 max-w-[60ch] text-sm text-dim">{step.body}</p>
                            </div>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

export default function LandingPageClient() {
    return (
        <main>
            <section className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
                <div className="grid items-center gap-10 md:grid-cols-2">
                    <div>
                        <p className="font-mono text-sm text-go">$ localagents --help</p>
                        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
                            Start a session on one PC. Continue it on every PC.
                        </h1>
                        <p className="mt-4 max-w-[65ch] text-dim">
                            Your tabs follow you from desktop to laptop to phone. No SSH. No lost
                            sessions. Check in from anywhere.
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

            <FeaturesSection />

            <section id="how" className="scroll-mt-14 border-t border-line">
                <div className="mx-auto w-full max-w-6xl px-4 py-16">
                    <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
                    <div className="mt-8 grid gap-12 md:grid-cols-2">
                        <div>
                            <h3 className="text-lg font-bold">PC ↔ Phone</h3>
                            <p className="mt-1 text-sm text-dim">Just leave your PC on.</p>
                            <StepList steps={WEB_STEPS} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">PC ↔ PC</h3>
                            <p className="mt-1 text-sm text-dim">You drive, or ask your agent to.</p>
                            <StepList steps={PC_STEPS} />
                        </div>
                    </div>
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
