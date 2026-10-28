# context.md - cli-agents-dev

2026-10-29 02:29

## 프로젝트
- 폴더: `cli-agents-dev` (구 `new_project`)
- 서비스 가명: localagents (명령어는 단수 `localagents`)
- 도메인: `localagents.link` 본선 + `cliagents.dev` 리다이렉트용. dev 터널 `dev.localagents.link`
- 스택: Next.js 16.3.6 (Turbopack) / TypeScript / Tailwind CSS
- 배포: **Cloudflare Workers** (`localagents.link` custom domain 연결 완료). OpenNext 어댑터
- 버전: `1.0.0` (2026-10-27 확정). master는 v1 릴리즈 머지 상태(`981a9ab`), prod 배포는 그 이전 코드.

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
- **배포 명령**: `npm run preview` / `npm run deploy`. 둘 다 앞에 `check:routes`가 붙어 있다(라우트 규칙 위반 시 중단).
- **빌드 전 `.env.local`을 반드시 밖으로 옮긴다**: OpenNext가 `.env*` 값을 `next-env.mjs`로 직렬화해 워커 번들에 넣는다. 절차 = `mv .env.local <임시>` → build/deploy → 복원.
- 데몬 설치 경로: `~/.local/bin/localagents` (셸 스크립트 → `daemon/dist/index.js` 실행). 재빌드 = `cd daemon && npm run build`, 서비스 재시작 = `systemctl --user restart localagents.service`.

## 개발 환경 교훈 (2026-10-27 실측)
- **API 컨테이너(3005)와 클라 dev(3004)의 기동 순서**: 컨테이너가 먼저 돌면 그쪽 next가 `.next`를 root 소유로 만들어 클라 dev가 `EACCES: mkdir .next/dev`로 죽는다. **순서는 항상 클라 dev 먼저 → 컨테이너 나중**.
- 잔해(.next root 소유) 정리는 `sudo rm -rf .next`.
- `node_modules` 없이 `npx tsc`를 치면 npm이 가짜 `tsc@2.0.4` 스텁을 설치한다. 타입체크는 `node_modules` 확인부터.
- **prod 빌드는 dev 서버와 `.next`를 공유한다**: dev(3004)를 내리고 빌드한다.
- `opennextjs-cloudflare build`는 `next build`를 자기가 돌린다 (`package.json` build 스크립트 안 거침).
- **dev는 같은 `.next`를 두 서버가 쓰지만, API 라우트는 컨테이너(3005)가 처리한다**: 브라우저의 `baseFetch`는 `NEXT_PUBLIC_BASE_URL=http://localhost:3005`로 나가고, 게이트웨이가 같은 프로세스 핸들러를 직접 호출한다(S2S fetch 아님).
- **게이트웨이 요청은 로그에 `/api/client-gateway?path=...` 한 줄만 남는다**: 내부 핸들러는 네트워크를 안 타므로 `/api/web/...` 줄이 따로 찍히지 않는다.

## API 구조 (2026-10-29 확정)
경로 접두사 = 인증 채널. 규칙은 `npm run check:routes`가 강제한다(`scripts/check-route-auth.mjs`).

```
app/api/
  auth/        Neon Auth 핸들러 + OAuth 콜백          (공개/벤더)
  pairing/     begin·consume·pack                    (공개, 로그인 흐름)
  web/         브라우저 → 게이트웨이 → S2S            (messages·commands·devices·device/authorize·dodo 3종)
  daemon/      CLI·데몬 → 기기 토큰                    (sync·messages·heartbeat·handoffs·commands 3종·billing/status·whoami·device/revoke)
  webhook/     서드파티 서명 검증                      (dodo)
  client-gateway/  web 채널 단일 진입점
```

- **인증 판정 단일 출처** `lib/utils/getIsValidRequest.ts`:
  - `getIsValidRequestC2S()` → 세션 쿠키. 진입점(게이트웨이·pairing/begin)에서만.
  - `getIsValidRequestS2S(req)` → `x-internal-secret`(+`x-user-id`). 게이트웨이 뒤 라우트 전용. `timingSafeEqual`.
  - `getIsValidRequestDevice(req)` → 기기 Bearer 토큰. 데몬 라우트 전용.
  - 모두 "신원 또는 null" 반환 → 라우트는 null 검사 한 번으로 끝난다. `lib/auth/internal.ts`는 삭제(이관).
