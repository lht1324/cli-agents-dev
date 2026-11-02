import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import MarkdownText from "@/components/MarkdownText";
import { editCounts, parseToolCall, toolDetail, toolSummary, type ToolCall } from "@/lib/toolFormat";
import { getJson } from "@/lib/api";

interface Info {
    id: string;
    title: string;
    status: string;
    deviceId: string;
    agent: string | null;
    model: string | null;
    lastSyncAt: string | null;
    deviceLastSeenAt: string | null;
    parentId: string | null;
    readOnly: boolean;
}

interface SubagentRow {
    id: string;
    title: string;
    synced: boolean;
}

interface Approval {
    id: string;
    deviceId: string;
    action: string;
    resources: string;
    message: string | null;
}

interface Msg {
    id: string;
    seq: number;
    role: string;
    kind: string;
    body: string;
    createdAt: string | null;
}

interface Target {
    deviceId: string;
    label: string;
    lastSeenAt: string | null;
    active: boolean;
}

interface Stats {
    cost: number | null;
    input: number | null;
    output: number | null;
    reasoning: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    msgUser: number | null;
    msgAssistant: number | null;
    createdAt: string | null;
}

interface Detail {
    info: Info;
    approvals: Approval[];
    messages: Msg[];
    stats: Stats;
    targets: Target[];
    defaultTarget: string | null;
    catalogJson: string | null;
    subagents: SubagentRow[];
}

interface ThreadPayload {
    messages: Msg[];
    deviceLastSeenAt: string | null;
    lastSyncAt: string | null;
    lastCommand: { type: string; status: string; result: string | null; createdAt: string | null } | null;
}

