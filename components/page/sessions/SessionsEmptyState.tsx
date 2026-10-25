"use client";

import { useCallback, useMemo, useState } from "react";

// 첫 탭이 오기 전의 인박스. 죽은 화면이 아니라 온보딩 출발점 — 지금 할 한 가지(설치+로그인)를 크게.
// 터미널 칩은 랜딩과 같은 문법 (bg-black + border-line, $ 초록).
const STEPS: { command: string | null; title: string; body: string }[] = [
    {
        command: "npx localagents@latest login",
        title: "Connect your PC",
        body: "One command. It installs the daemon, opens your browser to sign in, and starts syncing automatically.",
    },
    {
        command: null,
        title: "Keep working as usual",
        body: "Open tabs in OpenCode like you always do. Synced tabs appear here automatically.",
    },
];
const ALTERNATIVE_INSTALL = "Prefer a global install? npm i -g localagents, then run localagents login.";

export default function SessionsEmptyState() {
    const [copied, setCopied] = useState(false);

    const onClickCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(STEPS[0].command ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // 클립보드 거부 시 조용히 무시 — 명령어는 화면에 그대로 보인다.
        }
    }, []);

    return (
        <div className="rounded border border-line bg-panel p-8">
            <h2 className="font-mono text-lg font-bold">No sessions yet.</h2>
            <p className="mt-2 max-w-[60ch] text-sm text-dim">
                This inbox fills itself. Connect a PC and your OpenCode tabs start appearing here.
            </p>
            <ol className="mt-6 space-y-6">
                {STEPS.map((step, i) => (
                    <li key={step.title} className="flex items-start gap-4">
                        <span className="pt-1 font-mono text-sm text-go">{String(i + 1).padStart(2, "0")}</span>
                        <div className="min-w-0 flex-1">
                            {step.command ? (
                                <button
                                    type="button"
                                    onClick={onClickCopy}
                                    className="inline-flex items-center gap-3 rounded border border-line bg-black px-3 py-1.5 transition-colors hover:border-fog"
                                >
                                    <span className="font-mono text-xs">
                                        <span className="text-go">$ </span>
                                        <span className="text-fog">{step.command}</span>
                                    </span>
                                    <span className="font-mono text-[10px] text-dim">{copied ? "copied" : "copy"}</span>
                                </button>
                            ) : null}
                            <h4 className="mt-3 font-bold">{step.title}</h4>
                            <p className="mt-1 max-w-[60ch] text-sm text-dim">{step.body}</p>
                        </div>
                    </li>
                ))}
            </ol>
            <p className="mt-6 font-mono text-xs text-dim">{ALTERNATIVE_INSTALL}</p>
        </div>
    );
}
