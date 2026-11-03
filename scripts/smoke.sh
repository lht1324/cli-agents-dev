#!/usr/bin/env bash
#
# 스모크 테스트. "되는 것 같다"를 "된다"로 바꾸기 위한 최소 계약 검사.
#
# 왜 있나: 이 프로젝트에는 자동 테스트가 0건이다. Vite+Hono 이전 같은 큰 변경에서
# 회귀를 잡을 수단이 사람 눈뿐이면, 조용히 깨지는 것(SEO·프리렌더·인증 가드)을 놓친다.
# 이전 전/후에 같은 기준을 돌려 diff를 만들기 위한 스크립트다.
#
# 사용:
#     bash scripts/smoke.sh                          # http://localhost:3004
#     bash scripts/smoke.sh http://localhost:3005
#     bash scripts/smoke.sh https://localagents.link
#
# 종료 코드: 실패가 하나라도 있으면 1, 아니면 0.

set -u

BASE="${1:-http://localhost:3004}"
BASE="${BASE%/}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

BODY="$TMP/body"
HEADERS="$TMP/headers"

PASSED=0
FAILED=0
SKIPPED=0

if [ -t 1 ]; then
    C_OK=$'\033[32m'
    C_NG=$'\033[31m'
    C_SK=$'\033[33m'
    C_DIM=$'\033[2m'
    C_OFF=$'\033[0m'
else
    C_OK=""
    C_NG=""
    C_SK=""
    C_DIM=""
    C_OFF=""
fi

pass() {
    PASSED=$((PASSED + 1))
    printf "  %sPASS%s  %s\n" "$C_OK" "$C_OFF" "$1"
}

fail() {
    FAILED=$((FAILED + 1))
    printf "  %sFAIL%s  %s\n" "$C_NG" "$C_OFF" "$1"
    if [ -n "${2:-}" ]; then
        printf "        %s%s%s\n" "$C_DIM" "$2" "$C_OFF"
    fi
}

skip() {
    SKIPPED=$((SKIPPED + 1))
    printf "  %sSKIP%s  %s\n" "$C_SK" "$C_OFF" "$1"
    if [ -n "${2:-}" ]; then
        printf "        %s%s%s\n" "$C_DIM" "$2" "$C_OFF"
    fi
}

section() {
    printf "\n%s\n" "$1"
}

# ---------------------------------------------------------------- helpers

STATUS=""

fetch() {
    local method="$1"
    local path="$2"
    local data="${3:-}"

    if [ -n "$data" ]; then
        STATUS="$(curl -s -o "$BODY" -D "$HEADERS" -w "%{http_code}" \
            --max-time 20 -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE$path")"
    else
        STATUS="$(curl -s -o "$BODY" -D "$HEADERS" -w "%{http_code}" \
            --max-time 20 -X "$method" \
            "$BASE$path")"
    fi
}

body_has() {
    grep -q -- "$1" "$BODY"
}

location_header() {
    grep -i "^location:" "$HEADERS" | head -1 | sed 's/^[Ll]ocation: *//' | tr -d '\r'
}

content_type() {
    grep -i "^content-type:" "$HEADERS" | head -1 | sed 's/^[Cc]ontent-[Tt]ype: *//' | tr -d '\r'
}

expect_status() {
    local label="$1"
    local expected="$2"
    if [ "$STATUS" = "$expected" ]; then
        pass "$label ($STATUS)"
        return 0
    fi
    fail "$label" "기대 $expected, 실제 $STATUS"
    return 1
}

expect_in_body() {
    local label="$1"
    local needle="$2"
    if body_has "$needle"; then
        pass "$label"
        return 0
    fi
    fail "$label" "'$needle' 없음"
    return 1
}

# ---------------------------------------------------------------- run

printf "smoke: %s\n" "$BASE"
printf "%s\n" "$(date '+%Y-%m-%d %H:%M:%S')"

# 1. 공개 페이지 — 마케팅/법률. 여기가 깨지면 SEO와 링크 미리보기가 죽는다.
section "공개 페이지"

fetch GET "/"
if expect_status "/ 200" "200"; then
    MISSING=""
    body_has "<title>" || MISSING="$MISSING title"
    body_has 'rel="canonical"' || MISSING="$MISSING canonical"
    body_has 'property="og:url"' || MISSING="$MISSING og:url"
    body_has "SoftwareApplication" || MISSING="$MISSING json-ld"
    if [ -z "$MISSING" ]; then
        pass "/ 메타·JSON-LD"
    else
        fail "/ 메타 누락" "$MISSING"
    fi
fi

# 법률 3종. 본문이 HTML에 들어 있는지가 핵심이다(프리렌더 회귀 감지).
for slug in terms privacy refunds; do
    fetch GET "/legal/$slug"
    if expect_status "/legal/$slug 200" "200"; then
        if body_has "<h1"; then
            pass "/legal/$slug 본문이 HTML에 있음"
        else
            fail "/legal/$slug 본문 없음" "SPA 폴백(index.html)으로 떨어졌을 수 있음"
        fi
        body_has 'rel="canonical"' || fail "/legal/$slug canonical 없음"
    fi
done

