import { createHash } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/neon/client";
import { devices, deviceTokens } from "@/lib/neon/schema";

export interface DeviceAuth {
    deviceId: string;
    userId: string;
}

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

// Bearer 디바이스 토큰 검증. 통과하면 기기+주인 반환.
export async function verifyDeviceToken(request: Request): Promise<DeviceAuth | null> {
    const header = request.headers.get("authorization");
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    const token = header.slice("Bearer ".length).trim();
    if (token.length === 0) {
        return null;
    }
    const rows = await getDb()
        .select({ deviceId: deviceTokens.deviceId, userId: devices.userId })
        .from(deviceTokens)
        .innerJoin(devices, eq(deviceTokens.deviceId, devices.id))
        .where(
            and(
                eq(deviceTokens.tokenHash, hashToken(token)),
                isNull(deviceTokens.revokedAt),
                or(isNull(deviceTokens.expiresAt), sql`${deviceTokens.expiresAt} > NOW()`),
            ),
        )
        .limit(1);
    if (rows.length === 0) {
        return null;
    }
    return { deviceId: rows[0].deviceId, userId: rows[0].userId };
}
