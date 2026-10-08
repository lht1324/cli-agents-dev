import type { TabMessage, TabPackage, TabPart } from "./localdb";

// v1 ⇄ v2 모양 번역. 근거: 본가 v1-migration.bun.ts + v1.18.33/v2 스키마 실측.
// id는 유지, 그릇만 바꾼다. 모르는 모양은 버리고 skipped에 센다.

export type Flavor = "v1" | "v2";

export interface Converted {
    messages: TabMessage[];
    parts: TabPart[];
    skipped: number;
}

interface Ctx {
    directory: string;
    agent: string;
    modelID: string;
    providerID: string;
    now: number;
}

function json(data: string): Record<string, unknown> | null {
    try {
        const d = JSON.parse(data) as unknown;
        if (d && typeof d === "object") {
            return d as Record<string, unknown>;
        }
        return null;
    } catch {
        return null;
    }
}

function str(v: unknown, fallback = ""): string {
    return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// 패키지 맛보기. 명시 필드 우선, 없으면 data 모양으로 추론.
export function pkgFlavor(pkg: TabPackage): Flavor {
    const f = (pkg as { flavor?: unknown }).flavor;
    if (f === "v1" || f === "v2") {
        return f;
    }
    for (const m of pkg.messages.slice(0, 20)) {
        const d = json(m.data);
        if (d && typeof d["role"] === "string") {
            return "v1";
        }
    }
    return "v2";
}

function v2TextOf(content: unknown): string[] {
    if (!Array.isArray(content)) {
        return [];
    }
    const out: string[] = [];
    for (const b of content) {
        if (b && typeof b === "object" && (b as { type?: unknown }).type === "text") {
            const t = (b as { text?: unknown }).text;
            if (typeof t === "string" && t.length > 0) {
                out.push(t);
            }
        }
    }
    return out;
}

// v2 행 → v1 message.data + part들.
export function toV1(pkg: TabPackage, ctx: Ctx): Converted {
    const messages: TabMessage[] = [];
    const parts: TabPart[] = [];
    let skipped = 0;
    let prevId: string | null = null;
    let prevUserId: string | null = null;
    let mergeAnchor: TabMessage | null = null;
    let seq = 0;
    const rowsByMessage = new Map<string, TabPart[]>();
    for (const p of pkg.parts) {
        const list = rowsByMessage.get(p.messageId) ?? [];
        list.push(p);
        rowsByMessage.set(p.messageId, list);
    }
    // 별도 행을 v1 모양으로. id 유지. 모르는 종류는 원문 통과.
    const convertRow = (messageId: string, p: TabPart, at: number | null): void => {
        const pd = json(p.data);
        if (!pd) {
            return;
        }
        const t = pd["type"];
        if (t === "text") {
            parts.push({ ...p, messageId, data: JSON.stringify({ type: t, text: str(pd["text"]) }) });
            return;
        }
        if (t === "reasoning") {
            const start = num(p.createdAt, at ?? ctx.now);
            parts.push({
                ...p,
                messageId,
                data: JSON.stringify({ type: t, text: str(pd["text"]), time: { start, end: num(p.updatedAt, start) } }),
            });
            return;
        }
        if (t === "tool") {
            const state = (pd["state"] ?? {}) as Record<string, unknown>;
            const status = state["status"];
            const input = state["input"] ?? {};
            const callID = str(pd["id"] ?? pd["callID"], p.id);
            const tool = str(pd["name"] ?? pd["tool"], "unknown");
            const created = num((state["time"] as Record<string, unknown> | undefined)?.["start"], at ?? ctx.now);
            if (status === "completed") {
                const contentBlocks = Array.isArray(state["content"]) ? (state["content"] as unknown[]) : [];
                const output = contentBlocks
                    .filter(
                        (c): c is { type: string; text: string } =>
                            !!c && typeof c === "object" && (c as { type?: unknown }).type === "text",
                    )
                    .map((c) => c.text)
                    .join("\n\n");
                parts.push({
                    ...p,
                    messageId,
                    data: JSON.stringify({
                        type: "tool",
                        tool,
                        callID,
                        state: { status: "completed", input, output, time: { start: created, end: p.updatedAt ?? created } },
                    }),
                });
            } else {
                parts.push({
                    ...p,
                    messageId,
                    data: JSON.stringify({
                        type: "tool",
                        tool,
                        callID,
                        state: { status: "error", input, error: "interrupted before handoff", time: { start: created, end: created } },
                    }),
                });
            }
            return;
        }
        parts.push({ ...p, messageId });
    };
    for (const m of pkg.messages) {
        const d = json(m.data);
        if (!d) {
            skipped++;
            continue;
        }
        const at = m.createdAt ?? ctx.now;
        if (m.type === "user" || m.type === "synthetic" || m.type === "system") {
            // system은 카탈로그 같은 재생성 잡음이라 가져오지 않는다.
            if (m.type === "system") {
                skipped++;
                continue;
            }
            messages.push({
                id: m.id,
                type: "user",
                seq: seq++,
                createdAt: at,
                updatedAt: m.updatedAt,
                data: JSON.stringify({
                    role: "user",
                    time: { created: at },
                    agent: ctx.agent,
                    model: { providerID: ctx.providerID, modelID: ctx.modelID },
                    summary: { diffs: [] },
                }),
            });
            prevUserId = m.id;
            mergeAnchor = null;
            const separate = rowsByMessage.get(m.id) ?? [];
            if (separate.length === 0) {
                const text = str(d["text"]);
                if (text) {
                    parts.push({
                        id: `prt_${m.id.slice(4, 16)}_t`,
                        messageId: m.id,
                        createdAt: at,
                        updatedAt: at,
                        data: JSON.stringify({ type: "text", text }),
                    });
                }
            } else {
                for (const p of separate) {
                    convertRow(m.id, p, at);
                }
            }
            prevId = m.id;
            continue;
        }
        if (m.type === "assistant") {
            const model = (d["model"] ?? {}) as Record<string, unknown>;
            const tokens = (d["tokens"] ?? {}) as Record<string, unknown>;
            const cache = (tokens["cache"] ?? {}) as Record<string, unknown>;
            // 1.18은 assistant 연속 불가. 직전 배출이 assistant면 합친다 (첫 id 유지).
            const last = mergeAnchor;
            if (last) {
                try {
                    const prev = JSON.parse(last.data) as Record<string, unknown>;
                    const pt = (prev["tokens"] ?? {}) as Record<string, unknown>;
                    const pc = (pt["cache"] ?? {}) as Record<string, unknown>;
                    prev["cost"] = num(prev["cost"]) + num(d["cost"]);
                    prev["tokens"] = {
                        input: num(pt["input"]) + num(tokens["input"]),
                        output: num(pt["output"]) + num(tokens["output"]),
                        reasoning: num(pt["reasoning"]) + num(tokens["reasoning"]),
                        cache: { read: num(pc["read"]) + num(cache["read"]), write: num(pc["write"]) + num(cache["write"]) },
                    };
                    last.data = JSON.stringify(prev);
                    last.updatedAt = m.updatedAt;
                } catch {
                    // 합치기 실패해도 파트는 살린다
                }
                const separate = rowsByMessage.get(m.id) ?? [];
                for (const p of separate) {
                    convertRow(last.id, p, at);
                }
                prevId = m.id;
                continue;
            }
            const rowData: Record<string, unknown> = {
                ...(prevUserId ? { parentID: prevUserId } : {}),
                role: "assistant",
                mode: str(d["agent"], ctx.agent),
                agent: str(d["agent"], ctx.agent),
                modelID: str(model["id"], ctx.modelID),
                providerID: str(model["providerID"], ctx.providerID),
                ...(typeof model["variant"] === "string" && (model["variant"] as string).length > 0
                    ? { variant: model["variant"] as string }
                    : {}),
                ...(typeof d["finish"] === "string" && (d["finish"] as string).length > 0 ? { finish: d["finish"] as string } : {}),
                path: { cwd: ctx.directory, root: ctx.directory },
                cost: num(d["cost"]),
                tokens: {
                    input: num(tokens["input"]),
                    output: num(tokens["output"]),
                    reasoning: num(tokens["reasoning"]),
                    cache: { read: num(cache["read"]), write: num(cache["write"]) },
                },
                time: { created: at },
            };
            messages.push({ id: m.id, type: "assistant", seq: seq++, createdAt: at, updatedAt: m.updatedAt, data: JSON.stringify(rowData) });
            mergeAnchor = messages[messages.length - 1];
            const separate = rowsByMessage.get(m.id) ?? [];
            if (separate.length === 0) {
                const content = d["content"];
                if (Array.isArray(content)) {
                    for (const b of content) {
                        if (!b || typeof b !== "object") {
                            continue;
                        }
                        const block = b as Record<string, unknown>;
                        if (block["type"] === "text" && typeof block["text"] === "string") {
                            parts.push({
                                id: `prt_${m.id.slice(4, 16)}_${parts.length}`,
                                messageId: m.id,
                                createdAt: at,
                                updatedAt: at,
                                data: JSON.stringify({ type: "text", text: block["text"] }),
                            });
                        } else if (block["type"] === "reasoning" && typeof block["text"] === "string") {
                            parts.push({
                                id: `prt_${m.id.slice(4, 16)}_${parts.length}`,
                                messageId: m.id,
                                createdAt: at,
                                updatedAt: at,
                                data: JSON.stringify({ type: "reasoning", text: block["text"], time: { start: at, end: at } }),
                            });
                        }
                    }
                }
            } else {
                for (const p of separate) {
                    convertRow(m.id, p, at);
                }
            }
            prevId = m.id;
            continue;
        }
        if (m.type === "compaction") {
            // epoch 경계. 합치기 앵커를 끊는다.
            mergeAnchor = null;
            prevId = m.id;
            skipped++;
            continue;
        }
        skipped++;
    }
    return { messages, parts, skipped };
}

// v1 쓰기 전 게이트. v1.18.33 message.ts Info·파트 6종 기준 필수 키 대조. 빠진 경로를 뱉는다.
export function v1MessageProblems(data: string, hasPrevUser: boolean): string[] {
    const missing: string[] = [];
    let d: Record<string, unknown>;
    try {
        d = JSON.parse(data) as Record<string, unknown>;
    } catch {
        return ["invalid-json"];
    }
    const need = (path: string, ok: boolean) => {
        if (!ok) {
            missing.push(path);
        }
    };
    need("role", typeof d["role"] === "string");
    const time = d["time"] as Record<string, unknown> | undefined;
    need("time.created", !!time && typeof time["created"] === "number");
    need("agent", typeof d["agent"] === "string");
    if (d["role"] === "assistant") {
        need("parentID", !hasPrevUser || typeof d["parentID"] === "string");
        need("mode", typeof d["mode"] === "string");
        need("modelID", typeof d["modelID"] === "string");
        need("providerID", typeof d["providerID"] === "string");
        const path = d["path"] as Record<string, unknown> | undefined;
        need("path.cwd", !!path && typeof path["cwd"] === "string");
        const tokens = d["tokens"] as Record<string, unknown> | undefined;
        need("tokens", !!tokens && ["input", "output", "reasoning"].every((k) => typeof tokens[k] === "number"));
    }
    if (d["role"] === "user") {
        const model = d["model"] as Record<string, unknown> | undefined;
        need("model", !!model && typeof model["modelID"] === "string");
    }
    return missing;
}

export function v1PartProblems(data: string): string[] {
    const missing: string[] = [];
    let d: Record<string, unknown>;
    try {
        d = JSON.parse(data) as Record<string, unknown>;
    } catch {
        return ["invalid-json"];
    }
    const need = (path: string, ok: boolean) => {
        if (!ok) {
            missing.push(path);
        }
    };
    const t = d["type"];
    need("type", typeof t === "string");
    if (t === "text") {
        need("text", typeof d["text"] === "string");
    } else if (t === "reasoning") {
        need("text", typeof d["text"] === "string");
        const time = d["time"] as Record<string, unknown> | undefined;
        need("time.start", !!time && typeof time["start"] === "number");
    } else if (t === "tool") {
        need("tool", typeof d["tool"] === "string");
        need("callID", typeof d["callID"] === "string");
        const state = d["state"] as Record<string, unknown> | undefined;
        need("state.status", !!state && typeof state["status"] === "string");
        const time = state?.["time"] as Record<string, unknown> | undefined;
        need("state.time.start", !!time && typeof time["start"] === "number");
    }
    return missing;
}
export function toV2(pkg: TabPackage, ctx: Ctx): Converted {
    const messages: TabMessage[] = [];
    const parts: TabPart[] = [];
    let skipped = 0;
    let seq = 0;
    const byMessage = new Map<string, TabPart[]>();
    for (const p of pkg.parts) {
        const list = byMessage.get(p.messageId) ?? [];
        list.push(p);
        byMessage.set(p.messageId, list);
    }
    for (const m of pkg.messages) {
        const d = json(m.data);
        if (!d) {
            skipped++;
            continue;
        }
        const at = m.createdAt ?? ctx.now;
        const role = typeof d["role"] === "string" ? d.role : m.type;
        const owned = byMessage.get(m.id) ?? [];
        const ownedTexts = owned.flatMap((p) => {
            const pd = json(p.data);
            if (pd && pd["type"] === "text" && typeof pd["text"] === "string") {
                return [pd["text"] as string];
            }
            return [];
        });
        if (role === "user") {
            messages.push({
                id: m.id,
                type: "user",
                seq: seq++,
                createdAt: at,
                updatedAt: m.updatedAt,
                data: JSON.stringify({ type: "user", text: ownedTexts.join("\n\n"), time: { created: at } }),
            });
            continue;
        }
        if (role === "assistant") {
            const tokens = (d["tokens"] ?? {}) as Record<string, unknown>;
            const cache = (tokens["cache"] ?? {}) as Record<string, unknown>;
            const content: Record<string, unknown>[] = [];
            for (const p of owned) {
                const pd = json(p.data);
                if (!pd) {
                    continue;
                }
                if (pd["type"] === "text" && typeof pd["text"] === "string") {
                    content.push({ type: "text", text: pd["text"] });
                    continue;
                }
                if (pd["type"] === "reasoning" && typeof pd["text"] === "string") {
                    content.push({ type: "reasoning", text: pd["text"] });
                } else if (pd["type"] === "tool") {
                    const state = (pd["state"] ?? {}) as Record<string, unknown>;
                    const output = typeof state["output"] === "string" ? (state["output"] as string) : "";
                    content.push({
                        type: "tool",
                        id: str(pd["callID"], p.id),
                        name: str(pd["tool"], "unknown"),
                        state: {
                            status: "completed",
                            input: state["input"] ?? {},
                            content: [{ type: "text", text: output }],
                        },
                        time: { created: at, completed: m.updatedAt ?? at },
                    });
                }
            }
            messages.push({
                id: m.id,
                type: "assistant",
                seq: seq++,
                createdAt: at,
                updatedAt: m.updatedAt,
                data: JSON.stringify({
                    type: "assistant",
                    agent: str(d["agent"], ctx.agent),
                    model: {
                        providerID: str(d["providerID"], ctx.providerID),
                        id: str(d["modelID"], ctx.modelID),
                        variant: str(d["variant"], "default"),
                    },
                    content,
                    cost: num(d["cost"]),
                    tokens: {
                        input: num(tokens["input"]),
                        output: num(tokens["output"]),
                        reasoning: num(tokens["reasoning"]),
                        cache: { read: num(cache["read"]), write: num(cache["write"]) },
                    },
                    time: { created: at },
                }),
            });
            continue;
        }
        skipped++;
    }
    return { messages, parts: [], skipped };
}
