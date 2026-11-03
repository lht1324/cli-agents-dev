import { Hono } from "hono";

// 운영 도메인. canonical·sitemap·OG URL은 환경과 무관하게 이 값으로 고정한다.
// dev의 localhost가 메타에 새면 검색엔진이 엉뚱한 URL을 정본으로 잡는다.
const SITE_URL = "https://localagents.link";

// 법률 본문 마지막 수정일. 실제로 고칠 때만 갱신한다.
// 매 배포마다 날짜가 바뀌면 크롤러가 "또 바뀌었네" 신호를 무시한다.
const LAST_MODIFIED = "2026-10-27";

const seo = new Hono();

seo.get("/sitemap.xml", (c) => {
    const pages = [
        { path: "", changeFrequency: "weekly", priority: "1.0" },
        { path: "/legal/terms", changeFrequency: "yearly", priority: "0.3" },
        { path: "/legal/privacy", changeFrequency: "yearly", priority: "0.3" },
        { path: "/legal/refunds", changeFrequency: "yearly", priority: "0.3" },
    ];
    const body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...pages.map(
            (p) =>
                `  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${LAST_MODIFIED}</lastmod>` +
                `<changefreq>${p.changeFrequency}</changefreq><priority>${p.priority}</priority></url>`,
        ),
        "</urlset>",
    ].join("\n");
    return c.body(body, 200, { "Content-Type": "application/xml; charset=utf-8" });
});

// 내부 화면은 robots.txt로 막지 않는다. disallow하면 크롤러가 noindex 메타를 읽지 못해
// URL만 검색 결과에 남는다. 내부 화면은 각 페이지의 메타 noindex가 담당한다.
seo.get("/robots.txt", (c) => {
    const body = ["User-agent: *", "Allow: /", "Disallow: /api/", "", `Sitemap: ${SITE_URL}/sitemap.xml`, ""].join("\n");
    return c.body(body, 200, { "Content-Type": "text/plain; charset=utf-8" });
});

export default seo;
