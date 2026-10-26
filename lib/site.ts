import type { Metadata } from "next";

// 운영 도메인. canonical·sitemap·OG URL은 환경과 무관하게 이 값으로 고정한다.
// dev의 localhost가 메타에 새면 검색엔진이 엉뚱한 URL을 정본으로 잡는다.
export const SITE_URL = "https://localagents.link";
export const SITE_NAME = "LocalAgents";
export const SITE_TITLE = "LocalAgents | Session sync for OpenCode";
export const SITE_DESCRIPTION =
    "Start a session on one PC and continue it on another. LocalAgents syncs OpenCode sessions between machines so you can approve tool calls from your phone.";

const OG_IMAGE = {
    url: "/og/og.png",
    width: 1200,
    height: 630,
    alt: "LocalAgents: start on one PC, continue everywhere.",
} as const;

// 색인 대상 페이지의 메타를 한 곳에서 만든다.
// og:url은 페이지마다 달라야 하는데, 루트 layout의 openGraph를 상속하면 전부 홈 URL로 박힌다.
export function buildPageMetadata({
    title,
    description,
    path,
    absoluteTitle = false,
}: {
    title: string;
    description: string;
    path: string;
    absoluteTitle?: boolean;
}): Metadata {
    return {
        title: absoluteTitle ? { absolute: title } : title,
        description,
        alternates: { canonical: path },
        openGraph: {
            type: "website",
            url: path,
            siteName: SITE_NAME,
            title,
            description,
            images: [OG_IMAGE],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [OG_IMAGE.url],
        },
    };
}

// 크롤러가 내용을 읽되 색인은 하지 말아야 하는 화면.
// robots.txt disallow로는 noindex를 전달할 수 없어서(크롤러가 메타를 못 읽는다) 페이지 메타로 처리한다.
export const NOINDEX_METADATA: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};