- 게이트웨이는 `/api/web/**` 외 경로를 400으로 거부하고, 매칭된 핸들러를 **같은 프로세스에서 직접 호출**한다(self-fetch 금지: 워커 자기 도메인 호출은 edge에서 깨짐).
- 웹훅은 게이트웨이에 넣지 않는다(Dodo가 외부에서 직호출, HMAC 검증).

## 배포 (2026-10-27 완료, Cloudflare Workers)
- **구성**: `wrangler.jsonc` (name `localagents`, `compatibility_date` 2026-09-01, `nodejs_compat`, ASSETS 바인딩, observability 로그) + `open-next.config.ts` + `package.json` 스크립트.
- **어댑터 버전 고정**: `@opennextjs/cloudflare` **1.20.6 정확히 고정**. `^`로 두면 1.20.13이 잡히며 `next >=16.4.1` 요구로 peer 충돌. wrangler `^4.153.0`.
- **`open-next.config.ts`**: `staticAssetsIncrementalCache` 필수. 기본 더미 캐시는 SSG 라우트를 404로 만든다.
- **`wrangler.jsonc`의 vars는 비어 있다**: 런타임 설정이 전부 Secrets. 배포 시 이 파일의 vars가 대시보드 plain Variables를 덮어쓴다(Secrets는 안 덮음).
- **`app/(main)/layout.tsx`에 `export const dynamic = "force-dynamic"`**: 세션으로 헤더를 바꾸는 레이아웃이라 하위 페이지가 본질적으로 동적. 없으면 빌드가 env를 요구하며 죽는다(실측).
- **auth 지연 초기화** (`getAuth()`): `createNeonAuth`가 즉시 쿠키 secret을 검증하고 throw하므로, 워커 엔트리 정적 import 시점 평가를 피해 요청 시점으로 미뤘다.
- **크기**: gzip 3.47MB / 업로드 15.6MB (유료 한도 10MB 이내, 무료 3MiB 초과).
- **알려진 경고**: `Node.js middleware support is experimental in cloudflare`. Next 16 `proxy.ts`가 Node 미들웨어로 번들된다. 제거 불가(OAuth 교환이 여기서 돈다).
- **시크릿 11개**: `DATABASE_URL` `NEON_AUTH_BASE_URL` `NEON_AUTH_COOKIE_SECRET` `NEON_API_KEY` `NEON_PROJECT_ID` `NEON_BRANCH_ID` `DEVICE_PACKET_KEY` `DODO_PAYMENTS_API_KEY` `DODO_PAYMENTS_ENVIRONMENT` `DODO_PAYMENTS_WEBHOOK_KEY` `INTERNAL_FIRE_AND_FORGET_API_SECRET`.
- **prod 전환 완료**: Worker 시크릿이 production 브랜치를 본다(로그인 init URL `ep-late-night-az213oj2`).
- **미완**: Workers Builds 자동 배포 미설정 (master=production / develop=preview 계획).

## 브랜드 자산·SEO (2026-10-27 완료)
- 로고: `public/logo/logo.svg`(512 타일) · `logo-glyph.svg`(투명) · `logo-32/180/512.png`. 손으로 쓴 SVG.
- `components/public/BrandMark.tsx`: next/image 리샘플 뭉개짐 때문에 원본 SVG를 `<img>`로 직접 로드. 헤더 2곳 24px.
- **OG 카드**: `app/dev/og` + `components/page/dev/OgCardPageClient.tsx` (1200×630, `html-to-image` 2배 캡처 → 2400×1260). 산출물 `public/og/og.png`. noindex.
- **메타 단일 소스** `lib/site.ts`: `SITE_URL`(하드코딩) · `SITE_TITLE` · `SITE_DESCRIPTION` · `buildPageMetadata()` · `NOINDEX_METADATA`.
  - `buildPageMetadata`를 쓰는 이유: 루트 layout의 `openGraph`를 상속하면 법률 페이지 `og:url`이 전부 홈으로 박힌다(실측 버그).
