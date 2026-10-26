"use client";

import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";

// 링크 공유 카드. 랜딩 토큰을 그대로 써서 OG가 랜딩의 연장으로 보이게 한다.
// 카드 축소(400px 남짓)에서도 읽혀야 하므로 텍스트는 3덩어리만 둔다: 워드마크·헤드라인·도메인.
const TERMINAL_LINES = [
    { text: "$ localagents push", tone: "prompt" },
    { text: "  Done: 1 tab pushed.", tone: "out" },
    { text: "", tone: "out" },
    { text: "$ localagents pull", tone: "prompt" },
    { text: "  106 messages applied.", tone: "out" },
] as const;

function OgCard({ innerRef }: { innerRef: React.Ref<HTMLDivElement> }) {
    return (
        <div
            ref={innerRef}
            style={{ width: 1200, height: 630 }}
            className="relative overflow-hidden bg-ink text-fog"
        >
            <div className="absolute left-14 top-12 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/logo.svg" alt="" width={44} height={44} />
                <span className="font-mono text-[24px] font-bold tracking-tight">localagents</span>
            </div>

            <h1 className="absolute left-14 top-[186px] w-[700px] text-[58px] font-bold leading-[1.08] tracking-tight">
                Start on one PC.
                <br />
                Continue everywhere.
            </h1>

            <p className="absolute left-14 top-[424px] font-mono text-[19px] text-dim">
                Session sync for OpenCode and Claude Code
            </p>

            <div className="absolute right-12 top-[168px] w-[380px] rounded border border-line bg-panel px-6 py-5">
                <pre className="font-mono text-[17px] leading-[1.65]">
                    {TERMINAL_LINES.map((line, i) => (
                        <span
                            key={i}
                            className={
                                line.tone === "prompt"
                                    ? "block text-go"
                                    : "block text-fog"
                            }
                        >
                            {line.text || "\u00A0"}
                        </span>
                    ))}
                </pre>
            </div>

            <p className="absolute bottom-12 left-14 font-mono text-[15px] uppercase tracking-[0.22em] text-dim">
                localagents.link
            </p>
        </div>
    );
}

export default function OgCardPageClient() {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isBusy, setIsBusy] = useState(false);

    const onClickDownload = useCallback(async () => {
        const node = cardRef.current;
        if (!node || isBusy) return;
        setIsBusy(true);
        try {
            // 캡처 직전 준비 게이트 — 폰트·이미지 디코드·레이아웃 2프레임.
            await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 5000))]);
            await Promise.all(
                Array.from(node.querySelectorAll("img")).map((img) => img.decode().catch(() => {})),
            );
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            // backgroundColor 옵션은 넣지 않는다 — 캡처 루트 배경을 그 값으로 덮어써 카드 색이 바뀐다 (tailored-ad 실측).
            // pixelRatio 2 → 실제 파일은 2400×1260. 메타에는 1200×630으로 선언한다.
            const dataUrl = await toPng(node, { pixelRatio: 2 });
            const blob = await (await fetch(dataUrl)).blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "og.png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (error) {
            console.error("[dev/og] capture failed:", error);
        } finally {
            setIsBusy(false);
        }
    }, [isBusy]);

    return (
        <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">OG card — 1200×630</h1>
                <p className="text-sm text-dim">
                    Download and save as <span className="font-mono text-fog">public/og/og.png</span>. Export is
                    2× (2400×1260), declared as 1200×630.
                </p>
            </header>

            <div>
                <button
                    type="button"
                    onClick={onClickDownload}
                    disabled={isBusy}
                    className="rounded bg-go px-5 py-2.5 font-mono text-sm font-bold text-ink disabled:cursor-wait disabled:opacity-60"
                >
                    {isBusy ? "Rendering…" : "Download og.png"}
                </button>
            </div>

            <div className="overflow-x-auto">
                <OgCard innerRef={cardRef} />
            </div>
        </main>
    );
}
