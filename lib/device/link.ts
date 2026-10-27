import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/neon/client";
import { devices, deviceTokens } from "@/lib/neon/schema";

export interface LinkDeviceInput {
    userId: string;
    deviceId: string;
    label: string;
    platform: string | null;
    hostname: string | null;
}

// 기기 연결(재연결 포함). 같은 deviceId면 행을 갱신하고 새 토큰을 발급한다.
// 최초 승인과 재로그인 자동 연결이 같은 규칙을 쓰도록 한 곳에 둔다.
export async function linkDevice(input: LinkDeviceInput): Promise<string> {
    const db = getDb();
    await db
        .insert(devices)
        .values({
            id: input.deviceId,
            userId: input.userId,
            label: input.label,
            platform: input.platform,
            hostname: input.hostname,
            lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
            target: devices.id,
            // 다시 로그인하면 해제 상태를 푼다. 기존 세션·기록은 그대로 이어진다.
            set: {
                userId: input.userId,
                label: input.label,
                platform: input.platform,
                hostname: input.hostname,
                lastSeenAt: new Date(),
                unlinkedAt: null,
            },
        });
    const token = `loa_${randomUUID().replace(/-/g, "")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.insert(deviceTokens).values({
        id: randomUUID(),
        deviceId: input.deviceId,
        tokenHash,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    return token;
}
