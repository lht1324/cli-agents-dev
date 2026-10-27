import { postFetch } from "./baseFetch";
import { toFailure, type ClientResult } from "./result";

export interface AuthorizeDeviceInput {
    deviceId: string;
    label: string;
    platform: string;
    hostname: string;
}

interface AuthorizeBody {
    success?: boolean;
    error?: string;
    data?: { token?: string };
}

export const deviceClientAPI = {
    // 이 기기를 계정에 연결하고 데몬 토큰을 받는다. 토큰은 로컬 콜백(127.0.0.1)으로만 넘긴다.
    async authorize(input: AuthorizeDeviceInput): Promise<ClientResult<{ token: string }>> {
        try {
            const res = await postFetch("/api/web/device/authorize", input);
            const body = (await res.json()) as AuthorizeBody;
            const token = body.data?.token;
            if (!token) {
                return { ok: false, status: res.status, error: body.error };
            }
            return { ok: true, data: { token } };
        } catch (error) {
            return toFailure(error);
        }
    },
};
