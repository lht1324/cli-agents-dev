# context.md - cli-agents-dev

2026-10-27 05:31

## 프로젝트
- 폴더: `cli-agents-dev` (구 `new_project`)
- 서비스 가명: localagents (명령어는 단수 `localagents`)
- 도메인: `localagents.link` 본선 + `cliagents.dev` 리다이렉트용. dev 터널 `dev.localagents.link`
- 스택: Next.js 16.3.6 (Turbopack) / TypeScript / Tailwind CSS
- 배포: **Cloudflare Workers** (`localagents.link` custom domain 연결 완료). OpenNext 어댑터

## 사업 아이템 (확정 방향)
- 다중에이전트 세션 온라인 관리. **현재 OpenCode만 지원** (데몬에 Claude Code 코드 없음).
  - Claude Code 지원 전까지 사용자 노출 문구(랜딩·메타·OG)에 절대 쓰지 않는다. 2026-10-27 OG 카드에서 제거한 이력 있음.
- 본체 = PC 간 탭 복원. 부속 = 웹 리모컨(보기·승인·새 지시, 실행은 PC 서버). 웹에 터미널 재현 없음.
- 웹 범위: 랜딩·요금제 + 프로필·구독 관리 + 원격 inbox.
- 레포 구조: 데몬은 같은 레포 `daemon/` 하위. 패키지 분리는 2번째 프로젝트 때.

## 개발 환경 (2026-10-25 포트 변경 확정)
- 클라 3004 (`npm run dev`) / API 컨테이너 3005:3000 (`npm run dev:api` + docker compose). 데몬 baseUrl 기본값 `localhost:3005`.
- `:3000`은 tailored-ad 서버 보호. 데몬은 Cloudflare Tunnel 전용 (Bearer 토큰), 브라우저는 localhost (세션 쿠키 도메인 귀속).
- env 컨벤션: `NEXT_PUBLIC_BASE_URL`=브라우저→API (dev localhost:3005, 터널 URL 넣으면 로그인 깨짐) / `BASE_URL`=서버 외부 알림용 (웹훅 등) / `LOCALAGENTS_BASE_URL`=데몬 전용.
- CORS: 게이트웨이만. `CORS_ALLOWED_ORIGINS` (dev 기본값 localhost:3004). prod는 same origin이라 불필요.
- **배포 명령**: `npm run preview` (로컬 워커) / `npm run deploy` (빌드+배포). `npm run cf-typegen`은 바인딩 타입 생성.
- **빌드 전 `.env.local`을 반드시 밖으로 옮긴다**: OpenNext가 `.env*` 값을 `next-env.mjs`로 직렬화해 워커 번들에 넣는다(실측: tailored-ad 산출물에 키 25개 평문). 대시보드 Secrets가 런타임에 이기므로 동작은 하지만, 올릴 이유 없는 사본이다. 절차 = `mv .env.local <임시>` → build/deploy → 복원.

## 개발 환경 교훈 (2026-10-27 실측)
- **API 컨테이너(3005)와 클라 dev(3004)의 기동 순서**: 컨테이너가 먼저 돌면 그쪽 next가 `.next`를 root 소유로 만들어 클라 dev가 `EACCES: mkdir .next/dev`로 죽는다. **순서는 항상 클라 dev 먼저 → 컨테이너 나중**. 이 순서로 사장 실측 해결.
- 잔해(.next root 소유) 정리는 `sudo rm -rf .next` (root 재본화 문제라 sudo 필요).
- `node_modules` 사라진 상태로 `npx tsc`를 치면 npm이 가짜 패키지 `tsc@2.0.4`(스텁)를 설치한다. 타입체크는 의존성 설치 확인부터.
- **prod 빌드는 dev 서버와 `.next`를 공유한다**: dev(3004)를 내리고 빌드한다. 안 내리면 경합.
- `opennextjs-cloudflare build`는 `next build`를 자기가 돌린다 (`package.json` build 스크립트 안 거침).