# 2. 인증 가드 — 서버가 막는지. SPA 전환 후 클라 리다이렉트로 바뀌면 여기서 잡힌다.
section "인증 가드 (비로그인)"

for path in /sessions /devices /profile; do
    fetch GET "$path"
    if [ "$STATUS" = "307" ] || [ "$STATUS" = "302" ]; then
        LOC="$(location_header)"
        case "$LOC" in
            *"/auth/sign-in"*) pass "$path → 로그인으로 리다이렉트" ;;
            *) fail "$path 리다이렉트 대상 이상" "Location: $LOC" ;;
        esac
    else
        fail "$path 가드 없음" "기대 307/302, 실제 $STATUS"
    fi
done

# 3. 인증 화면 — 색인 금지.
section "인증 화면"

fetch GET "/auth/sign-in"
if expect_status "/auth/sign-in 200" "200"; then
    expect_in_body "/auth/sign-in noindex" 'noindex'
fi

fetch GET "/dev/og"
if expect_status "/dev/og 200" "200"; then
    expect_in_body "/dev/og noindex" 'noindex'
fi

# 4. 정적 자산 — 링크 미리보기와 크롤러가 여기에 걸린다.
section "정적 자산"

fetch GET "/og/og.png"
if [ "$STATUS" = "200" ]; then
    CT="$(content_type)"
    SIZE="$(wc -c < "$BODY" | tr -d ' ')"
    case "$CT" in
        image/png*)
            if [ "$SIZE" -gt 100000 ]; then
                pass "/og/og.png (${SIZE}B)"
            else
                fail "/og/og.png 너무 작음" "${SIZE}B, 빈 이미지일 수 있음"
            fi
            ;;
        *)
            fail "/og/og.png content-type" "$CT"
            ;;
    esac
else
    fail "/og/og.png" "기대 200, 실제 $STATUS"
fi

fetch GET "/robots.txt"
if expect_status "/robots.txt 200" "200"; then
    expect_in_body "/robots.txt sitemap 선언" "Sitemap:"
fi

fetch GET "/sitemap.xml"
if expect_status "/sitemap.xml 200" "200"; then
    expect_in_body "/sitemap.xml urlset" "<urlset"
    expect_in_body "/sitemap.xml 법률 URL 포함" "/legal/terms"
fi

fetch GET "/llms.txt"
if expect_status "/llms.txt 200" "200"; then
    expect_in_body "/llms.txt 도메인 표기" "localagents.link"
fi

# 5. API 인증 — 토큰 없이 뚫리면 안 된다.
section "API 인증"

fetch POST "/api/daemon/sync" "{}"
expect_status "/api/daemon/sync 401" "401"

fetch GET "/api/daemon/whoami"
expect_status "/api/daemon/whoami 401" "401"

fetch GET "/api/web/messages?tabId=x"
expect_status "/api/web/messages 401 (S2S 가드)" "401"

fetch POST "/api/webhook/dodo" "{}"
expect_status "/api/webhook/dodo 401 (서명 없음)" "401"

# 변조된 서명도 401이어야 한다. 헤더를 직접 붙여야 해서 fetch 대신 별도 호출.
STATUS="$(curl -s -o "$BODY" -D "$HEADERS" -w "%{http_code}" --max-time 20 \
    -X POST -H "Content-Type: application/json" \
    -H "webhook-id: smoke" -H "webhook-timestamp: 1" -H "webhook-signature: v1,deadbeef" \
    -d '{}' "$BASE/api/webhook/dodo")"
expect_status "/api/webhook/dodo 401 (변조 서명)" "401"

# 6. 로그인 개시 — Neon Auth 신뢰 도메인이 살아 있는지.
#    등록되지 않은 origin에서는 403 INVALID_CALLBACKURL이 정상이므로 SKIP으로 둔다.
section "로그인 개시"

STATUS="$(curl -s -o "$BODY" -D "$HEADERS" -w "%{http_code}" --max-time 20 \
    -X POST -H "Content-Type: application/json" -H "Origin: $BASE" \
    -d "{\"provider\":\"google\",\"callbackURL\":\"$BASE/api/auth/callback\"}" \
    "$BASE/api/auth/sign-in/social")"

if [ "$STATUS" = "200" ] && body_has '"url"'; then
    pass "/api/auth/sign-in/social 200 + init URL"
elif [ "$STATUS" = "403" ] && body_has "INVALID_CALLBACKURL"; then
    skip "/api/auth/sign-in/social" "이 origin은 Neon Auth 신뢰 도메인에 없음 (정상)"
else
    fail "/api/auth/sign-in/social" "기대 200, 실제 $STATUS"
fi

# ---------------------------------------------------------------- summary

printf "\n"
printf "결과: %s%d 통과%s" "$C_OK" "$PASSED" "$C_OFF"
if [ "$FAILED" -gt 0 ]; then
    printf ", %s%d 실패%s" "$C_NG" "$FAILED" "$C_OFF"
fi
if [ "$SKIPPED" -gt 0 ]; then
    printf ", %s%d 건너뜀%s" "$C_SK" "$SKIPPED" "$C_OFF"
fi
printf "\n"

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
exit 0
