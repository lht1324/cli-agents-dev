import { deleteFetch } from "./baseFetch";
import { toFailure, type ClientResult } from "./result";

interface BasicBody {
    success?: boolean;
    error?: string;
}

export const devicesClientAPI = {
    // 기기 해제. 토큰 전부 revoke + 행 삭제라 그 기기의 데몬은 즉시 끊긴다.
    async unlink(deviceId: string): Promise<ClientResult<null>> {
        try {
            const res = await deleteFetch(`/api/web/devices?deviceId=${encodeURIComponent(deviceId)}`);
            const body = (await res.json()) as BasicBody;
            if (!body.success) {
                return { ok: false, status: res.status, error: body.error };
            }
            return { ok: true, data: null };
        } catch (error) {
            return toFailure(error);
        }
    },
};
