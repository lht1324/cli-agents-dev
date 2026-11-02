import { Hono } from "hono";
import { unsealConnect } from "../../../lib/auth/packet";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";

// 승인 화면이 봉투(data)를 복호화해 기기 정보를 보여줘야 한다 (키는 서버에만 있다).
const pairing = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

pairing.get("/inspect", (c) => {
    const data = c.req.query("data") ?? "";
    const p = data ? unsealConnect(data) : null;
    if (!p) {
        return c.json({ success: false, status: 400, error: "invalid packet" }, 400);
    }
    return c.json({ success: true, status: 200, data: { ...p } });
});

export default pairing;
