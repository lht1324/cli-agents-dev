import { db } from "./db";
import { readState } from "./device";
import { discoverServer } from "./server";
import { reply } from "./permissions";

interface CommandRow {
    id: string;
    type: string;
    payload: string;
}

interface ExecResult {
    ok: boolean;
    data?: string;
    error?: string;
}

function deviceId(): string {
    const fromEnv = process.env.CLIAGENT_DEVICE_ID;
    if (fromEnv) {
        return fromEnv;
    }
    const state = readState();
    if (!state) {
        throw new Error("CLIAGENT_DEVICE_ID is not set and no state file. run `cliagent register <user-id>` first");
    }
    return state.deviceId;
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

function toResultJson(result: ExecResult): string {
    return JSON.stringify(result);
}

// pending 10건까지 1회 수행. 상주 루프는 2단계.
export async function pollCommands(): Promise<void> {
    const sql = db();
    const device = deviceId();
    const rows = (await sql`
        SELECT id, type, payload FROM commands
        WHERE device_id = ${device} AND status = 'pending' AND expires_at > now()
        ORDER BY created_at LIMIT 10
    `) as CommandRow[];
    if (rows.length === 0) {
        console.log("no pending commands");
        return;
    }
    for (const row of rows) {
        const claimed = (await sql`
            UPDATE commands SET status = 'delivered', delivered_at = now()
            WHERE id = ${row.id} AND status = 'pending'
            RETURNING id
        `) as { id: string }[];
        if (claimed.length === 0) {
            console.log(`${row.id}\tskip (already claimed)`);
            continue;
        }
        const result = await execute(row.type, row.payload);
        await sql`
            UPDATE commands SET status = 'done', done_at = now(), result = ${toResultJson(result)}
            WHERE id = ${row.id}
        `;
        console.log(`${row.id}\t${row.type}\t${result.ok ? "done" : "error"}`);
    }
}
