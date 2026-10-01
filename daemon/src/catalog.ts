import { apiGet, apiPost, type DiscoveredServer } from "./server";
import { db } from "./db";
import { readState } from "./device";

export interface ModelRef {
    id: string;
    providerID: string;
    variant?: string;
}

export async function setSessionAgent(server: DiscoveredServer, sessionID: string, agent: string): Promise<void> {
    await apiPost(server, `/session/${sessionID}/agent`, { agent });
}

export async function setSessionModel(server: DiscoveredServer, sessionID: string, model: ModelRef): Promise<void> {
    await apiPost(server, `/session/${sessionID}/model`, { model });
}

// 모델·에이전트 목록을 클라우드 거울에 올린다. 웹 드롭다운용.
export async function syncCatalog(server: DiscoveredServer): Promise<{ models: number; agents: number }> {
    const state = readState();
    if (!state) {
        throw new Error("not registered. run `cliagent register <user-id>` first");
    }
    const models = await apiGet(server, "/model");
    const agents = await apiGet(server, "/agent");
    const payload = JSON.stringify({ models, agents });
    const sql = db();
    await sql`
        INSERT INTO model_catalog (device_id, payload, updated_at)
        VALUES (${state.deviceId}, ${payload}, NOW())
        ON CONFLICT (device_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `;
    const count = (body: unknown): number => {
        const list = (body as { data?: unknown }).data;
        return Array.isArray(list) ? list.length : 0;
    };
    return { models: count(models), agents: count(agents) };
}
