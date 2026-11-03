import { getFetch, postFetch } from "./baseFetch";
import { readBaseResponse } from "./readBaseResponse";

export interface PairingInfo {
    device: string;
    port: string;
    state: string;
    label: string;
    platform: string;
    hostname: string;
}

export interface AuthorizeDeviceInput {
    deviceId: string;
    label: string;
    platform: string;
    hostname: string;
}

export const pairingClientAPI = {
    async inspectPairing(data: string): Promise<PairingInfo | null> {
        return readBaseResponse<PairingInfo>(await getFetch(`/api/web/pairing/inspect?data=${encodeURIComponent(data)}`));
    },

    async authorizeDevice(input: AuthorizeDeviceInput): Promise<{ token: string } | null> {
        return readBaseResponse<{ token: string }>(await postFetch("/api/web/device/authorize", input));
    },
};
