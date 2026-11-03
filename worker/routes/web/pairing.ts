import { Hono } from "hono";
import { unsealConnect } from "../../../lib/auth/packet";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";
import { getBaseResponse } from "../../utils/getBaseResponse";

// 승인 화면이 봉투(data)를 복호화해 기기 정보를 보여줘야 한다 (키는 서버에만 있다).
const pairing = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

pairing.get("/inspect", (c) => {
    const data = c.req.query("data") ?? "";
    const p = data ? unsealConnect(data) : null;
    if (!p) {
        return getBaseResponse({ success: false, status: 400, error: "invalid packet" });
    }
    return getBaseResponse({ success: true, status: 200, data: { ...p } });
});

export default pairing;
