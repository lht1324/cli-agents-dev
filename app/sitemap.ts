import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// 법률 본문 마지막 수정일. 실제로 고칠 때만 갱신한다.
// 매 배포마다 날짜가 바뀌면 크롤러가 "또 바뀌었네" 신호를 무시한다.
const LAST_MODIFIED = new Date("2026-10-27");

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: SITE_URL,
            lastModified: LAST_MODIFIED,
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: `${SITE_URL}/legal/terms`,
            lastModified: LAST_MODIFIED,
            changeFrequency: "yearly",
            priority: 0.3,
        },
        {
            url: `${SITE_URL}/legal/privacy`,
            lastModified: LAST_MODIFIED,
            changeFrequency: "yearly",
            priority: 0.3,
        },
        {
            url: `${SITE_URL}/legal/refunds`,
            lastModified: LAST_MODIFIED,
            changeFrequency: "yearly",
            priority: 0.3,
        },
    ];
}
