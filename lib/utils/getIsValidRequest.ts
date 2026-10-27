import { timingSafeEqual } from "node:crypto";
import { getAuth } from "@/lib/auth/server";
import { verifyDeviceToken, type DeviceAuth } from "@/lib/auth/device";

// 인증 판정 단일 출처. 라우트는 "어느 채널로 왔는가"만 고르고, 판정은 여기서만 한다.
//
//   getIsValidRequestC2S    브라우저 세션 쿠키        → 진입점에서만 (게이트웨이, device/begin 같은 리다이렉트 라우트)
//   getIsValidRequestS2S    x-internal-secret + x-user-id → 게이트웨이 뒤 라우트 전용
//   getIsValidRequestDevice 데몬 Bearer 기기 토큰      → 데몬 라우트 전용
//
// 통과하면 신원(userId·deviceId)을, 실패하면 null을 돌려준다. boolean을 따로 두지 않아
// 라우트는 null 검사 한 번으로 끝나고, 검사 후 타입도 string으로 좁혀진다.

// C2S. 세션 쿠키를 읽는다. 게이트웨이에서 한 번만 호출하고, 뒤로는 S2S로 넘긴다.
export async function getIsValidRequestC2S(): Promise<string | null> {
    const { data: session } = await getAuth().getSession();
    return session?.user?.id ?? null;
}

// S2S. 게이트웨이가 주입한 내부 비밀을 검증하고 userId를 꺼낸다.
// 브라우저가 직접 부르면 헤더가 없거나 틀려서 null이다 (게이트웨이 우회 차단).
export function getIsValidRequestS2S(request: Request): string | null {
    const expected = process.env.INTERNAL_FIRE_AND_FORGET_API_SECRET ?? "";
    const provided = request.headers.get("x-internal-secret");
    if (!expected || !provided || !safeEqual(provided, expected)) {
        return null;
    }
    const userId = request.headers.get("x-user-id") ?? "";
    return userId.length > 0 ? userId : null;
}

// DEVICE. 데몬의 Bearer 토큰. 기기와 주인을 함께 돌려준다.
export async function getIsValidRequestDevice(request: Request): Promise<DeviceAuth | null> {
    return verifyDeviceToken(request);
}

function safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    if (left.length !== right.length) {
        return false;
    }
    return timingSafeEqual(left, right);
}