## 배포 (2026-10-27 완료, Cloudflare Workers)
- **구성**: `wrangler.jsonc` (name `localagents`, `compatibility_date` 2026-09-01, `nodejs_compat`, ASSETS 바인딩, observability 로그) + `open-next.config.ts` + `package.json` 스크립트.
- **어댑터 버전 고정**: `@opennextjs/cloudflare` **1.20.6 정확히 고정**. `^1.20.6`으로 두면 1.20.13이 잡히는데 그건 `next >=16.4.1`을 요구해 peer 충돌. Next 16.3.6과 짝이 맞는 건 1.20.6 (tailored-ad와 동일 조합). wrangler `^4.153.0`.
- **`open-next.config.ts`**: `staticAssetsIncrementalCache` 필수. 기본 더미 캐시는 ●(SSG) 라우트를 404로 만든다. R2·KV 불필요, 읽기 전용(revalidate 0건이라 안전).
- **`wrangler.jsonc`의 vars는 비어 있다**: 런타임 설정이 전부 Secrets이고, `BASE_URL`·`NEXT_PUBLIC_BASE_URL`은 코드에 소비처가 없다(prod baseFetch는 상대 경로). 배포 시 이 파일의 vars가 대시보드 plain Variables를 덮어쓰니, 나중에 값이 생기면 여기에도 반영할 것. Secrets는 덮어쓰지 않는다.
- **`app/(main)/layout.tsx`에 `export const dynamic = "force-dynamic"`**: 이 레이아웃이 세션으로 헤더를 바꿔 하위 페이지는 본질적으로 동적이다. 명시하지 않으면 Next가 프리렌더를 시도하며 빌드 시점에 env(DB·auth)를 요구하고, 없으면 빌드가 통째로 죽는다(실측). 명시 후 **빌드가 자격증명 없이 돈다** → CI가 prod DB 키를 들 필요가 없고, 사용자별 화면이 정적 HTML로 굳을 여지도 사라진다.
- **auth 지연 초기화** (`lib/auth/server.ts`의 `getAuth()`): `createNeonAuth`는 호출 즉시 쿠키 secret을 검증하고 없으면 throw한다. `proxy.ts`는 워커 엔트리의 정적 import라 env 주입 전에 평가될 수 있어, 그 경우 500이 아니라 워커 부팅이 죽는다. 호출부 13곳을 `getAuth()`로 전환하고 모듈 최상단 호출 2곳(`proxy.ts`, `api/auth/[...path]/route.ts`)을 요청 시점으로 옮겼다.
- **크기**: gzip **3.47MB** / 업로드 15.6MB. 유료 한도 10MB 안에 여유. (무료 한도 3MiB는 초과 → 유료 플랜 필수)
- **workerd 실동작 확인**: Dodo 웹훅 HMAC(`node:crypto` createHmac·timingSafeEqual), AES-256-GCM 봉투(`lib/auth/packet.ts`), Neon HTTP 드라이버(`drizzle-orm/neon-http`), Neon Auth 미들웨어 전부 통과.
- **알려진 경고**: `Node.js middleware support is experimental in cloudflare, and not officially maintained by OpenNext`. Next 16의 `proxy.ts`가 Node 미들웨어로 번들된다. 프리뷰에서 307 리다이렉트·OAuth 정상 동작 확인했으나, OpenNext 업데이트 시 깨질 수 있다. `proxy.ts`는 OAuth 세션 교환이 도는 곳이라 제거 불가.
- **첫 배포 URL**: `https://localagents.lht1324.workers.dev` (계정 subdomain `lht1324`). `https://localagents.link`는 사장이 custom domain으로 연결(`workers/domains`: localagents.link → localagents, production). dashboard에서 붙인 도메인은 `wrangler deploy`로 사라지지 않는다(tailored-ad도 같은 방식으로 계속 배포).
- **시크릿 11개** (전부 Cloudflare Worker secrets, git 미포함): `DATABASE_URL` `NEON_AUTH_BASE_URL` `NEON_AUTH_COOKIE_SECRET` `NEON_API_KEY` `NEON_PROJECT_ID` `NEON_BRANCH_ID` `DEVICE_PACKET_KEY` `DODO_PAYMENTS_API_KEY` `DODO_PAYMENTS_ENVIRONMENT` `DODO_PAYMENTS_WEBHOOK_KEY` `INTERNAL_FIRE_AND_FORGET_API_SECRET`. 등록은 `printf '%s' "$V" | npx wrangler secret put <NAME>`.
- **prod 전환 완료**: Worker 시크릿이 production 브랜치를 본다(로그인 init URL이 `ep-late-night-az213oj2`). 회전은 사장이 직접. 회전 시 교체 대상: `DATABASE_URL`·`NEON_BRANCH_ID`·`NEON_AUTH_BASE_URL`·Dodo 3종. `NEON_PROJECT_ID`·`NEON_API_KEY`는 그대로 사용 가능.
- **미완**: Workers Builds 자동 배포 미설정 (master=production / develop=preview로 붙일 계획).

