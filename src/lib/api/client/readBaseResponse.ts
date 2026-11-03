import type { BaseResponse } from "../../../../lib/types/api/BaseResponse";

// ClientAPI 공통 응답 해석. 봉투를 풀고, 접근이 막힌 경우 화면 이동까지 한 곳에서 처리한다.
// 화면 컴포넌트는 HTTP 상태 코드를 볼 필요가 없다 (null이면 빈 화면).
interface BaseResponseWithData<T> extends BaseResponse {
    data?: T;
}

export async function readBaseResponse<T>(res: Response): Promise<T | null> {
    if (res.status === 401) {
        window.location.href = "/auth/sign-in";
        return null;
    }
    if (res.status === 403) {
        // 체험 종료. 구독 화면으로 보낸다.
        let error: string | undefined;
        try {
            error = ((await res.json()) as BaseResponse).error;
        } catch {
            // 본문이 없어도 401/403은 막힌 상태로 본다.
        }
        if (error === "trial_ended") {
            window.location.href = "/billing/locked";
        }
        return null;
    }
    if (!res.ok) {
        return null;
    }
    try {
        const body = (await res.json()) as BaseResponseWithData<T>;
        return body.success && body.data !== undefined ? body.data : null;
    } catch {
        return null;
    }
}

// 성공/실패만 알려주면 되는 동작(해지·재개·명령 접수)용.
// data가 없는 성공 응답도 있으므로 봉투의 success만 본다.
export async function readBaseResponseOk(res: Response): Promise<boolean> {
    if (res.status === 401) {
        window.location.href = "/auth/sign-in";
        return false;
    }
    if (res.status === 403) {
        let error: string | undefined;
        try {
            error = ((await res.json()) as BaseResponse).error;
        } catch {
            // 본문 없음
        }
        if (error === "trial_ended") {
            window.location.href = "/billing/locked";
        }
        return false;
    }
    if (!res.ok) {
        return false;
    }
    try {
        const body = (await res.json()) as BaseResponse;
        return body.success === true;
    } catch {
        return false;
    }
}
