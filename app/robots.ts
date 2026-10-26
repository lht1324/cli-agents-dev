import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// 내부 화면은 robots.txt로 막지 않는다. disallow하면 크롤러가 noindex 메타를 읽지 못해
// URL만 검색 결과에 남는다. 내부 화면은 각 페이지의 메타 noindex가 담당한다.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/"],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
