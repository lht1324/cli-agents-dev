import type { BaseResponse } from "../../lib/types/api/BaseResponse";

// 응답 봉투 헬퍼 — 모든 API 응답을 `{ success, status, message?, error?, data? }` 로 통일한다.
// Hono 핸들러에서 그대로 `return getBaseResponse({...})` 하면 된다.
// 404/500 같은 프레임워크 기본 응답도 이 봉투로 맞추려면 app.notFound()/app.onError()에서 같은 함수를 쓴다.
// (이름이 getNextBaseResponse가 아닌 이유: 이 프로젝트에는 Next가 없다.)

interface CustomResponse extends BaseResponse {
    data?: unknown;
}

export function getBaseResponse(baseResponse: CustomResponse): Response {
    if (baseResponse.error) {
        console.error(`[api] ${baseResponse.status}: ${baseResponse.error}`);
    }
    return Response.json({ ...baseResponse }, { status: baseResponse.status });
}
