// app/api 라우트의 인증 채널 규칙을 검사한다.
// 경로 접두사 = 채널이라는 규칙이 사람 머릿속에만 있으면 언젠가 깨진다. 빌드 전에 기계가 확인한다.
//
//   app/api/web/**            → getIsValidRequestS2S (게이트웨이 뒤)
//   app/api/daemon/**         → getIsValidRequestDevice (기기 토큰)
//   app/api/webhook/**          → webhook-signature 검증
//   app/api/client-gateway/** → getIsValidRequestC2S (진입점)
//   app/api/pairing/**, app/api/auth/** → 공개 (규칙 없음)
//
// 추가로 web 라우트가 게이트웨이 ROUTE_ENTRIES에 빠짐없이 등록됐는지 대조한다.
// (2026-10-27 실제 사고: device/authorize 미등록으로 Connect 버튼이 404)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const API_DIR = join(ROOT, "app/api");
const GATEWAY = join(API_DIR, "client-gateway/route.ts");

function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            out.push(...walk(full));
        } else if (name === "route.ts") {
            out.push(full);
        }
    }
    return out;
}

const rules = [
    { prefix: "app/api/web/", marker: "getIsValidRequestS2S", label: "S2S" },
    { prefix: "app/api/daemon/", marker: "getIsValidRequestDevice", label: "DEVICE" },
    { prefix: "app/api/webhook/", marker: "webhook-signature", label: "WEBHOOK" },
    { prefix: "app/api/client-gateway/", marker: "getIsValidRequestC2S", label: "C2S" },
];

const errors = [];
const files = walk(API_DIR);

for (const file of files) {
    const rel = relative(ROOT, file).split("\\").join("/");
    const rule = rules.find((r) => rel.startsWith(r.prefix));
    if (!rule) {
        continue;
    }
    const source = readFileSync(file, "utf8");
    if (!source.includes(rule.marker)) {
        errors.push(`${rel}: ${rule.label} 채널인데 ${rule.marker} 검사가 없습니다.`);
    }
}

// 게이트웨이 등록 대조: web 라우트의 각 메서드가 ROUTE_ENTRIES에 있어야 한다.
const gatewaySource = readFileSync(GATEWAY, "utf8");
const entries = new Set();
for (const line of gatewaySource.split("\n")) {
    const method = /method:\s*"([A-Z]+)"/.exec(line);
    const pattern = /pattern:\s*\[([^\]]+)\]/.exec(line);
    if (!method || !pattern) {
        continue;
    }
    const segments = pattern[1]
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter((s) => s.length > 0);
    entries.add(`${method[1]} /${segments.join("/")}`);
}

function toRoutePath(rel) {
    // app/api/web/messages/route.ts → /api/web/messages
    // app/api/daemon/commands/[id]/result/route.ts → /api/daemon/commands/:id/result
    return (
        "/" +
        rel
            .replace(/^app\//, "")
            .replace(/\/route\.ts$/, "")
            .split("/")
            .map((s) => (/^\[.+\]$/.test(s) ? ":" + s.slice(1, -1) : s))
            .join("/")
    );
}

for (const file of files) {
    const rel = relative(ROOT, file).split("\\").join("/");
    if (!rel.startsWith("app/api/web/")) {
        continue;
    }
    const routePath = toRoutePath(rel);
    const source = readFileSync(file, "utf8");
    const methods = new Set();
    for (const m of source.matchAll(/export async function (GET|POST|PATCH|DELETE|PUT)/g)) {
        methods.add(m[1]);
    }
    for (const m of source.matchAll(/export const (GET|POST|PATCH|DELETE|PUT)\b/g)) {
        methods.add(m[1]);
    }
    for (const method of methods) {
        if (!entries.has(`${method} ${routePath}`)) {
            errors.push(`${rel}: ${method} ${routePath} 가 게이트웨이 ROUTE_ENTRIES에 없습니다.`);
        }
    }
}

if (errors.length > 0) {
    console.error(`[check:routes] 실패 ${errors.length}건`);
    for (const e of errors) {
        console.error("  - " + e);
    }
    process.exit(1);
}

console.log(`[check:routes] 통과 (라우트 ${files.length}개, 게이트웨이 등록 ${entries.size}건)`);