- `app/sitemap.ts`(4 URL) · `app/robots.ts` · `public/llms.txt`.
- **내부 화면은 메타 noindex**: robots disallow는 크롤러가 메타를 못 읽어 URL만 검색에 남는다.
- JSON-LD: `WebSite` + `SoftwareApplication`($9/$90). FAQ·HowTo 스키마는 의도적 제외.
- 카피 원칙: 사용자 노출 문구에 em dash(`—`/`–`)·AI 상투어 금지. 현재 0건.

## 과금 (2026-10-25~29. live 실결제만 남음)
- 요금제 확정: **단일 플랜 Pro $9/월·$90/연 (2개월 할인)**. 30일 no-card 트라이얼, 31일째 hard cutoff. 데이터는 삭제하지 않고 보관(재구독 시 복원).
- 결정 배경: 기기 수 훅은 약함 → 기각. Free 티어는 차별점 약함+비용 → 기각(사장: "쳐내는 게 맞다"). 트라이얼 30일.
- 결제사 **Dodo** (MoR). 브랜드 test `brnd_0NqSDEWhhRh98FCCuDWhy` / live `brnd_0NosKxf8s7qyYWiuNXBE6` (모드별로 브랜드도 별개).
- **상품 live 복사 완료(2026-10-28)**: `Pro (Monthly)` $9 / `Pro (Annual)` $90, metadata `{plan: "pro", interval}`. **상품 ID는 모드별로 다르다** — 코드는 ID를 모르고 metadata로 매핑한다.
- **상품 ID 하드코딩 금지**: `products.list()`를 metadata로 매핑(1시간 캐시, 월·연 각 정확히 1개 아니면 loudly 실패).
- **Dodo 키**: 신형 키는 `sk_test_` 프리픽스 없음. test/live는 `DODO_PAYMENTS_ENVIRONMENT`(`test_mode`|`live_mode`)로만 판정. 프리픽스 판정·런타임 프로브 금지.
- **웹훅** (`app/api/webhook/dodo/route.ts`): Standard Webhooks(HMAC-SHA256, 리플레이 5분). `subscription.active/renewed/updated` → upsert, `cancelled/expired` → status=canceled. 구독 ID는 `subscription_id` 우선 → `id` 폴백. 유저 미상 200 무시, DB 장애 500 재시도.
  - **경로가 `/api/dodo/webhook` → `/api/webhook/dodo`로 변경됐다. Dodo 대시보드 URL을 아직 안 바꿨으면 live 결제가 DB에 반영되지 않는다.**
- **스키마**: 0014(구독 5컬럼) + 0015(`cancel_at_period_end`).
- **과금 게이트** `lib/billing.ts`: active 통과 / `trial_ends_at` null이면 첫 API 활동+30일 / 만료 403(`trial_ended`). 적용: 데몬 4경로 + 웹 fetch 2 + 서버 컴포넌트 3면.
- **체크아웃**: `POST /api/web/dodo/checkout` (게이트웨이 경유). **연락처 프리필**: 계정 이름·이메일을 넣고, 이메일은 수정 불가(`allow_customer_editing_email:false`), 이름은 수정 가능. DB에 이메일이 없으면 잠그지 않는다(빈 칸 결제 불가 방지).
- **취소/복원**: `PATCH /subscriptions/{id}`의 `cancel_at_next_billing_date` 토글 + DB 즉시 반영(웹훅과 멱등). 프로필 UI는 성공 시 reload.
- **데몬 표시**: `Pro` / `Pro, cancels at YYYY-MM-DD` / `Trial, N days left` / `Subscription ended...`. 403은 `BillingError`로 재시도 없이 종료.
- **test 모드 전 경로 실증 완료**: 체크아웃 → 웹훅 → DB → 게이트 → 취소/복원 → 만료 시뮬레이션. 연간 도달 확인.
- **live**: 상품 복사·체크아웃 도달까지 확인. **실결제 1건은 미실시.**

## 온보딩 (2026-10-26~27 완료)
- 빈 화면(`SessionsEmptyState.tsx`): "No sessions yet." + 설치 방식 탭 2개 — npx(기본, 2단계) / npm(3단계).
- 명령 칩은 랜딩 터미널 칩 문법. 칩별 독립 copied 표시.
- `@latest`는 npx 캐시 낡은 버전 사고 방지.
- PC↔PC 예고 한 줄: `Working on a second PC? Push a tab from there and it appears here.`
- `?isTest` 임시 분기는 **제거 완료**(`c6e8f9a`).

