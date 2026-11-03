import { Hono } from "hono";
import { checkBillingGate, trialDaysLeft } from "../../../lib/billing";
import type { AppEnv } from "../../../lib/env";
import type { AuthVariables } from "../../middleware/auth";
import { getBaseResponse } from "../../utils/getBaseResponse";

// 헤더가 쓰는 가벼운 상태. 체험 남은 일수만 돌려준다 (유료면 null).
// 헤더는 모든 화면에 있으므로 무거운 계정 조회(/api/web/account)와 분리한다.
const webMe = new Hono<{ Bindings: AppEnv; Variables: AuthVariables }>();

webMe.get("/", async (c) => {
    const userId = c.get("userId");
    const [gate, daysLeft] = await Promise.all([checkBillingGate(userId), trialDaysLeft(userId)]);
    return getBaseResponse({ success: true, status: 200, data: { daysLeft, billingBlocked: !gate.allowed } });
});

export default webMe;
