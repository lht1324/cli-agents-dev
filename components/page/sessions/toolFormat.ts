export interface ToolCall {
    tool: string;
    input: Record<string, unknown>;
    stripped?: string[];
    exit?: string;
    hasImage?: boolean;
    answer?: string;
    truncated?: boolean;
    addedLines?: number;
    removedLines?: number;
}

function str(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function pathOf(input: Record<string, unknown>): string {
    return str(input.filePath ?? input.path);
}

// edit용 최소 diff. 앞뒤 공통부 자르고 바뀐 블록만 -/+ 로. 문맥 3줄, 상한 60줄.
export interface EditDiff {
    added: number;
    removed: number;
    lines: string[];
}

export function editCounts(call: ToolCall): { added: number; removed: number } | null {
    if (call.tool !== "edit") {
        return null;
    }
    if (call.truncated) {
        return {
            added: typeof call.addedLines === "number" ? call.addedLines : 0,
            removed: typeof call.removedLines === "number" ? call.removedLines : 0,
        };
    }
    if (!str(call.input.oldString) && !str(call.input.newString)) {
        return null;
    }
    const diff = editDiff(str(call.input.oldString), str(call.input.newString));
    return { added: diff.added, removed: diff.removed };
}

export function editDiff(oldText: string, newText: string): EditDiff {
    const a = oldText.split("\n");
    const b = newText.split("\n");
    let s = 0;
    while (s < a.length && s < b.length && a[s] === b[s]) {
        s++;
    }
    let e = 0;
    while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) {
        e++;
    }
    const del = a.slice(s, a.length - e);
    const add = b.slice(s, b.length - e);
    const lines: string[] = [];
    for (let i = Math.max(0, s - 3); i < s; i++) {
        lines.push(`  ${a[i]}`);
    }
    for (const l of del) {
        lines.push(`- ${l}`);
    }
    for (const l of add) {
        lines.push(`+ ${l}`);
    }
    for (let i = 0; i < Math.min(3, e); i++) {
        lines.push(`  ${a[a.length - e + i]}`);
    }
    const capped = lines.slice(0, 60);
    if (lines.length > capped.length) {
        capped.push(`… ${lines.length - capped.length} more lines`);
    }
    return { added: add.length, removed: del.length, lines: capped };
}

// 접힘 1줄 요약.
export function toolSummary(call: ToolCall): string {
    const input = call.input;
    switch (call.tool) {
        case "read":
        case "write": {
            const extra =
                input.offset !== undefined || input.limit !== undefined
                    ? `:${str(input.offset) || "0"}+${str(input.limit) || "∞"}`
                    : "";
            return `${call.tool} ${pathOf(input)}${extra}`;
        }
        case "edit": {
            return `${call.tool} ${pathOf(input)}`;
        }
        case "bash":
        case "shell": {
            const first = str(input.command).split(/\s+/)[0] ?? "";
            return first.length > 0 ? first : call.tool;
        }
        case "grep":
        case "glob":
            return `${call.tool} ${str(input.pattern)}`;
        case "websearch":
            return `search: ${str(input.query)}`;
        case "webfetch":
            return `fetch ${str(input.url)}`;
        case "skill":
            return `skill: ${str(input.name ?? input.id)}`;
        case "task":
            return `task: ${str(input.description)}`;
        case "todowrite": {
            const todos = Array.isArray(input.todos) ? (input.todos as { content?: unknown }[]) : [];
            return `todos: ${todos.length} items`;
        }
        case "execute":
            return `run: ${str(input.code).split("\n")[0]?.slice(0, 80) ?? ""}`;
        case "question": {
            const questions = Array.isArray(input.questions)
                ? (input.questions as { question?: unknown }[])
                : [];
            const first = str(questions[0]?.question);
            const extra = questions.length > 1 ? ` (+${questions.length - 1})` : "";
            return `asked: ${first}${extra}`;
        }
        default:
            return call.tool;
    }
}

// 펼침 상세. 날것 input에서 직접 읽는다.
export function toolDetail(call: ToolCall): string[] {
    const input = call.input;
    const lines: string[] = [];
    const path = pathOf(input);
    if (call.tool === "edit" && (str(input.oldString) || str(input.newString))) {
        lines.push(...editDiff(str(input.oldString), str(input.newString)).lines);
    }
    if (path.length > 0 && ["read", "edit", "write", "grep", "glob"].includes(call.tool)) {
        lines.push(path);
    }
    if (call.tool === "bash" || call.tool === "shell") {
        lines.push(`$ ${str(input.command)}`);
        if (str(input.workdir).length > 0) {
            lines.push(`in ${str(input.workdir)}`);
        }
    }
    if (call.tool === "websearch" && str(input.query).length > 0) {
        lines.push(str(input.query));
    }
    if (call.tool === "webfetch" && str(input.url).length > 0) {
        lines.push(str(input.url));
    }
    if (call.tool === "question") {
        const questions = Array.isArray(input.questions)
            ? (input.questions as { header?: unknown; question?: unknown; options?: { label?: unknown }[] }[])
            : [];
        for (const q of questions) {
            const labels = (q.options ?? []).map((o) => str(o.label)).filter((s) => s.length > 0);
            lines.push(`Q: ${str(q.question)}${labels.length > 0 ? ` [${labels.join(" / ")}]` : ""}`);
        }
        if (call.answer) {
            lines.push(`A: ${call.answer}`);
        }
    }
    if (call.tool === "todowrite" && Array.isArray(input.todos)) {
        for (const t of input.todos as { content?: unknown; status?: unknown }[]) {
            lines.push(`${str(t.status) === "completed" ? "x" : " "} ${str(t.content)}`);
        }
    }
    if (call.exit) {
        lines.push(call.exit);
    }
    if (call.hasImage) {
        lines.push("image attached (on-demand)");
    }
    if (call.stripped) {
        for (const s of call.stripped) {
            lines.push(`[${s} stripped]`);
        }
    }
    return lines;
}

export function parseToolCall(body: string): ToolCall | null {
    try {
        const parsed = JSON.parse(body) as Partial<ToolCall>;
        if (!parsed || typeof parsed.tool !== "string" || typeof parsed.input !== "object" || parsed.input === null) {
            return null;
        }
        return parsed as ToolCall;
    } catch {
        return null;
    }
}