## push/pull 웹 노출 (2026-10-27 완료)
- 원칙: 정상 유저에게 push/pull은 존재조차 안 보인다. 필요한 순간에만 그 자리에.
- **목록 배지**: Storage에 올라왔는데 내 기기가 안 받은 것 집계(CLI pull과 동일 규칙). 문구 3분지(신규/갱신/둘 다). 해제한 기기는 판정에서 제외.
- **상세 접이식**: "Move to another PC" — `localagents push` 칩 + pull 안내. 기본 접힘.
- Arch 사이 push→인박스 배지 실측 완료.

## 법률 문서 3종 (2026-10-27 완료, MoR 규격)
- `/legal/terms`(12조)·`/legal/privacy`(11조)·`/legal/refunds`(8조). `components/page/legal/`.
- 핵심: 트라이얼 첫 활동+30일·31일 lock·데이터 보존 / 취소 기말 발효 / **환불 14일 내 잔여 일할**(월간 3일째 27/30×$9=$8.10) / 서브프로세서 4개 / 관할 대한민국·서울중앙지법.
- `support@localagents.link` 기재(라우팅 추가됨, 실제 수신 확인 미완).
- 랜딩 푸터에 3개 링크. Pricing 문구: `No card required. Nothing auto-starts after the trial.`
- Dodo 브랜드 설정에 법률 3 URL 등록은 아직.

## 세션 소유권·기기 선택 (2026-10-29 완료)
- **소유는 계정**: `sessions_meta.user_id` 추가(백필: devices에서). 목록·프로필·상세가 `devices` 조인 대신 `user_id`로 유저를 판정한다.
- **`device_id`는 "현재 호스트"**: 명령 라우팅·presence 판정에만 쓴다. 소유가 아니다.
- **`session_locations(tab_id, device_id, last_seen_at)`** 신규: push/pull로 같은 세션이 여러 PC에 존재할 수 있어 N:M. sync마다 upsert, 그 기기에서 사라진 세션은 그 기기 행만 삭제.
- **상세 화면 명령 대상**: **활성 기기만** 후보(heartbeat 2분 이내). 기본값 = `sessions_meta.device_id`가 활성이면 그것, 아니면 최근 활성. **활성 기기 0이면 쓰기 전부 차단**(메시지·에이전트·모델·승인). 읽기는 허용.
- **승인은 선택 대상이 아니다**: 그 프롬프트를 띄운 기기에 귀속. 비활성이면 버튼 비활성.
- **서버도 강제**: `POST /api/web/commands`가 대상 기기의 소유·비활성(409)·세션 소유를 검증. UI 우회 방지.
- **`commands.tab_id` 컬럼 승격**: payload JSON에 숨던 sessionID를 컬럼으로. 상세 화면이 마지막 명령과 실행 결과를 표시한다(`last message: done · sent to ...`).
- **모델·Variant 표시**: OpenCode와 동일하게 **미지정이 정상 상태**. 카탈로그에 없는 모델(내려간 모델)은 `(none)`으로 표시하고, 목록에 없는 값을 선택된 것처럼 보여주지 않는다. 모델 `(none)`은 선택 불가(지우기 명령 없음), Variant `(none)`은 선택 가능.
- **아직 v2**: 명령 브로드캐스트(세션 타겟 + 선착순 클레임). 지금은 "활성 기기 명시 선택"으로 회피.

## 기기 해제·재연결 (2026-10-29 완료)
- **소프트 삭제로 전환**: `devices` 행을 지우면 7개 테이블 FK에 걸린다(실측 500). 해제 = 토큰 revoke + `unlinked_at` 기록 + 목록에서 숨김 + 그 기기의 대기 명령 만료 + `pending_approvals`·`session_locations` 정리. 세션·대화 기록은 보존.
- **재로그인 자동 연결**: 로그인 세션이 그 기기의 주인과 같고 해제된 적이 없으면 **승인 화면을 건너뛰고** 토큰을 발급해 데몬 콜백으로 302. 최초 연결/다른 계정/해제된 기기만 Connect 화면을 띄운다. 토큰 발급은 `lib/device/link.ts` 한 곳.
- **logout은 토큰만 회수**(기기 행 유지). 그래서 "로그아웃 후 로그인"은 유저에게 같은 기기로 보인다.
- `localagents login`은 토큰이 살아있으면 브라우저를 열지 않고 "already logged in" 후 종료.

