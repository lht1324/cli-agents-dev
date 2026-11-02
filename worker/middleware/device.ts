import { createMiddleware } from "hono/factory";
import { verifyDeviceToken } from "../../lib/auth/device";
import type { AppEnv } from "../../lib/env";

export type DeviceVariables = {
    deviceId: string;
    userId: string;
};

// 데몬 인증 — Bearer 기기 토큰. 실패하면 401 (라우트는 실행되지 않는다).
export const requireDevice = createMiddleware<{
    Bindings: AppEnv;
    Variables: DeviceVariables;
}>(async (c, next) => {
    const authed = await verifyDeviceToken(c.req.raw);
    if (!authed) {
        return c.json({ success: false, status: 401, error: "unauthorized" }, 401);
    }
    c.set("deviceId", authed.deviceId);
    c.set("userId", authed.userId);
    await next();
});
