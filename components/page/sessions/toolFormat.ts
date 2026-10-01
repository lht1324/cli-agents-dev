export interface ToolCall {
    tool: string;
    input: Record<string, unknown>;
    stripped?: string[];
    exit?: string;
    hasImage?: boolean;
    answer?: string;
}

function str(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function pathOf(input: Record<string, unknown>): string {
    return str(input.filePath ?? input.path);
}

// 접힘 1줄 요약.
export function toolSummary(call: ToolCall): string {
    const input = call.input;
    switch (call.tool) {
        case "read":
        case "edit":
        case "write": {
            const extra =
                input.offset !== undefined || input.limit !== undefined
                    ? `:${str(input.offset) || "0"}+${str(input.limit) || "∞"}`
                    : "";
            return `${call.tool} ${pathOf(input)}${extra}`;
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
