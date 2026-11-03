import { deleteFetch, getFetch } from "./baseFetch";
import { readBaseResponse, readBaseResponseOk } from "./readBaseResponse";

export interface DeviceRow {
    id: string;
    label: string;
    platform: string | null;
    hostname: string | null;
    lastSeenAt: string | null;
}

export const devicesClientAPI = {
    async getDevices(): Promise<DeviceRow[] | null> {
        const data = await readBaseResponse<{ items: DeviceRow[] }>(await getFetch("/api/web/account/devices"));
        return data?.items ?? null;
    },

    async deleteDeviceById(deviceId: string): Promise<boolean> {
        return readBaseResponseOk(await deleteFetch(`/api/web/devices?deviceId=${encodeURIComponent(deviceId)}`));
    },
};
