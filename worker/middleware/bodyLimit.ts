import type { MiddlewareHandler } from "hono";

// 요청 본문 크기 제한. 거대한 JSON을 통째로 파싱하면 워커 메모리를 먹일 수 있다
// (zod 등 검증 라이브러리 취약점과 별개로, 원천에서 막는 게 확실하다).
// Content-Length가 있으면 읽기 전에 거절하고, 청크로 오는 경우 읽는 동안 누적해 막는다.
const DEFAULT_LIMIT_BYTES = 2 * 1024 * 1024;

export function bodyLimit(limitBytes = DEFAULT_LIMIT_BYTES): MiddlewareHandler {
    return async (c, next) => {
        const declared = c.req.header("content-length");
        if (declared && Number(declared) > limitBytes) {
            return c.json({ success: false, status: 413, error: "payload too large" }, 413);
        }
        // 본문이 없는 요청(GET 등)은 그대로 통과.
        if (c.req.method === "GET" || c.req.method === "HEAD") {
            await next();
            return;
        }
        const raw = await c.req.raw.arrayBuffer();
        if (raw.byteLength > limitBytes) {
            return c.json({ success: false, status: 413, error: "payload too large" }, 413);
        }
        // 핸들러는 c.req.json()을 쓰므로, 읽어 둔 바이트로 요청을 다시 만든다.
        c.req.raw = new Request(c.req.raw, { body: raw });
        await next();
    };
}
