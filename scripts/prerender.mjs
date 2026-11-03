// 빌드 후 페이지별 정적 HTML을 만든다.
// SPA는 index.html 하나라 모든 경로가 같은 메타를 공유한다. 그러면 /sessions 같은
// 내부 화면도 랜딩 설명을 달고 검색엔진에 노출된다. 여기서 경로마다 HTML을 복사하고
// 제목·설명·canonical·robots를 해당 페이지 값으로 바꿔 둔다.
// 화면 동작은 그대로다 (같은 스크립트를 로드한다).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT_DIR = join(process.cwd(), "dist", "client");
const SITE_URL = "https://localagents.link";
const INDEX = readFileSync(join(OUT_DIR, "index.html"), "utf8");

const PAGES = [
    {
        path: "/",
        title: "LocalAgents | Session sync for OpenCode",
        description:
            "Start a session on one PC and continue it on another. LocalAgents syncs OpenCode sessions between machines, with an optional web inbox for approving tool calls from your phone.",
        robots: "index, follow",
    },
    {
        path: "/legal/terms",
        title: "Terms of Service",
        description: "The rules for using LocalAgents.",
        robots: "index, follow",
    },
    {
        path: "/legal/privacy",
        title: "Privacy Policy",
        description: "What we collect, why, and who processes it.",
        robots: "index, follow",
    },
    {
        path: "/legal/refunds",
        title: "Refund Policy",
        description: "Cancel anytime. Unused days refunded pro rata within 14 days.",
        robots: "index, follow",
    },
    // 로그인 뒤 화면(/sessions, /profile 등)은 여기서 만들지 않는다.
    // 워커가 인증 확인 후 실제 경로로 셸을 돌려주므로, 미리 만들면 인증 없는 HTML이
    // 정적 경로로 노출될 수 있다. 그 화면들의 noindex는 워커가 실행 중에 넣는다.
];

function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 기존 메타 값을 정규식으로 교체한다. 없으면 </head> 앞에 삽입.
function withMeta(html, { title, description, robots, path }) {
    const url = `${SITE_URL}${path === "/" ? "/" : path}`;
    let out = html;
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
    out = out.replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
        `<meta name="description" content="${escapeHtml(description)}" />`,
    );
    out = out.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`);
    out = out.replace(/<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${robots}" />`);
    out = out.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`);
    out = out.replace(
        /<meta property="og:title" content="[^"]*" \/>/,
        `<meta property="og:title" content="${escapeHtml(title)}" />`,
    );
    out = out.replace(
        /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
        `<meta property="og:description" content="${escapeHtml(description)}" />`,
    );
    out = out.replace(
        /<meta name="twitter:title" content="[^"]*" \/>/,
        `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    );
    return out;
}

let written = 0;
for (const page of PAGES) {
    if (page.path === "/") {
        writeFileSync(join(OUT_DIR, "index.html"), withMeta(INDEX, page));
        written += 1;
        continue;
    }
    const file = join(OUT_DIR, page.path, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, withMeta(INDEX, page));
    written += 1;
}

console.log(`[prerender] ${written} pages written`);
