type Input = Record<string, unknown>;

function str(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function pathOf(input: Input): string {
    return str(input.filePath ?? input.path);
}

function cap(text: string, limit: number): string {
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

// 종류별 입력 1줄 요약. 출력 본문은 저장하지 않는다 (question·종료상태 제외).
export const TOOL_FORMATTERS: Record<string, (input: Input) => string> = {
    read: (input) => `read ${pathOf(input)}`,
    edit: (input) => `edit ${pathOf(input)}`,
    write: (input) => `write ${pathOf(input)}`,
    bash: (input) => `$ ${str(input.command)}`,
    shell: (input) => {
        const bg = input.background ? "[bg] " : "";
        const dir = str(input.workdir);
        return `$ ${bg}${str(input.command)}${dir ? ` (${dir})` : ""}`;
    },
    grep: (input) => `grep ${str(input.pattern)}`,
    glob: (input) => `glob ${str(input.pattern)}`,
    websearch: (input) => `search: ${str(input.query)}`,
    webfetch: (input) => `fetch ${str(input.url)}`,
    skill: (input) => `skill: ${str(input.name ?? input.id)}`,
    task: (input) => `task: ${str(input.description)}`,
    todowrite: (input) => {
        const todos = Array.isArray(input.todos) ? (input.todos as { content?: unknown; status?: unknown }[]) : [];
        const head = todos
            .slice(0, 3)
            .map((t) => `${str(t.status) === "completed" ? "x" : " "} ${str(t.content)}`.trim())
            .join(" / ");
        return `todos: ${head}${todos.length > 3 ? ` (+${todos.length - 3})` : ""}`;
    },
    execute: (input) => `run: ${cap(str(input.code).split("\n")[0], 120)}`,
    question: (input) => {
        const questions = Array.isArray(input.questions)
            ? (input.questions as { header?: unknown; question?: unknown }[])
            : [];
        const first = questions[0];
        const extra = questions.length > 1 ? ` (+${questions.length - 1})` : "";
        return `asked: ${str(first?.question)}${extra}`;
    },
};

export function formatToolCall(name: string, input: unknown): string {
    const record = (input ?? {}) as Input;
    const format = TOOL_FORMATTERS[name];
    const summary = format ? format(record) : `${name} ${cap(JSON.stringify(record), 200)}`;
    return cap(summary, 500);
}

// shell 종료 상태 → ✓/✗ 마커. 출력 2번째 줄에서 뽑는다.
export function formatToolExit(name: string, outputText: string): string | null {
    if (name !== "bash" && name !== "shell") {
        return null;
    }
    const match = outputText.match(/[Ee]xited with code (\d+)|Command exited with code (\d+)/);
    if (match) {
        return match[1] === "0" || match[2] === "0" ? "✓" : `✗ code ${match[1] ?? match[2]}`;
    }
    if (outputText.includes("notified automatically")) {
        return "…bg";
    }
    if (outputText.includes("SIGTERM")) {
        return "✗ killed";
    }
    return null;
}
