import { postFetch } from "./baseFetch";

export type CommandType = "approve" | "message" | "set-agent" | "set-model";

export interface QueueCommandInput {
    deviceId: string;
    type: CommandType;
    payload: unknown;
}

// userId는 게이트웨이가 세션에서 넣는다. 브라우저가 지정하지 않는다.
export const commandsClientAPI = {
    async queue(input: QueueCommandInput): Promise<{ id: string } | null> {
        try {
            const response = await postFetch("/api/commands", {
                deviceId: input.deviceId,
                type: input.type,
                payload: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload),
            });
            const result = (await response.json()) as { success?: boolean; data?: { id?: string } };
            if (!result.success || !result.data?.id) {
                return null;
            }
            return { id: result.data.id };
        } catch (error) {
            console.error("queue command failed:", error);
            return null;
        }
    },
};
