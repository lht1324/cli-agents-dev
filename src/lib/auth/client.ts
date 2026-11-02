import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

// 브라우저 클라이언트. 같은 오리진의 프록시(/api/auth)로만 통신하므로
// 클라 번들에 Neon Auth 서버 주소·키가 필요 없고 CORS도 없다.
function resolveAuthBaseUrl(): string {
    if (typeof window === "undefined") {
        return "/api/auth";
    }
    return `${window.location.origin}/api/auth`;
}

export const authClient = createAuthClient(resolveAuthBaseUrl(), {
    adapter: BetterAuthReactAdapter(),
});
