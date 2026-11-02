import { useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PRIVACY_POLICY, REFUND_POLICY, TERMS_OF_SERVICE } from "@/lib/legalContent";
import { setPageMeta } from "@/lib/meta";

export type LegalKind = "terms" | "privacy" | "refunds";

interface TocEntry {
    id: string;
    title: string;
}

// h2 제목을 앵커 id로 바꾸는 규칙. "1. Eligibility" -> "eligibility" 형태의 슬러그.
function slugifyHeading(title: string): string {
    return title
        .toLowerCase()
        .replace(/^\d+\.\s*/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

const LEGAL_META: Record<LegalKind, { title: string; subtitle: string; content: string }> = {
    terms: {
        title: "Terms of Service",
        subtitle: "The rules for using LocalAgents.",
        content: TERMS_OF_SERVICE,
    },
    privacy: {
        title: "Privacy Policy",
        subtitle: "What we collect, why, and who processes it.",
        content: PRIVACY_POLICY,
    },
    refunds: {
        title: "Refund Policy",
        subtitle: "Cancel anytime. Unused days refunded pro rata within 14 days.",
        content: REFUND_POLICY,
    },
};

const LAST_UPDATED = "October 27, 2026";

// 본문 렌더. h2에 앵커 id를 심고 외부 링크는 새 탭. 스타일은 세션 마크다운 문법(패널 톤)과 일치.
function LegalMarkdown({ content }: { content: string }) {
    return (
        <div className="text-sm [&_a]:text-go [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-2 [&_blockquote]:text-dim [&_code]:rounded [&_code]:bg-ink [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_h2]:mt-10 [&_h2]:scroll-mt-20 [&_h2]:text-base [&_h2]:font-bold [&_li]:my-1 [&_li]:leading-relaxed [&_p]:my-3 [&_p]:leading-relaxed [&_p]:text-fog [&_strong]:text-fog [&_ul]:list-disc [&_ul]:pl-5">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h2: ({ children }) => <h2 id={slugifyHeading(String(children))}>{children}</h2>,
                    a: ({ children, href }) =>
                        href && href.startsWith("/") ? (
                            <a href={href}>{children}</a>
                        ) : (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                                {children}
                            </a>
                        ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

export default function LegalPage({ kind }: { kind: LegalKind }) {
    const { content, title, subtitle } = LEGAL_META[kind];

    useEffect(() => {
        setPageMeta({ title, description: subtitle, path: `/legal/${kind}` });
    }, [kind, title, subtitle]);

    // 본문 h2에서 ToC 생성 (1장 인덱스).
    const toc = useMemo<TocEntry[]>(() => {
        const entries: TocEntry[] = [];
        for (const line of content.split("\n")) {
            const match = /^##\s+(.+)$/.exec(line.trim());
            if (match) {
                entries.push({ id: slugifyHeading(match[1].trim()), title: match[1].trim() });
            }
        }
        return entries;
    }, [content]);

    return (
        <main className="mx-auto max-w-5xl px-4 py-10">
            <header className="max-w-2xl">
                <p className="font-mono text-sm text-go">$ localagents legal</p>
                <h1 className="mt-3 text-2xl font-bold tracking-tight">{title}</h1>
                <p className="mt-2 text-sm text-dim">{subtitle}</p>
                <p className="mt-3 font-mono text-xs text-dim">Last updated: {LAST_UPDATED}</p>
            </header>

            <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_220px]">
                <article className="min-w-0">
                    <LegalMarkdown content={content} />
                </article>

                {toc.length > 1 && (
                    <aside className="hidden lg:block">
                        <nav aria-label="On this page" className="sticky top-20 border-l border-line pl-5">
                            <p className="mb-3 font-mono text-xs text-dim">On this page</p>
                            <ul className="space-y-2">
                                {toc.map((entry) => (
                                    <li key={entry.id}>
                                        <a
                                            href={`#${entry.id}`}
                                            className="block font-mono text-xs leading-snug text-dim transition-colors hover:text-fog"
                                        >
                                            {entry.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </aside>
                )}
            </div>

            <div className="mt-16 border-t border-line pt-6">
                <p className="font-mono text-xs text-dim">
                    Questions? <span className="text-fog">support@localagents.link</span>
                </p>
            </div>
        </main>
    );
}
