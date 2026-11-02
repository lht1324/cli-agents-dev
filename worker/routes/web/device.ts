import { Hono } from "hono";
import { checkBillingGate } from "../../../lib/billing";
import { linkDevice } from "../../../lib/device/link";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";

const device = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

device.post("/authorize", async (c) => {
    const userId = c.get("userId");
    const gate = await checkBillingGate(userId);
    if (!gate.allowed) {
        return c.json({ success: false, status: 403, error: "trial_ended" }, 403);
    }
    let body: Record<string, unknown>;
    try {
        body = (await c.req.json()) as Record<string, unknown>;
    } catch {
        return c.json({ success: false, status: 400, error: "invalid JSON body" }, 400);
    }
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!deviceId) {
        return c.json({ success: false, status: 400, error: "deviceId is required" }, 400);
    }
    const token = await linkDevice({
        userId,
        deviceId,
        label: typeof body.label === "string" && body.label.length > 0 ? body.label : "My PC",
        platform: typeof body.platform === "string" ? body.platform : null,
        hostname: typeof body.hostname === "string" ? body.hostname : null,
    });
    return c.json({ success: true, status: 201, data: { token } }, 201);
});

export default device;
