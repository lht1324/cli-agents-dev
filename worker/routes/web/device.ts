import { Hono } from "hono";
import { checkBillingGate } from "../../../lib/billing";
import { linkDevice } from "../../../lib/device/link";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";
import { getBaseResponse } from "../../utils/getBaseResponse";

const device = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

device.post("/authorize", async (c) => {
    const userId = c.get("userId");
    const gate = await checkBillingGate(userId);
    if (!gate.allowed) {
        return getBaseResponse({ success: false, status: 403, error: "trial_ended" });
    }
    let body: Record<string, unknown>;
    try {
        body = (await c.req.json()) as Record<string, unknown>;
    } catch {
        return getBaseResponse({ success: false, status: 400, error: "invalid JSON body" });
    }
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!deviceId) {
        return getBaseResponse({ success: false, status: 400, error: "deviceId is required" });
    }
    const token = await linkDevice({
        userId,
        deviceId,
        label: typeof body.label === "string" && body.label.length > 0 ? body.label : "My PC",
        platform: typeof body.platform === "string" ? body.platform : null,
        hostname: typeof body.hostname === "string" ? body.hostname : null,
    });
    return getBaseResponse({ success: true, status: 201, data: { token } });
});

export default device;
