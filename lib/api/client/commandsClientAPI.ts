import { postFetch } from "./baseFetch";
import { toFailure, type ClientResult } from "./result";

export type CommandType = "approve" | "message" | "set-agent" | "set-model";

export interface QueueCommandInput {
    deviceId: string;
    type: CommandType;
    payload: unknown;
}

interface QueueBody {
    success?: boolean;
    error?: string;
    data?: { id?: string };
}

// userId는 게이트웨이가 세션에서 넣는다. 브라우저가 지정하지 않는다.
export const commandsClientAPI = {
    // 명령은 outbox에 쌓이고 데몬이 다음 폴링에 가져간다. 여기서 성공은 "접수"까지다.
    async queue(input: QueueCommandInput): Promise<ClientResult<{ id: string }>> {
        try {
            const res = await postFetch("/api/web/commands", {
                deviceId: input.deviceId,
                type: input.type,
                payload: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload),
            });
            const body = (await res.json()) as QueueBody;
            const id = body.data?.id;
            if (!body.success || !id) {
                return { ok: false, status: res.status, error: body.error };
            }
            return { ok: true, data: { id } };
        } catch (error) {
            return toFailure(error);
        }
    },
};
