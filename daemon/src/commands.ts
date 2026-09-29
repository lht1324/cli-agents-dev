import { db } from "./db";

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
    const id = process.env.CLIAGENT_DEVICE_ID;
    if (!id) {
        throw new Error("CLIAGENT_DEVICE_ID is not set. pairing(login) 구현 전까지 수동으로 넣는다");
    }
    return id;
}

async function execute(type: string, payload: string): Promise<ExecResult> {
    if (type === "ping") {
        return { ok: true, data: "pong" };
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
