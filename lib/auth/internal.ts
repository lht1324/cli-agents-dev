import { timingSafeEqual } from "node:crypto";

// 게이트웨이가 주입한 내부 호출 표식. 브라우저가 직접 부르면 이 헤더가 없거나 틀리다.
// 비밀은 256bit 랜덤 hex. 노출되면 교체하면 된다.
function matchesSecret(provided: string | null): boolean {
    const expected = process.env.INTERNAL_FIRE_AND_FORGET_API_SECRET ?? "";
    if (!expected || !provided) {
        return false;
    }
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) {
        return false;
    }
    return timingSafeEqual(a, b);
}

// 내부 호출이면 게이트웨이가 넣은 userId를 돌려준다. 아니면 null.
export function readInternalUser(request: Request): string | null {
    if (!matchesSecret(request.headers.get("x-internal-secret"))) {
        return null;
    }
    const userId = request.headers.get("x-user-id") ?? "";
    return userId.length > 0 ? userId : null;
}