## 데몬 status 진단 (2026-10-29 수정)
- 이전에는 401도 `cloud unreachable`로 뭉개고 billing 실패는 아예 침묵했다.
- 지금: 401 `not logged in` / 403 `subscription required` / 기타 `http 500` / 네트워크 `cloud unreachable`. 401이면 마지막에 `hint: run localagents login to reconnect.`

## 기기 승인 화면 (2026-10-27 완료)
- `DeviceAuthorizeClient.tsx`: `$ localagents login` 프롬프트 + 기기 정보 카드(Name/Platform/Hostname) + 사람 언어 변환(darwin→macOS) + Connect/Cancel + 에러 text-stop.
- 최초·재승인 경로에서만 노출(자동 연결은 화면 없이 통과).

## 프로필 페이지 (2026-10-26 완료)
- `/profile`: `neon_auth."user"` 직독 + `subscriptions` + 기기/세션 수.
- **neon_auth 컬럼은 camelCase**(`createdAt`·`emailVerified`). `created_at`은 크래시.
- Change Plan은 플랜 1개라 제외(v2), 결제 내역(Orders API) v1.5.

## 로그인·콜백 (2026-10-24 완료)
- 고정 콜백 `/api/auth/callback`: `localagents_connect` 쿠키(기기 페어링 복귀) 있으면 소각하고 authorize로, 없으면 `/sessions`로.
- Neon verifier→세션 교환은 **미들웨어(proxy.ts)**에서 돈다. matcher에 인증 화면 등록 필수.
- **Neon Auth 신뢰 도메인**: `localagents.link`와 `localagents.lht1324.workers.dev` 등록 완료(dev·prod). 없으면 `Invalid callbackURL` 403.
- **세션 데이터 캐시**: `sessionDataTtl` 900초로 상향(기본 300). 5분 캐시가 짧아 새로고침이 몰리면 upstream `/get-session`이 429를 맞고, 실패 시 쿠키가 안 생겨 재시도 악순환이 됐다(실측). 429가 다시 보이면 TTL·동시 요청을 함께 본다.

## Neon 상태 (2026-10-29)
- **dev**: 마이그레이션 18/18 적용(0016·0017 포함). 세션 13 / 기기 2 / 위치 추적 동작.
- **prod**: 마이그레이션 **16/18**. 아래 4개가 없어 **배포 전 적용 필수**(실측):
  - `sessions_meta.user_id` 없음
  - `session_locations` 테이블 없음
  - `devices.unlinked_at` 없음
  - `commands.tab_id` 없음
- public 테이블(dev 기준 12개): `cloud_folds` `cloud_messages` `cloud_tabs` `commands` `device_tokens` `devices` `handoffs` `model_catalog` `pending_approvals` `session_locations` `sessions_meta` `subscriptions`.
- production `br-red-morning-azc2kkl8` / development `br-solitary-tree-azkgbwbu`. 프로젝트 `patient-water-01729139`, org `org-orange-star-45087461`.
- **⚠️ `NEON_API_KEY`가 org 스코프**: 이 서비스가 뚫리면 tailored-ad까지 사정권. 프로젝트 스코프 키로 교체 권장(미완). 용도는 `daemon/handoffs/url` 서명 URL 발급 한 곳.
- Storage 고아 19개 삭제(~89MB). 잔여 7개 = handoffs 1:1.
- 실측 버그 2건(미수정): `cloud_tabs.title` 세션 ID 저장 / `sessions_meta` Mac 4행 msg 수 0 정체.

## 다음 할 일

### 출시 전 필수
- [ ] **prod 마이그레이션 0016·0017 적용** — 없으면 배포 후 `/sessions`·`/profile` 500. prod 세션 0건이라 백필 즉시 끝
- [ ] **`npm run deploy`** — dev 서버(3004) 종료 + `.env.local` 밖으로 이동 후 실행
- [ ] **Dodo 웹훅 URL 교체** → `https://localagents.link/api/webhook/dodo` (안 하면 live 결제가 DB에 반영 안 됨)
- [ ] **live $9 실결제 1건** → DB에서 `status=active`·`dodo_subscription_id` 확인 → 환불
- [ ] prod 로그인 상태에서 `/sessions`·`/profile` 렌더 확인
- [ ] Dodo 브랜드 설정에 법률 3 URL 등록
- [ ] `support@localagents.link` 실제 수신 확인

