import { apiGet, apiPost, type DiscoveredServer } from "./server";
import { cloudPost } from "./cloud";

interface ForkResult {
    id: string;
    title?: string;
}

export async function forkSession(server: DiscoveredServer, sessionID: string): Promise<ForkResult> {
    const body = (await apiPost(server, `/session/${sessionID}/fork`, {})) as { data?: ForkResult } | ForkResult;
    const result = (body as { data?: ForkResult }).data ?? (body as ForkResult);
    if (!result?.id) {
        throw new Error("fork returned no session id");
    }
    return result;
}

async function sourceTitle(server: DiscoveredServer, sessionID: string): Promise<string | null> {
    try {
        const body = (await apiGet(server, `/session/${sessionID}`)) as { data?: { title?: string } } | { title?: string };
        const row = (body as { data?: { title?: string } }).data ?? body;
        return (row as { title?: string }).title ?? null;
    } catch {
        return null;
    }
}

// fork + 클라우드 대장(sessions_meta) 등록.
export async function forkAndRegister(server: DiscoveredServer, sessionID: string): Promise<string> {
    const forked = await forkSession(server, sessionID);
    const title = (await sourceTitle(server, sessionID)) ?? `fork of ${sessionID.slice(4, 12)}`;
    await cloudPost("/api/sync", {
        sessions: [{ id: forked.id, title, status: "active", provider: "opencode" }],
    });
    return forked.id;
}
