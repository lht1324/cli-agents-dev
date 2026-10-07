import { readState, writeState, baseUrl } from "./device";
import { apiPost, discoverServer } from "./server";
import { reply } from "./permissions";
import { setSessionAgent, setSessionModel, type ModelRef } from "./catalog";
import { drainSpool } from "./spool";

interface CommandRow {
    id: string;
    type: string;
    payload: string;
}

async function fetchNext(token: string): Promise<CommandRow | null> {
    const res = await fetch(`${baseUrl()}/api/commands/next`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
    });
    if (res.status === 204) {
        return null;
    }
    if (!res.ok) {
        throw new Error(`next rejected: ${res.status}`);
    }
    const body = (await res.json()) as { data?: CommandRow };
    return body.data ?? null;
}

async function reportResult(
    token: string,
    id: string,
    result: ExecResult,
): Promise<void> {
    const res = await fetch(`${baseUrl()}/api/commands/${id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(result),
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        throw new Error(`result rejected: ${res.status}`);
    }
}

interface ExecResult {
    ok: boolean;
    data?: string;
    error?: string;
}

interface ApprovePayload {
    sessionID?: unknown;
    requestID?: unknown;
    decision?: unknown;
}

async function execute(type: string, payload: string): Promise<ExecResult> {
    if (type === "ping") {
        return { ok: true, data: "pong" };
    }
    if (type === "set-agent" || type === "set-model") {
        const body = JSON.parse(payload) as { sessionID?: unknown; agent?: unknown; model?: unknown };
        if (typeof body.sessionID !== "string") {
            return { ok: false, error: `${type} payload needs sessionID` };
        }
        const server = await discoverServer();
        if (!server) {
            return { ok: false, error: "no running opencode server" };
        }
        if (type === "set-agent") {
            if (typeof body.agent !== "string" || body.agent.length === 0) {
                return { ok: false, error: "set-agent payload needs agent" };
            }
            await setSessionAgent(server, body.sessionID, body.agent);
            return { ok: true, data: `agent -> ${body.agent}` };
        }
        const model = body.model as ModelRef | undefined;
        if (!model || typeof model.id !== "string" || typeof model.providerID !== "string") {
            return { ok: false, error: "set-model payload needs model.id and model.providerID" };
        }
        await setSessionModel(server, body.sessionID, model);
        return { ok: true, data: `model -> ${model.providerID}/${model.id}` };
    }
    if (type === "message") {
        const body = JSON.parse(payload) as { sessionID?: unknown; text?: unknown };
        if (typeof body.sessionID !== "string" || typeof body.text !== "string" || body.text.length === 0) {
            return { ok: false, error: "message payload needs sessionID and text" };
        }
        const server = await discoverServer();
        if (!server) {
            return { ok: false, error: "no running opencode server" };
        }
        await apiPost(server, `/session/${body.sessionID}/prompt`, { text: body.text });
        return { ok: true, data: `sent to ${body.sessionID}` };
    }
    if (type === "approve") {
        const body = JSON.parse(payload) as ApprovePayload;
        if (typeof body.sessionID !== "string" || typeof body.requestID !== "string") {
            return { ok: false, error: "approve payload needs sessionID and requestID" };
        }
        if (body.decision !== "once" && body.decision !== "always" && body.decision !== "reject") {
            return { ok: false, error: "approve payload needs decision once|always|reject" };
        }
        const server = await discoverServer();
        if (!server) {
            return { ok: false, error: "no running opencode server" };
        }
        await reply(server, body.sessionID, body.requestID, body.decision);
        return { ok: true, data: `${body.requestID} -> ${body.decision}` };
    }
    return { ok: false, error: `unknown command type: ${type} (payload kept: ${payload.length} chars)` };
}

// pending 10건까지 1회 수행. 상주 루프는 2단계.
export async function pollCommands(): Promise<void> {
    const state = readState();
    if (!state) {
        throw new Error("not logged in. run `agentgit login` first");
    }
    if (!state.token) {
        throw new Error("no device token. run `agentgit login` again");
    }
    try {
        const server = await discoverServer();
        if (server) {
            const drained = await drainSpool(server);
            if (drained.drained > 0) {
                console.log(`drained: ${drained.drained} events`);
            }
        }
    } catch {
        // 스풀 실패는 무시. 폴링 계속.
    }
    for (let i = 0; i < 10; i++) {
        const row = await fetchNext(state.token);
        if (!row) {
            if (i === 0) {
                console.log("no pending commands");
            }
            writeState({ ...state, lastOkAt: Date.now() });
            return;
        }
        const result = await execute(row.type, row.payload);
        await reportResult(state.token, row.id, result);
        console.log(`${row.id}\t${row.type}\t${result.ok ? "done" : "error"}`);
    }
    writeState({ ...state, lastOkAt: Date.now() });
}