function stamp(iso: string | null): string | null {
    if (!iso) {
        return null;
    }
    return new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

function num(v: number | null): string {
    return v === null ? "-" : v.toLocaleString("en-US");
}

// OpenCode GUI와 같은 표기: variant/agent id의 첫 글자만 대문자.
function labelOf(id: string): string {
    return id.length === 0 ? id : id.charAt(0).toUpperCase() + id.slice(1);
}

// 명령 실행 결과는 { ok, data } JSON으로 저장된다. 화면에는 사람이 읽을 문장만 보여준다.
function describeCommandResult(raw: string | null): string {
    if (!raw) {
        return "";
    }
    try {
        const parsed = JSON.parse(raw) as { ok?: unknown; data?: unknown; error?: unknown; message?: unknown };
        if (typeof parsed.error === "string" && parsed.error.length > 0) {
            return parsed.error;
        }
        if (typeof parsed.data === "string" && parsed.data.length > 0) {
            return parsed.data;
        }
        if (typeof parsed.message === "string" && parsed.message.length > 0) {
            return parsed.message;
        }
        if (parsed.ok === true) {
            return "done";
        }
    } catch {
        // JSON이 아니면 원문 그대로
    }
    return raw;
}

interface CatalogModel {
    id: string;
    providerID: string;
    name?: string;
    variants?: { id: string }[];
    limit?: { context?: number };
}

interface CatalogAgent {
    id?: string;
    name?: string;
    mode?: string;
    hidden?: boolean;
}

interface CatalogProvider {
    id?: string;
    name?: string;
}

function parseCatalog(json: string | null): { models: CatalogModel[]; agents: CatalogAgent[]; providers: CatalogProvider[] } {
    if (!json) {
        return { models: [], agents: [], providers: [] };
    }
    try {
        const parsed = JSON.parse(json) as {
            models?: { data?: CatalogModel[] } | CatalogModel[];
            agents?: { data?: CatalogAgent[] } | CatalogAgent[];
            providers?: { data?: CatalogProvider[] } | CatalogProvider[];
        };
        const models = Array.isArray(parsed.models) ? parsed.models : (parsed.models?.data ?? []);
        const agents = (Array.isArray(parsed.agents) ? parsed.agents : (parsed.agents?.data ?? [])).filter(
            (a) => a.mode === "primary" && a.hidden !== true,
        );
        const providers = Array.isArray(parsed.providers) ? parsed.providers : (parsed.providers?.data ?? []);
        return { models, agents, providers };
    } catch {
        return { models: [], agents: [], providers: [] };
    }
}

function parseCurrentModel(json: string | null): { id: string; providerID: string; variant?: string } | null {
    if (!json) {
        return null;
    }
    try {
        const parsed = JSON.parse(json) as { id?: unknown; providerID?: unknown; variant?: unknown };
        if (typeof parsed.id !== "string" || typeof parsed.providerID !== "string") {
            return null;
        }
        return {
            id: parsed.id,
            providerID: parsed.providerID,
            variant: typeof parsed.variant === "string" ? parsed.variant : undefined,
        };
    } catch {
        return null;
    }
}

// 도구 호출 1건. 접힘 줄에 요약과 +/− 줄 수를, 펼침에 상세를 보여준다.
function ToolRow({ call, at }: { call: ToolCall; at: string | null }) {
    const detailLines = toolDetail(call);
    const counts = editCounts(call);
    const summary = toolSummary(call);
    const stampText = stamp(at);

    if (call.truncated) {
        return (
            <div>
                <p className="rounded border border-line bg-ink px-3 py-2 font-mono text-xs text-dim">
                    ▸ {summary}
                    {counts && (
                        <>
                            {" "}
                            <span className="text-go">+{counts.added}</span>/
                            <span className="text-stop">-{counts.removed}</span>
                            <span className="text-dim"> (diff omitted, too long)</span>
                        </>
                    )}
                </p>
                {stampText && <p className="mt-1 font-mono text-[10px] text-dim">{stampText}</p>}
            </div>
        );
    }

    return (
        <div>
            <details className="rounded border border-line bg-ink px-3 py-2">
                <summary className="cursor-pointer break-words font-mono text-xs text-dim">
                    ▸ {summary}
                    {counts && (
                        <>
                            {" "}
                            <span className={counts.added === 0 ? "text-fog" : "text-go"}>+{counts.added}</span>/
                            <span className={counts.removed === 0 ? "text-fog" : "text-stop"}>-{counts.removed}</span>
                        </>
                    )}
                </summary>
                <div className="mt-1 space-y-1">
                    {detailLines.map((line, i) => (
                        <p
                            key={i}
                            className={`whitespace-pre-wrap font-mono text-xs ${
                                call.tool === "edit" && line.startsWith("+ ")
                                    ? "text-go"
                                    : call.tool === "edit" && line.startsWith("- ")
                                      ? "text-stop"
                                      : "text-dim"
                            }`}
                        >
                            {line}
                        </p>
                    ))}
                    {stampText && <p className="font-mono text-[10px] text-dim">{stampText}</p>}
                </div>
            </details>
        </div>
    );
}

interface StatsViewProps {
    stats: Stats;
    modelName: string;
    provider: string;
    contextLimit: number | null;
    total: number | null;
    usagePct: number | null;
}

// 세션 = 컨텍스트 사용량 구간. 그래서 %를 맨 위에 둔다.
function SessionStatsView({ stats, modelName, provider, contextLimit, total, usagePct }: StatsViewProps) {
    const groups: { title: string; rows: [string, string][] }[] = [
        {
            title: "Tokens",
            rows: [
                ["Input", num(stats.input)],
                ["Output", num(stats.output)],
                ["Reasoning", num(stats.reasoning)],
                ["Cache read / write", `${num(stats.cacheRead)} / ${num(stats.cacheWrite)}`],
            ],
        },
        {
            title: "Messages",
            rows: [
                ["Total", num((stats.msgUser ?? 0) + (stats.msgAssistant ?? 0))],
                ["User", num(stats.msgUser)],
                ["Assistant", num(stats.msgAssistant)],
            ],
        },
        {
            title: "Session",
            rows: [
                ["Provider", provider],
                ["Model", modelName],
                ["Created", stats.createdAt ? new Date(stats.createdAt).toLocaleString() : "-"],
                ["Cost", stats.cost === null ? "-" : `$${stats.cost.toFixed(2)}`],
            ],
        },
    ];
    return (
        <div className="mt-2">
            <p className="text-lg font-bold text-fog">
                {usagePct === null ? "-" : `${usagePct}%`}
                <span className="ml-2 font-mono text-xs font-normal text-dim">
                    {num(total)} / {num(contextLimit)} tokens
                </span>
            </p>
            <div
                className="mt-1 h-1.5 w-full overflow-hidden rounded bg-panel"
                role="progressbar"
                aria-valuenow={usagePct ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div className="h-full rounded bg-go" style={{ width: `${Math.min(100, usagePct ?? 0)}%` }} />
            </div>
            <div className="mt-3 space-y-2">
                {groups.map((group) => (
                    <div key={group.title} className="rounded border border-line bg-ink px-3 py-2">
                        <p className="font-mono text-xs font-bold text-dim">{group.title}</p>
                        <dl className="mt-1 space-y-1">
                            {group.rows.map(([label, value]) => (
                                <div key={label} className="flex items-baseline justify-between gap-2">
                                    <dt className="shrink-0 font-mono text-xs text-dim">{label}</dt>
                                    <dd className="break-words text-right font-mono text-xs text-fog">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function SessionDetailPage() {
    const { id = "", childId } = useParams();
    // 경로가 /sessions/:parent/:child면 자식 세션을 읽기 전용으로 연다.
    const sessionId = childId ?? id;
    const readOnly = Boolean(childId);
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState("");
    const [target, setTarget] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const detail = useQuery({
        queryKey: ["session", sessionId],
        queryFn: () => getJson<Detail>(`/api/web/sessions/${encodeURIComponent(sessionId)}`),
        enabled: sessionId.length > 0,
    });

    const thread = useQuery({
        queryKey: ["thread", sessionId],
        queryFn: () => getJson<ThreadPayload>(`/api/web/messages?tabId=${encodeURIComponent(sessionId)}`),
        enabled: sessionId.length > 0,
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
    });

    const messages = thread.data?.messages ?? detail.data?.messages ?? [];
    const effectiveTarget = target ?? detail.data?.defaultTarget ?? null;
    const canWrite = !readOnly && effectiveTarget !== null;
    const lastCommand = thread.data?.lastCommand ?? null;

    const catalog = useMemo(() => parseCatalog(detail.data?.catalogJson ?? null), [detail.data?.catalogJson]);
    const currentModel = useMemo(() => parseCurrentModel(detail.data?.info.model ?? null), [detail.data?.info.model]);
    const [agent, setAgent] = useState("");
    const [modelId, setModelId] = useState("");
    const [variant, setVariant] = useState("");

    // 상세를 처음 받았을 때 현재 에이전트·모델·variant를 선택 상태로 맞춘다.
    // 카탈로그에 없는 값(내려간 모델)은 미지정으로 본다 — 없는 값을 선택된 것처럼 보이면 거짓 표시가 된다.
    useEffect(() => {
        const info = detail.data?.info;
        if (!info) {
            return;
        }
        setAgent(info.agent ?? "");
        const key = currentModel ? `${currentModel.providerID}/${currentModel.id}` : "";
        const known = catalog.models.some((m) => `${m.providerID}/${m.id}` === key);
        setModelId(known ? key : "");
        // OpenCode API는 variant를 안 고른 세션에도 variant:"default"를 붙여서 돌려준다.
        // 로컬 DB에는 variant 필드가 아예 없다. 즉 "default" = 미지정이다.
        // 카탈로그 목록에 없는 값(xhigh 등)도 실제로 쓰이므로 그대로 선택지에 넣는다.
        setVariant(currentModel?.variant && currentModel.variant !== "default" ? currentModel.variant : "");
    }, [detail.data?.info.id, currentModel, catalog]);

    const providers = useMemo(() => {
        const groups = new Map<string, CatalogModel[]>();
        const sorted = [...catalog.models].sort(
            (a, b) => a.providerID.localeCompare(b.providerID) || (a.name ?? a.id).localeCompare(b.name ?? b.id),
        );
        for (const m of sorted) {
            const list = groups.get(m.providerID) ?? [];
            list.push(m);
            groups.set(m.providerID, list);
        }
        return [...groups.entries()];
    }, [catalog]);

    // 모델 id에 "/"가 들어갈 수 있다(예: deepseek/deepseek-v4.1). 값은 "providerID/id" 문자열로
    // 다루되, 해석은 split이 아니라 카탈로그에서 같은 키를 찾아서 한다.
    const modelByKey = useMemo(
        () => new Map(catalog.models.map((m) => [`${m.providerID}/${m.id}`, m])),
        [catalog],
    );
    const variants = useMemo(() => modelByKey.get(modelId)?.variants ?? [], [modelByKey, modelId]);
    // 카탈로그 목록에 없더라도 이 세션이 실제로 쓰는 variant는 보여준다 (예: xhigh).
    const variantOptions = useMemo(() => {
        const ids = variants.map((v) => v.id);
        const current = currentModel?.variant;
        if (current && current !== "default" && !ids.includes(current)) {
            ids.push(current);
        }
        return ids;
    }, [variants, currentModel]);

    const [showJump, setShowJump] = useState(false);
    const scrollToEnd = useCallback(() => {
        const el = scrollRef.current;
        if (el) {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
    }, []);
    const onScrollThread = useCallback(() => {
        const el = scrollRef.current;
        if (el) {
            setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 400);
        }
    }, []);
    useEffect(() => {
        const el = scrollRef.current;
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages.length]);

    const queue = useCallback(
        async (deviceId: string, type: string, payload: unknown) => {
            setBusy(true);
            setNotice(null);
            try {
                const res = await fetch("/api/web/commands", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deviceId, type, payload: JSON.stringify(payload) }),
                });
                const body = (await res.json()) as { success: boolean; error?: string };
                if (!res.ok || !body.success) {
                    setNotice(`failed: ${body.error ?? res.status}`);
                    return false;
                }
                void queryClient.invalidateQueries({ queryKey: ["thread", sessionId] });
                return true;
            } finally {
                setBusy(false);
            }
        },
        [sessionId, queryClient],
    );

    const onClickSend = useCallback(async () => {
        const text = draft.trim();
        if (text.length === 0 || !effectiveTarget) {
            return;
        }
        const ok = await queue(effectiveTarget, "message", { sessionID: sessionId, text });
        if (ok) {
            setDraft("");
            setNotice("message queued");
        }
    }, [draft, effectiveTarget, sessionId, queue]);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onClickSend();
            }
        },
        [onClickSend],
    );

    const onClickDecide = useCallback(
        async (row: Approval, decision: "once" | "reject") => {
            const ok = await queue(row.deviceId, "approve", { sessionID: sessionId, requestID: row.id, decision });
            if (ok) {
                setNotice(`${row.id} -> ${decision} queued`);
            }
        },
        [sessionId, queue],
    );

    // 모델·에이전트 변경은 명령으로 나간다 (데몬이 OpenCode에 적용).
    const onClickAgent = useCallback(
        async (e: React.ChangeEvent<HTMLSelectElement>) => {
            const value = e.target.value;
            setAgent(value);
            if (value.length === 0 || !effectiveTarget) {
                return;
            }
            const ok = await queue(effectiveTarget, "set-agent", { sessionID: sessionId, agent: value });
            if (ok) {
                setNotice(`agent -> ${value} queued`);
            }
        },
        [effectiveTarget, sessionId, queue],
    );

    const onClickModel = useCallback(
        async (e: React.ChangeEvent<HTMLSelectElement>) => {
            const value = e.target.value;
            setModelId(value);
            setVariant("");
            const found = modelByKey.get(value);
            if (!found || !effectiveTarget) {
                return;
            }
            const ok = await queue(effectiveTarget, "set-model", {
                sessionID: sessionId,
                model: { id: found.id, providerID: found.providerID },
            });
            if (ok) {
                setNotice(`model -> ${value} queued`);
            }
        },
        [effectiveTarget, modelByKey, sessionId, queue],
    );

    const onClickVariant = useCallback(
        async (e: React.ChangeEvent<HTMLSelectElement>) => {
            const value = e.target.value;
            setVariant(value);
            const found = modelByKey.get(modelId);
            if (!found || !effectiveTarget) {
                return;
            }
            const ok = await queue(effectiveTarget, "set-model", {
                sessionID: sessionId,
                model: { id: found.id, providerID: found.providerID, variant: value || undefined },
            });
            if (ok) {
                setNotice(`variant -> ${value || "(none)"} queued`);
            }
        },
        [effectiveTarget, modelByKey, modelId, sessionId, queue],
    );

    const stats = detail.data?.stats;
    const modelInfo = useMemo(() => {
        const found = currentModel
            ? catalog.models.find((m) => m.providerID === currentModel.providerID && m.id === currentModel.id)
            : undefined;
        const provider =
            catalog.providers.find((p) => p.id === currentModel?.providerID)?.name ??
            currentModel?.providerID ??
            "?";
        return {
            name: found?.name ?? currentModel?.id ?? "(none)",
            provider,
            contextLimit: found?.limit?.context ?? null,
        };
    }, [catalog, currentModel]);
    const totalTokens = useMemo(() => {
        if (!stats) {
            return null;
        }
        const parts = [stats.input, stats.output, stats.reasoning, stats.cacheRead, stats.cacheWrite];
        if (parts.every((p) => p === null)) {
            return null;
        }
        return parts.reduce<number>((sum, p) => sum + (p ?? 0), 0);
    }, [stats]);
    const usagePct = useMemo(() => {
        if (totalTokens === null || !modelInfo.contextLimit) {
            return null;
        }
        return Math.round((totalTokens / modelInfo.contextLimit) * 100);
    }, [totalTokens, modelInfo.contextLimit]);

    if (detail.isLoading) {
        return <main className="px-6 py-10 font-mono text-xs text-dim">loading…</main>;
    }
    if (detail.error) {
        return <main className="px-6 py-10 font-mono text-xs text-stop">{detail.error.message}</main>;
    }
    const info = detail.data!.info;

    return (
        <main className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-6xl gap-4 px-4 py-4">
            <section className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-baseline justify-between">
                    <div className="flex min-w-0 items-baseline gap-2">
                        {readOnly && (
                            <Link to={`/sessions/${encodeURIComponent(id)}`} className="shrink-0 font-mono text-xs text-dim hover:text-fog">
                                ← parent
                            </Link>
                        )}
                        <h1 className="truncate text-lg font-bold">{info.title}</h1>
                    </div>
                    <span className="ml-3 shrink-0 font-mono text-xs text-dim">{info.status}</span>
                </div>
                {readOnly && (
                    <p className="mt-1 font-mono text-[11px] text-warn">
                        Subagent session · read only. Open the parent to send instructions.
                    </p>
                )}

                <div
                    ref={scrollRef}
                    onScroll={onScrollThread}
                    className="scroll-slim mt-3 min-h-0 flex-1 overflow-y-auto pr-2"
                >
                    {messages.length === 0 && <p className="text-sm text-dim">No synced messages yet.</p>}
                    <ul className="space-y-2">
                        {messages.map((m) => {
                            if (m.kind === "tool") {
                                const call = parseToolCall(m.body);
                                if (!call) {
                                    return (
                                        <li key={`${m.id}-${m.seq}`} className="max-w-3xl">
                                            <p className="whitespace-pre-wrap font-mono text-xs text-dim">{m.body}</p>
                                        </li>
                                    );
                                }
                                return (
                                    <li key={`${m.id}-${m.seq}`} className="max-w-3xl">
                                        <ToolRow call={call} at={m.createdAt} />
                                    </li>
                                );
                            }
                            if (m.kind === "compaction" || m.kind === "summary") {
                                return (
                                    <li key={`${m.id}-${m.seq}`} className="border-l-2 border-warn pl-3">
                                        <details>
                                            <summary className="cursor-pointer font-mono text-xs text-dim">
                                                Session compacted. Show summary.
                                            </summary>
                                            <p className="mt-1 whitespace-pre-wrap text-sm text-dim">{m.body}</p>
                                        </details>
                                    </li>
                                );
                            }
                            return (
                                <li
                                    key={`${m.id}-${m.seq}`}
                                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                                >
                                    <div className="max-w-[85%] lg:max-w-3xl">
                                        <div
                                            className={
                                                m.role === "user"
                                                    ? "rounded-lg bg-panel px-3 py-2 text-sm whitespace-pre-wrap"
                                                    : "rounded-lg border border-line bg-panel px-3 py-2"
                                            }
                                        >
                                            {m.role === "user" ? m.body : <MarkdownText body={m.body} />}
                                        </div>
                                        <p className="mt-1 font-mono text-[10px] text-dim">{stamp(m.createdAt)}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {showJump && (
                    <button
                        type="button"
                        onClick={scrollToEnd}
                        aria-label="Scroll to bottom"
                        className="fixed bottom-44 left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 font-mono text-lg text-fog lg:left-[35%]"
                    >
                        ↓
                    </button>
                )}

                {!readOnly && (
                    <div className="shrink-0 border-t border-line pt-3">
                        {notice && <p className="font-mono text-xs text-go">{notice}</p>}
                        {!canWrite && (
                            <p className="font-mono text-xs text-warn">No active device. Turn the PC on to send instructions.</p>
                        )}
                        {lastCommand && (
                            <p className="font-mono text-xs text-dim">
                                last {lastCommand.type}: {lastCommand.status}
                                {lastCommand.result ? ` · ${describeCommandResult(lastCommand.result).slice(0, 120)}` : ""}
                            </p>
                        )}
                        <div className="mt-2 rounded border border-line bg-panel p-3">
                            {(detail.data?.targets.length ?? 0) > 0 && (
                                <div className="mb-2 flex items-center gap-2">
                                    <label htmlFor="target" className="font-mono text-xs text-dim">
                                        Send to
                                    </label>
                                    <select
                                        id="target"
                                        value={effectiveTarget ?? ""}
                                        onChange={(e) => setTarget(e.target.value)}
                                        disabled={busy}
                                        className="rounded border border-line bg-ink p-1 font-mono text-xs"
                                    >
                                        {detail.data?.targets.map((t) => (
                                            <option key={t.deviceId} value={t.deviceId}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={onKeyDown}
                                rows={2}
                                disabled={!canWrite || busy}
                                placeholder={canWrite ? "Type a message... (Enter to send)" : "No active device"}
                                className="w-full resize-none bg-transparent font-mono text-sm outline-none placeholder:text-dim disabled:opacity-50"
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                {catalog.models.length === 0 && catalog.agents.length === 0 ? (
                                    <p className="font-mono text-xs text-dim">
                                        No catalog yet. Run `localagents sync-models` on the PC.
                                    </p>
                                ) : (
                                    <>
                                        <select
                                            value={agent}
                                            onChange={(e) => void onClickAgent(e)}
                                            disabled={busy || !canWrite}
                                            aria-label="Agent"
                                            title={agent || "Agent"}
                                            className="max-w-40 rounded border border-line bg-ink p-1.5 font-mono text-xs disabled:opacity-50"
                                        >
                                            {agent.length === 0 && <option value="">Agent…</option>}
                                            {catalog.agents.map((a, i) => (
                                                <option key={a.id ?? i} value={a.id ?? ""}>
                                                    {a.name ?? labelOf(a.id ?? "")}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={modelId}
                                            onChange={(e) => void onClickModel(e)}
                                            disabled={busy || !canWrite}
                                            aria-label="Model"
                                            title={modelId || "Model"}
                                            className="max-w-[20rem] rounded border border-line bg-ink p-1.5 font-mono text-xs disabled:opacity-50"
                                        >
                                            <option value="" disabled>
                                                (none)
                                            </option>
                                            {providers.map(([providerID, models]) => (
                                                <optgroup key={providerID} label={providerID}>
                                                    {models.map((m) => (
                                                        <option key={`${m.providerID}/${m.id}`} value={`${m.providerID}/${m.id}`}>
                                                            {m.name ?? m.id}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <select
                                            value={variant}
                                            onChange={(e) => void onClickVariant(e)}
                                            disabled={busy || !canWrite || modelId.length === 0}
                                            aria-label="Variant"
                                            title={variant ? labelOf(variant) : "Default"}
                                            className="max-w-40 rounded border border-line bg-ink p-1.5 font-mono text-xs disabled:opacity-50"
                                        >
                                            <option value="">Default</option>
                                            {variantOptions.map((id) => (
                                                <option key={id} value={id}>
                                                    {labelOf(id)}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                )}
                                <div className="flex-1" />
                                <button
                                    type="button"
                                    onClick={() => void onClickSend()}
                                    disabled={!canWrite || busy || draft.trim().length === 0}
                                    className="rounded-full bg-go px-3.5 py-1.5 font-mono text-base font-bold text-ink disabled:opacity-50"
                                    aria-label="Send message"
                                >
                                    ↑
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <aside className="scroll-slim hidden w-72 shrink-0 space-y-3 overflow-y-auto lg:block">
                {!readOnly && (detail.data?.subagents.length ?? 0) > 0 && (
                    <details open>
                        <summary className="cursor-pointer font-mono text-sm font-bold text-dim">
                            Subagents ({detail.data?.subagents.length})
                        </summary>
                        <ul className="mt-2 space-y-1">
                            {detail.data?.subagents.map((agent) => (
                                <li key={agent.id}>
                                    <Link
                                        to={`/sessions/${encodeURIComponent(id)}/${encodeURIComponent(agent.id)}`}
                                        className="flex items-baseline justify-between gap-2 rounded border border-line bg-panel px-2 py-1 hover:border-fog"
                                    >
                                        <span className="truncate text-xs text-fog">{agent.title}</span>
                                        <span className="shrink-0 font-mono text-[10px] text-dim">
                                            {agent.synced ? "read →" : "not synced"}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
                {!readOnly && (
                    <details open>
                        <summary className="cursor-pointer font-mono text-sm font-bold text-dim">
                            Pending approvals{(detail.data?.approvals.length ?? 0) > 0 ? ` (${detail.data?.approvals.length})` : ""}
                        </summary>
                        {(detail.data?.approvals.length ?? 0) === 0 ? (
                            <p className="mt-2 text-sm text-dim">No pending requests.</p>
                        ) : (
                            <ul className="mt-2 space-y-2">
                                {detail.data?.approvals.map((row) => (
                                    <li key={row.id} className="rounded border border-line bg-panel p-2">
                                        <p className="font-mono text-xs text-warn">{row.action}</p>
                                        <p className="mt-1 break-all font-mono text-[11px] text-dim">{row.resources}</p>
                                        {row.message && <p className="mt-1 text-xs text-dim">{row.message.slice(0, 200)}</p>}
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void onClickDecide(row, "once")}
                                                disabled={busy}
                                                className="rounded bg-go px-2 py-0.5 font-mono text-xs font-bold text-ink disabled:opacity-50"
                                            >
                                                Allow
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void onClickDecide(row, "reject")}
                                                disabled={busy}
                                                className="rounded border border-line px-2 py-0.5 font-mono text-xs text-fog disabled:opacity-50"
                                            >
                                                Deny
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </details>
                )}

                <details open>
                    <summary className="cursor-pointer font-mono text-sm font-bold text-dim">Session stats</summary>
                    {stats && (
                        <SessionStatsView
                            stats={stats}
                            modelName={modelInfo.name}
                            provider={modelInfo.provider}
                            contextLimit={modelInfo.contextLimit}
                            total={totalTokens}
                            usagePct={usagePct}
                        />
                    )}
                </details>

                {!readOnly && (
                    <details>
                        <summary className="cursor-pointer font-mono text-sm font-bold text-dim">
                            Move to another PC
                        </summary>
                        <div className="mt-2 space-y-2">
                            <p className="text-xs text-dim">
                                This session was mirrored from a PC. To continue it elsewhere:
                            </p>
                            <div className="rounded border border-line bg-black px-3 py-1.5">
                                <span className="font-mono text-xs">
                                    <span className="text-go">$ </span>
                                    <span className="text-fog">localagents push</span>
                                </span>
                            </div>
                            <p className="font-mono text-[10px] text-dim">
                                Run on the PC that has this session. Then `localagents pull` on the other PC.
                            </p>
                        </div>
                    </details>
                )}
            </aside>
        </main>
    );
}
