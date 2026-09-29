import { NextResponse } from "next/server";

// NextResponse.json()의 { status }를 미리 채워 뽑아주는 팩토리.
// 사용: const base = getNextBaseResponse(201); return base.json({ success: true, status: 201 });
export function getNextBaseResponse(status: number) {
    return {
        json: (body: Record<string, unknown>) => NextResponse.json(body, { status }),
    };
}