### 출시 후
- [ ] Workers Builds 자동 배포 (master=production / develop=preview)
- [ ] `NEON_API_KEY`를 프로젝트 스코프로 교체
- [ ] 세션 캐시 429 재발 관찰 (TTL 900 적용 후)
- [ ] 명령 브로드캐스트 v2 (세션 타겟 + 선착순 클레임 + 활성 판정)
- [ ] heartbeat에 OpenCode 실행 여부 추가 ("기기는 켜졌는데 OpenCode가 꺼짐" 구분)
- [ ] 랜딩 잔여: 실물 스크린샷 1600×1000 · 모바일 분리
- [ ] 랜딩 외 페이지 디자인 정합 (sessions 목록·상세)
- [ ] GUI 검증 (Arch push → pull → 데스크톱. 변환기 최종 판정)
- [ ] 실측 버그: `cloud_tabs.title` 세션 ID 저장 / `sessions_meta` msg 수 0
- [ ] `--help`·`doctor`, login Esc 문구(`Nothing picked` + `Done N sessions` 모순)
- [ ] MoR: Fungies KYC 완료 대기
- [ ] v2 후보: 플랜 변경(월↔연)·결제 내역(Orders API)·세션 ID 어뷰징 검사·tombstone·탭 프로젝트 경로 문제·웹에서 push 원격 트리거
- [ ] 알려진 노이즈: "script tag" 콘솔 경고 (NeonAuthUIProvider 테마 스크립트, 무해)

## 커밋 이력 (최근)
- `1793a1c` [Fix] [status 401 진단 문구·세션 데이터 캐시 TTL 상향]
- `70217a4` [Refactor] [billing/locked 체크아웃 호출을 dodoClientAPI로 전환]
- `648094c` [Feature] [세션 계정 귀속·기기 위치 추적·활성 기기 선택·기기 소프트 삭제]
- `1b62fe3` [Refactor] [API를 web/daemon/pairing/webhook으로 분리·인증 채널 통합·라우트 검사 스크립트]
- `c6e8f9a` [Fix] [isTest 임시 분기 제거·v1.0.0 버전 확정]
- `a478cb5` [Feature] [체크아웃 연락처 프리필(이메일 고정·이름 수정 가능)]
- `981a9ab` [Merge] [v1 릴리즈: 인박스·과금·법률·Cloudflare 배포] (master)

## 실행 계획 (참고)
- P1: outbox·heartbeat 스키마 + 데몬 승인 중계 (완료)
- P2: 웹 inbox(보기·승인) + 기기 목록 (완료)
- P3: fork 실행·새 지시 (예약 실행 미완)
- P4: 도메인·배포 (완료) / 과금 (live 실결제만 남음)

## 아키텍처 요약 (상세는 이전 기록 참조)
- 로컬 데몬 + 클라우드 제어서버 (Next.js on Cloudflare Workers + Neon) + 웹 UI. 데몬은 아웃바운드 폴링(10초 빠른 층 + 플랜 주기 느린 층).
- Neon 역할 2개: 세션 거울 저장소 + 명령 outbox. PC↔PC 인계는 Neon Storage(서명 URL, `NEON_API_KEY` 서버 1개로 발급).
- OpenCode v1(1.18.x)/v2(2.x) 양쪽 대응: `daemon/src/convert.ts`. v1이 npm 기본 채널.
- CLI 표면: `login`·`status`·`whoami`·`push` (+숨김 진단 다수). 데몬 단일 설치 `npx localagents login`.
- 인계 모델: 웹↔클라이언트는 Neon DB(거울+outbox), 클라이언트↔클라이언트는 Storage 세션 파일(push마다 버전 1개 + DB 포인터).
- 인증 3채널: C2S(세션, 진입점) / S2S(내부 secret, 게이트웨이 뒤) / DEVICE(기기 토큰, 데몬). 판정은 `lib/utils/getIsValidRequest.ts` 한 곳.
- 개명 이력: localagents (2026-10-06). 상표 주의: agentsync 계열 사용 금지 (AGENTSYNC 6836288호).
