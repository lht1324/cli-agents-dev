import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

/**
 * 증분 캐시 = Workers 정적 에셋.
 *
 * 기본 더미 캐시로는 generateStaticParams가 붙은 ●(SSG) 라우트를 서빙하지 못해 404가 난다.
 * 우리 쪽 대상은 /auth/[path] (sign-in·sign-up 등 고정 목록, dynamicParams=false)다.
 * 이 오버라이드는 빌드가 .open-next/cache → assets/cdn-cgi/_next_cache로 복사하고
 * 워커가 ASSETS 바인딩으로 읽는다. R2·KV 버킷이 필요 없다.
 *
 * 제약: 읽기 전용 — revalidate/ISR을 쓰지 않는 앱 전용. 이 앱에 revalidate 호출은 0건이다.
 */
export default defineCloudflareConfig({
    incrementalCache: staticAssetsIncrementalCache,
});