## 브랜드 자산·SEO (2026-10-27 완료)
- 로고: `public/logo/logo.svg`(512 타일) · `logo-glyph.svg`(투명) · `logo-32/180/512.png`. 손으로 쓴 SVG(래스터 아님) — 16px 파비콘·README 재사용 때문. 마크는 잉크 타일 + 초록 체브론 `>` + 베이스라인 `_`.
- `components/public/BrandMark.tsx`: next/image 옵티마이저가 작은 크기에서 리샘플해 뭉개므로 원본 SVG를 `<img>`로 직접 로드. 헤더 2곳(`(main)`·`auth`) 24px.
- **OG 카드**: `app/dev/og` + `components/page/dev/OgCardPageClient.tsx` (1200×630, `html-to-image` 2배 캡처 → 2400×1260). 산출물 `public/og/og.png`. noindex.
- **메타 단일 소스** `lib/site.ts`: `SITE_URL`(하드코딩 `https://localagents.link`, env 미사용 — localhost가 메타에 새면 안 됨) · `SITE_TITLE` · `SITE_DESCRIPTION` · `buildPageMetadata()` · `NOINDEX_METADATA`.
  - `buildPageMetadata`를 쓰는 이유: 루트 layout의 `openGraph`를 상속하면 법률 페이지의 `og:url`이 전부 홈으로 박힌다(실측 버그).
- `app/sitemap.ts` (4 URL) · `app/robots.ts` (allow `/`, disallow `/api/`, sitemap+host) · `public/llms.txt`.
- **내부 화면은 robots.txt disallow가 아니라 메타 noindex**: disallow하면 크롤러가 메타를 못 읽어 URL만 검색에 남는다. 적용: `/sessions`, `/sessions/[id]`, `/devices`, `/profile`, `/billing/locked`, `/device/authorize`, `/auth/*`, `/dev/og`.
- JSON-LD: `WebSite` + `SoftwareApplication`($9/$90). **FAQ·HowTo 스키마는 의도적 제외**(Google이 FAQ 리치 결과를 폐지).
- 카피 원칙: 사용자 노출 문구에 em dash(`—`/`–`)·AI 상투어 금지. 현재 0건.

