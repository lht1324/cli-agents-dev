/** 리다이렉트 + Set-Cookie */
export function redirectWithCookies(location: string, setCookies: string[]): Response {
    const headers = new Headers({ Location: location });
    for (const cookie of setCookies) {
        headers.append("Set-Cookie", cookie);
    }
    return new Response(null, { status: 302, headers });
}

/** 기존 응답에 Set-Cookie를 덧붙인다. ASSETS.fetch 응답 헤더는 immutable이라 복사한다. */
export function appendSetCookies(response: Response, setCookies: string[]): Response {
    if (setCookies.length === 0) {
        return response;
    }
    const headers = new Headers(response.headers);
    for (const cookie of setCookies) {
        headers.append("Set-Cookie", cookie);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
