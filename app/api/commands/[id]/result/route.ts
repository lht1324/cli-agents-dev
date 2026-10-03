import { and, eq } from "drizzle-orm";
import { verifyDeviceToken } from "@/lib/auth/device";
import { getDb } from "@/lib/neon/client";
import { commands } from "@/lib/neon/schema";
import { getNextBaseResponse } from "@/lib/utils/getNextBaseResponse";

interface ResultBody {
    ok?: unknown;
    data?: unknown;
    error?: unknown;
}

// 데몬 실행 결과 보고. 본인 기기 명령만 갱신한다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
    const authed = await verifyDeviceToken(request);
    if (!authed) {
        return getNextBaseResponse(401).json({ success: false, status: 401, error: "unauthorized" });
    }
    const { id } = await params;
    let body: ResultBody;
    try {
        body = (await request.json()) as ResultBody;
    } catch {
        return getNextBaseResponse(400).json({ success: false, status: 400, error: "invalid JSON body" });
    }
    const result = JSON.stringify({
        ok: body.ok === true,
        ...(typeof body.data === "string" ? { data: body.data } : {}),
        ...(typeof body.error === "string" ? { error: body.error } : {}),
    });
    await getDb()
        .update(commands)
        .set({ status: "done", doneAt: new Date(), result })
        .where(and(eq(commands.id, id), eq(commands.deviceId, authed.deviceId)));
    return getNextBaseResponse(200).json({ success: true, status: 200 });
}