## 과금 (2026-10-25~26 완성. **상품 등록만 남음**)
- 요금제 확정: **단일 플랜 Pro $9/월·$90/연 (2개월 할인)**. 30일 no-card 트라이얼, 31일째 hard cutoff (유료 아니면 사용 불가). 데이터는 삭제하지 않고 보관 (재구독 시 복원).
- 결정 배경: 기기 수는 3대+ 유저가 적어 약한 훅 → 기각. Free 티어는 차별점 약함+비용 → 기각 (사장: "쳐내는 게 맞다"). 트라이얼 30일로 확정 (14일은 가치 확정 전 전 끊길 위험).
- 결제사 **Dodo** (MoR). 브랜드 `brnd_0NqSDEWhhRh98FCCuDWhy` (LocalAgents), `trial_type: none` (트라이얼은 우리 DB 관리), metadata `{plan: pro, interval}`.
- **⚠️ 상품 미등록 (2026-10-27 실측)**: Dodo 대시보드에 상품을 만들지 않아 **체크아웃 세션 생성이 실패**한다. 랜딩 Subscribe 버튼 → "Could not open checkout. Try again." 서버 로그는 `lib/dodo.ts`의 `product mapping incomplete (monthly=missing, annual=missing)` 또는 products 401/403. → 상품 월·연 등록 + metadata `{plan: "pro", interval: "monthly"|"annual"}` 필수.
- **상품 ID 하드코딩 금지**: 서버가 `products.list()`를 metadata로 매핑 (1시간 캐시, 월·연 각 정확히 1개 아니면 loudly 실패 — 오결제 방지. tailored-ad `dodoProducts.ts` 패턴).
- **Dodo 키**: 신형 키는 `sk_test_` 프리픽스 없음. test/live는 **`DODO_PAYMENTS_ENVIRONMENT`** env로 명시(`test_mode`|`live_mode`). 프리픽스 판정·런타임 프로브 금지(edge에서 불가). 현재 키는 **스코프 제한 키**(`local-agents-dodo-api-key`, 18개 중 5개 리소스: 결제·구독·제품·고객·체크아웃 세션).
- `.env` Dodo 3개: `DODO_PAYMENTS_API_KEY` · `DODO_PAYMENTS_ENVIRONMENT` · `DODO_PAYMENTS_WEBHOOK_KEY`.
- **웹훅** (`app/api/dodo/webhook/route.ts`): Standard Webhooks 규격 (webhook-id/signature/timestamp, HMAC-SHA256, node:crypto 수동 검증, 리플레이 5분). `subscription.active/renewed/updated` → upsert, `cancelled/expired` → status=canceled. 유저 매핑은 체크아웃 metadata `user_id`. 구독 ID는 `subscription_id` 우선 → `id` 폴백. 유저 미상은 200 무시, DB 장애는 500 재시도. 게이트웨이에 넣지 않음(외부 직호출). **workerd에서 401 응답까지 실증**.
- **스키마**: `subscriptions`에 `dodo_subscription_id`·`status`·`interval`·`current_period_end`·`trial_ends_at`(0014) + `cancel_at_period_end`(0015).
- **과금 게이트** `lib/billing.ts`: 구독 active 통과 / `trial_ends_at` null이면 첫 API 활동+30일 초기화 / 만료 403(`trial_ended`). 적용: 데몬 경로 4개(sync GET/POST·messages·commands/next·handoffs/url) + 웹 fetch 2개(commands·device/authorize) + 서버 컴포넌트 3면(sessions 목록·상세·devices → `/billing/locked`).
- **`/billing/locked`**: 트라이얼 종료 화면 + Subscribe 버튼 2종. 실증 완료(DB 조작 시뮬레이션).
- **`/api/billing/status`**: 데몬용 읽기 전용. `active`·`daysLeft`·`cancelAtPeriodEnd`·`currentPeriodEnd`.
- **체크아웃**: `POST /api/dodo/checkout` (게이트웨이 경유, 내부 헤더 신뢰). body `{interval, origin}` → `checkout_url`. return_url = 클라 origin + `/sessions`.
- **취소/복원**: `POST /api/dodo/cancel`·`/resume` — Dodo `PATCH /subscriptions/{id}`의 `cancel_at_next_billing_date` 토글 + DB 즉시 반영(웹훅과 멱등). 프로필 UI: 취소 확정 모달, 취소 예정 시 "Subscription Ending" 배너 + "Keep subscription", 성공 시 `window.location.reload()`.
- **데몬 표시** (`localagents status`의 `billing:`): `Pro` / `Pro, cancels at YYYY-MM-DD` / `Trial, N days left` / `Subscription ended. Subscribe at localagents.link`. 403 수신 시 `BillingError`(cloud.ts) — 재시도 없이 안내로 종료.
- **test 모드 실증 완료(2026-10-26)**: 체크아웃(test 카드 $9.90) → 웹훅 실수신 → DB active → 게이트 통과 → 취소/복원 → 31일 만료 시뮬레이션. 연간 $90/yr 도달 확인. **단, 이건 상품이 있던 시점 기준. prod/live 카탈로그는 아직 비어 있음.**

## 온보딩 (2026-10-26~27 완료)
- 빈 화면(`SessionsEmptyState.tsx`): "No sessions yet." + 설치 방식 **탭 2개** — npx(기본, `One command. Nothing left behind.` 2단계) / npm(`Global install. Two steps.` 3단계: Install → login → Keep working). 사장 지시로 탭 분리("npx는 1로 끝나는데 npm은 2번 이상").
- 명령 칩은 랜딩 터미널 칩 문법(bg-black + border-line, `$` 초록), 칩별 독립 copied 표시(명령 문자열 기준, 탭 전환 시 초기화).
- `@latest` 붙인 이유: npx 캐시 낡은 버전 사고 방지.
- 저장소 다변화 버튼(npm/Homebrew/curl 탭)은 기각 — 사장 결정(A): npm 미게시 상태에선 npx+npm 2탭이 맞고, 저장소가 늘면 배열만 늘리면 되는 구조.
- PC↔PC 예고 한 줄: `Working on a second PC? Push a tab from there and it appears here.`
- **임시 `?isTest=1|true` 쿼리가 아직 살아 있음**: `/sessions`에서 목록을 빈 것처럼 취급(`SessionsPageServer.tsx` 삼항). 온보딩 인박스 전용 — 인박스 실운영 확인 후 제거. 커밋은 `[Fix] [isTest 임시 분기 제거]`.

