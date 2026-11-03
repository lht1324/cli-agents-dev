// 페이지별 문서 메타. SPA라 index.html의 기본값(랜딩용)을 라우트마다 덮어쓴다.
// 정적 index.html에는 랜딩 메타만 있다. 라우트 이동 시 제목·설명·canonical을 맞춘다.

const SITE_URL = "https://localagents.link";
const DEFAULT_TITLE = "LocalAgents | Session sync for OpenCode";
const DEFAULT_DESCRIPTION =
    "Start a session on one PC and continue it on another. LocalAgents syncs OpenCode sessions between machines, with an optional web inbox for approving tool calls from your phone.";

export interface PageMeta {
    title?: string;
    description?: string;
    path: string;
}

function setMeta(selector: string, attr: "content", value: string): void {
    const el = document.head.querySelector<HTMLMetaElement>(selector);
    if (el) {
        el.setAttribute(attr, value);
    }
}

export function setPageMeta({ title, description, path }: PageMeta): void {
    const fullTitle = title ?? DEFAULT_TITLE;
    const desc = description ?? DEFAULT_DESCRIPTION;
    const url = `${SITE_URL}${path}`;

    document.title = fullTitle;
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[name="robots"]', "content", "index, follow");
    setMeta('meta[property="og:title"]', "content", fullTitle);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[name="twitter:title"]', "content", fullTitle);
    setMeta('meta[name="twitter:description"]', "content", desc);

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
        canonical.setAttribute("href", url);
    }
}
