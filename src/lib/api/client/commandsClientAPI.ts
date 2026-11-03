import { postFetch } from "./baseFetch";
import { readBaseResponseOk } from "./readBaseResponse";

export type CommandType = "approve" | "message" | "set-agent" | "set-model";

export interface QueueCommandInput {
    deviceId: string;
    type: CommandType;
    payload: unknown;
}

// 명령은 outbox에 쌓이고 데몬이 다음 폴링에 가져간다. 성공은 "접수"까지다.
export const commandsClientAPI = {
    async queueCommand(input: QueueCommandInput): Promise<boolean> {
        return readBaseResponseOk(
            await postFetch("/api/web/commands", {
                deviceId: input.deviceId,
                type: input.type,
                payload: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload),
            }),
        );
    },
};