## push/pull 웹 노출 (2026-10-27 완료)
- 설계 원칙: 정상 유저(자동 동기화만)에게 push/pull은 존재조차 안 보여야 한다. 하려는 순간(세션이 안 보일 때, 옮기고 싶을 때) 정확히 그 자리에만 뜬다.
- **목록 배지**(`SessionsPageServer.tsx`): Storage에 올라왔는데 내 기기가 안 받은 것 집계 → CLI pull 판정 규칙 동일(`receivedBy`가 내 기기면 숨김, 웹은 로컬 DB 대신 `cloud_tabs` 거울로 판정). 문구 3분지: `N new sessions from your other PC.` / `N sessions have newer versions.` / 둘 다면 `Updates waiting from your other PC: N new, N newer versions.` + `localagents pull` 칩 + `Run this on the PC you want the sessions on.` 대기 0이면 아무것도 안 뜸.
- "탭 대기 중" 문구 기각 사유: 이미 동기화 중인 탭(경우 2)과 안 가진 탭(경우 1)이 뒤섞여 뜻불명 — 사장 지적으로 신규/갱신 분리.
- **상세 접이식**(`SessionDetailClient.tsx` 우측 레일): "Move to another PC"(기본 접힘) — `localagents push` 칩 + `Run on the PC that has this tab. Then localagents pull on the other PC.`(웹은 안내만, 실행은 CLI — 원격 트리거는 v2).
- Arch 사이 push→이 Mac 인박스 배지 실측 확인 완료.

## 법률 문서 3종 (2026-10-27 완료, MoR 규격)
- `/legal/terms`(12조)·`/legal/privacy`(11조)·`/legal/refunds`(8조). `app/(main)/legal/*/page.tsx` + `components/page/legal/`(본문 마크다운 상수 `LegalMarkdownData.ts`, 공용 렌더러 `LegalPageClient.tsx`).
- 공개 페이지: 인증·게이트 없음, proxy matcher 회피, 페이지별 metadata(이제 `buildPageMetadata` 사용).
- 렌더러: `$ localagents legal` 프롬프트 라인 + h2 앵커 슬러그 + 우측 고정 ToC(mono) + 문의 메일.
- 핵심 내용 결정: 트라이얼 = 첫 활동+30일 무카드·31일 lock·데이터 보존 / 취소 = 기말 발효·데이터 보존 / **환불 = 14일 내 충전 1건 잔여 온정적 일할**(월간 3일째 취소 시 27/30×$9=$8.10) / 데이터 파기 없음·재구독 복원 / 서브프로세서 4개(Neon·Cloudflare·Dodo·OAuth Google/GitHub) / 관할 대한민국·서울중앙지법.
- `support@localagents.link` 문의처 기재됨. **사장이 메일 라우팅 추가(2026-10-27)** — 실제 수신 확인은 미완.
- Dodo 브랜드 설정에 3 URL 등록은 아직(사장 콘솔 작업).

## 기기 승인 화면 (2026-10-27 C3 완료)
- `DeviceAuthorizeClient.tsx`: `$ localagents login` 프롬프트 라인 + 기기 정보 카드(Name/Platform/Hostname — 승인 신뢰 결정 화면이라 정보 노출이 본질) + Platform 사람 언어 변환(darwin→macOS 등) + Connect(초록 CTA)/Cancel + 에러 text-stop.
- 원시 fetch → `postFetch`(baseFetch 래퍼).

## 프로필 페이지 (2026-10-26 완료)
- `/profile`: 서버 컴포넌트가 `neon_auth.user` 직독(이메일·이름·아바타·가입일) + `subscriptions` + 기기/세션 수 집계.
- **neon_auth 스키마 컬럼은 camelCase**(`createdAt`·`emailVerified`). `created_at`로 쓰면 컬럼 없음 크래시(실측).
- 클라이언트: 계정 카드 + 구독 카드 + 취소 모달 + Member since.
- 헤더 UserButton 드롭다운 Profile 링크: `UserMenuButton.tsx`(서버에서 ReactNode 아이콘 전달 불가 때문에 분리).
- Change Plan은 플랜 1개라 제외(v2), 결제 내역(Orders API) v1.5.

## 기기 해제 (2026-10-26 완료)
- `DELETE /api/devices?deviceId=`(게이트웨이 등록): 세션 주인 기기만(타인 404) → 토큰 전부 revoke + 기기 행 삭제.
- Devices 페이지: Unlink 버튼 + 확인 모달. 빈 화면 문구 옛 `register` → `login` 수정.
- 구분: `/api/device/revoke`는 데몬 본인 logout용, 웹 해제는 `/api/devices`.

## 로그인·콜백 (2026-10-24 완료)
- 고정 콜백 `/api/auth/callback`: `localagents_connect` 쿠키(기기 페어링 복귀) 있으면 소각하고 authorize로, 없으면 `/sessions`로.
- 근본 교훈: Neon verifier→세션 교환은 **미들웨어(proxy.ts)**에서 돈다. matcher에 인증 화면 등록 필수.
- **Neon Auth 신뢰 도메인**: 브랜치별로 `https://localagents.link`와 `https://localagents.lht1324.workers.dev` 등록 완료(dev·prod 양쪽). 없으면 `sign-in/social`이 `Invalid callbackURL` 403을 반환한다(실측). 도메인을 추가/변경하면 Neon Console 또는 Neon MCP(`add_auth_trusted_domain`)로 반드시 등록.

## Neon 상태 (2026-10-27)
- **production 마이그레이션 16/16 적용 완료**. 이전엔 1번뿐이라 prod로 전환하면 `/sessions`·`/profile`·과금 게이트가 500이 났다. public 테이블 11개: `cloud_folds` `cloud_messages` `cloud_tabs` `commands` `device_tokens` `devices` `handoffs` `model_catalog` `pending_approvals` `sessions_meta` `subscriptions`.
- prod 데이터: users 1 / devices 0 / sessions_meta 0. dev: users 1 / devices 2 / sessions_meta 13.
- production 브랜치 `br-red-morning-azc2kkl8` / development `br-solitary-tree-azkgbwbu`. 프로젝트 `patient-water-01729139`, org `org-orange-star-45087461` (Jaeho, free).
- prod Neon Auth base URL: `https://ep-late-night-az213oj2.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth`.
- **⚠️ `NEON_API_KEY`가 org 스코프**: 이 키로 프로젝트 목록을 조회하면 3개(`short-real`·`tailored-ad`·`cli-agents-dev`)가 전부 보인다. 즉 이 서비스가 뚫리면 tailored-ad까지 사정권. **프로젝트 스코프 키로 교체 권장**(미완). 용도는 `app/api/handoffs/url`의 Storage 서명 URL 발급 단 한 곳.
- Storage 고아 19개 삭제(~89MB 확보). 잔여 7개 = handoffs 1:1.
- 실측 버그 2건(미수정): `cloud_tabs.title` 세션 ID 저장, `sessions_meta` Mac 4행 msg 수 0 정체.

## 다음 할 일
- [ ] **Dodo 상품 등록** (월 $9·연 $90, metadata `{plan: "pro", interval: "monthly"|"annual"}`) — 이게 없어서 체크아웃이 실패한다. 등록 후 test 결제 1회 → 라이브 1회 실증
- [ ] `DODO_PAYMENTS_ENVIRONMENT` 최종값 확인 (키의 test/live와 짝이 맞는지). 짝이 틀리면 products 401
- [ ] Dodo prod 웹훅 URL 재등록 (`https://localagents.link/api/dodo/webhook`) + 서명 키 갱신
- [ ] Dodo 브랜드 설정에 법률 3 URL 등록 (사장 콘솔)
- [ ] prod 로그인 상태에서 `/sessions`·`/profile` 정상 렌더 확인 (사장)
- [ ] `support@localagents.link` 실제 수신 확인 (라우팅은 추가됨)
- [ ] `NEON_API_KEY`를 프로젝트 스코프 키로 교체
- [ ] Workers Builds 자동 배포 (master=production, develop=preview). Worker 이름과 `wrangler.jsonc`의 name 일치 필요
- [ ] 인박스 실운영 확인 후 `?isTest` 임시 분기 제거 (`[Fix] [isTest 임시 분기 제거]`)
- [ ] MoR: Fungies KYC 완료 대기 (심사 대기)
- [ ] 기기 해제 실사 테스트 (Arch에서 해제→`localagents login` 재연결. UI 완성, 동선만 검증)
- [ ] 랜딩 외 페이지 디자인 정합 (sessions 목록·상세 vs 랜딩 토큰) — authorize는 완료
- [ ] 게이트웨이 플로우 빠른 확인 (지시 전송·승인·모델 변경)
- [ ] 랜딩 남은 것 (실물 스크린샷 1600×1000·모바일 분리) — og:image·로고·파비콘 완료
- [ ] 방송·자동동기화 설계 확정 (v2. 복수 PC 행 + 주인-PC 원칙 + dirty·디바운스)
- [ ] v2 후보: 플랜 변경(월↔연)·결제 내역(Orders API)·세션 ID 어뷰징 검사·tombstone·탭 프로젝트 경로 문제·웹에서 push 원격 트리거 (outbox 명령 타입+데몬 핸들러, 진행상황이 TTY라 v2)
- [ ] `--help`·`doctor` (표면 안정 후)
- [ ] login Esc 문구 수정 (`Nothing picked` + `Done N sessions` 모순)
- [ ] GUI 검증 (Arch push → pull → 데스크톱 확인. 변환기 최종 판정)
- [ ] 실측 버그: `cloud_tabs.title` 세션 ID 저장 / `sessions_meta` msg 수 0 정체
- [ ] 알려진 노이즈: "script tag" 콘솔 경고 (NeonAuthUIProvider 내부 테마 스크립트. 무해)

## 커밋 이력 (최근)
- `6826313` [Feature] [Cloudflare Workers 배포 설정·auth 지연 초기화]
- `ba26d65` [Update] [OG 카드 문구를 OpenCode 단독으로 수정]
- `eee95d0` [Feature] [sitemap·robots·내부 페이지 noindex]
- `50026f4` [Feature] [로고·파비콘·OG 카드·메타데이터]
- `5a7b10e` [Update] [랜딩 푸터 법률 링크·트라이얼 자동 전환 없음 문구]
- `1846530` [Feature] [법률 문서 3종 페이지(TOS·Privacy·Refunds)]

## 실행 계획 (참고)
- P1: outbox·heartbeat 스키마 + 데몬 승인 중계 (완료)
- P2: 웹 inbox (보기·승인) + 기기 목록 (완료)
- P3: fork 실행·새 지시 (예약 실행 미완)
- P4: 도메인 연결·배포·과금 (도메인·배포 **완료** / 상품 등록·live 결제 남음)

## 아키텍처 요약 (상세는 이전 기록 참조)
- 로컬 데몬 + 클라우드 제어서버 (Next.js on Cloudflare Workers + Neon) + 웹 UI. 데몬은 아웃바운드 폴링(10초 빠른 층 + 플랜 주기 느린 층).
- Neon 역할 2개: 세션 거울 저장소 + 명령 outbox. PC↔PC 인계는 Neon Storage(서명 URL, `NEON_API_KEY` 서버 1개로 발급).
- OpenCode v1(1.18.x)/v2(2.x) 양쪽 대응: `daemon/src/convert.ts` 양방향 변환기. v1이 npm 기본 채널.
- CLI 표면: `login`·`status`·`whoami`·`push` (+숨김 진단 다수). 데몬 단일 설치 `npx localagents login`.
- 인계 모델: 웹↔클라이언트는 Neon DB(거울+outbox), 클라이언트↔클라이언트는 Storage 세션 파일(push마다 버전 1개 + DB 포인터).
- 토큰 API: `device_tokens`(해시·revoke) + `lib/auth/device.ts`. 게이트웨이가 세션 확인 후 `x-internal-secret`+`x-user-id` 주입(`lib/auth/internal.ts`, timingSafeEqual).
- 개명 이력: localagents (2026-10-06). 상표 주의: agentsync 계열 사용 금지 (AGENTSYNC 6836288호).
