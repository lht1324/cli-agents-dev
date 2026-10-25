2026-10-26 01:36

# context.md - cli-agents-dev

## 프로젝트
- 폴더: `cli-agents-dev` (구 `new_project`)
- 서비스 가명: localagents (명령어는 단수 `localagents`)
- 도메인: `localagents.link` 본선 + `cliagents.dev` 리다이렉트용. dev 터널 `dev.localagents.link`
- 스택: Next.js 16.3.6 (Turbopack) / TypeScript / Tailwind CSS

## 사업 아이템 (확정 방향)
- 다중에이전트 세션 온라인 관리. Claude Code + OpenCode 세션을 한 화면 통합 inbox로.
- 본체 = PC 간 탭 복원. 부속 = 웹 리모컨(보기·승인·새 지시, 실행은 PC 서버). 웹에 터미널 재현 없음.
- 웹 범위: 랜딩·요금제 + 프로필·구독 관리 + 원격 inbox.
- 레포 구조: 데몬은 같은 레포 `daemon/` 하위. 패키지 분리는 2번째 프로젝트 때.

## 개발 환경 (2026-10-25 포트 변경 확정)
- 클라 3004 (`npm run dev`) / API 컨테이너 3005:3000 (`npm run dev:api` + docker compose). 데몬 baseUrl 기본값 `localhost:3005`.
- `:3000`은 tailored-ad 서버 보호. ngrok은 데몬 전용 (Bearer 토큰), 브라우저는 localhost (세션 쿠키 도메인 귀속).
- 사장님이 ngrok → **Cloudflare Tunnel** 전환 (프로젝트별 dev 서브도메인). API 서브도메인이 3005로 향하는지 확인 필요했음.
- env 컨벤션: `NEXT_PUBLIC_BASE_URL`=브라우저→API (dev localhost:3005, 터널 URL 넣으면 로그인 깨짐) / `BASE_URL`=서버 외부 알림용 (웹훅 등) / `LOCALAGENTS_BASE_URL`=데몬 전용.
- CORS: 게이트웨이만. `CORS_ALLOWED_ORIGINS` (dev 기본값 localhost:3004).

## 과금 (2026-10-25~26 완성. 전 경로 실증)
- 요금제 확정: **단일 플랜 Pro $9/월·$90/연 (2개월 할인)**. 30일 no-card 트라이얼, 31일째 hard cutoff (유료 아니면 사용 불가). 데이터는 삭제하지 않고 보관 (재구독 시 복원).
- 결정 배경: 기기 수는 3대+ 유저가 적어 약한 훅 → 기각. Free 티어는 차별점 약함+비용 → 기각 (사장: "쳐내는 게 맞다"). 트라이얼 30일로 확정 (14일은 가치 확정 전 끊길 위험).
- 결제사 **Dodo** (MoR). 브랜드 `brnd_0NqSDEWhhRh98FCCuDWhy` (LocalAgents), 상품 월간 `pdt_0NqSIczhD3rElCnCCxUB1` / 연간 `pdt_0NqSId35FkZiLVrZaYNp3`, `trial_type: none` (트라이얼은 우리 DB 관리), metadata `{plan: pro, interval}`.
- 네이밍: 사용자 접점 전부 `LocalAgents`. `LocalAgentsLink`는 상호만.
- **Dodo 키 형식 주의**: 신형 키는 `sk_test_` 프리픽스가 없음 (예: `ds0wIEP...`). test/live는 **`DODO_PAYMENTS_ENVIRONMENT`** env로 명시 (`test_mode` | `live_mode`, SDK 공식 규약). 프리픽스 판정·런타임 프로브 금지 (Cloudflare edge에서 프로브 불가).
- 상품 ID 하드코딩 금지: 서버가 `products.list()`를 metadata `{plan, interval}`로 매핑 (1시간 캐시, 월·연 각 정확히 1개 아니면 loudly 실패. tailored-ad `dodoProducts.ts` 패턴).
- `.env` Dodo 관련 3개: `DODO_PAYMENTS_API_KEY` · `DODO_PAYMENTS_ENVIRONMENT` · `DODO_PAYMENTS_WEBHOOK_KEY`.
- **웹훅** (`app/api/dodo/webhook`): Standard Webhooks 규격 (webhook-id/signature/timestamp, HMAC-SHA256, node:crypto 수동 검증, 리플레이 5분). `subscription.active/renewed/updated` → upsert, `cancelled/expired` → status=canceled. 유저 매핑은 체크아웃 metadata `user_id`. 구독 ID는 `subscription_id` 우선 → `id` 폴백 (이벤트 버전별 위치 갈림 실측). 유저 미상은 200 무시, DB 장애는 500 재시도. 게이트웨이에 넣지 않음 (외부 직호출).
- **스키마**: `subscriptions`에 `dodo_subscription_id`·`status`·`interval`·`current_period_end`·`trial_ends_at` (0014) + `cancel_at_period_end` (0015) 추가. dev DB 마이그레이션 적용 완료.
- **과금 게이트** `lib/billing.ts`: 구독 active 통과 / `trial_ends_at` null이면 첫 API 활동+30일 초기화 / 만료 403 (`trial_ended`). 적용: 데몬 경로 4개 (sync GET/POST·messages·commands/next·handoffs/url) + 웹 fetch 2개 (commands·device/authorize) + 서버 컴포넌트 3면 (sessions 목록·상세·devices → `/billing/locked` redirect). heartbeat는 제외 (presence 유지).
- **`/billing/locked`**: 트라이얼 종료 화면 ("Trial ended. Your sessions are safe and waiting.") + Subscribe 버튼 2종. 실증 완료 (DB 조작 시뮬레이션으로).
- **`/api/billing/status`**: 데몬용 읽기 전용 (토큰 인증, 게이트 아님). `active`·`daysLeft`·`cancelAtPeriodEnd`·`currentPeriodEnd` 반환.
- **체크아웃**: `POST /api/dodo/checkout` (게이트웨이 경유, 내부 헤더 신뢰). body `{interval, origin}` → Dodo checkout 세션 → `checkout_url` 반환. return_url = 클라 origin + `/sessions`.
- **취소/복원**: `POST /api/dodo/cancel`·`/resume` — Dodo `PATCH /subscriptions/{id}`의 `cancel_at_next_billing_date` 토글 + DB 즉시 반영 (웹훅과 멱등). 프로필 UI: 취소 확정 모달, 취소 예정 시 "Subscription Ending" 배너 + "Keep subscription" 버튼, 성공 시 `window.location.reload()`로 즉시 반영.
- **데몬 표시** (`localagents status`의 `billing:` 라인): `Pro` / `Pro, cancels at YYYY-MM-DD` / `Trial, N days left` / `Subscription ended. Subscribe at localagents.link`. 플랜 이름 첫 글자 대문자 (사장 지시). 데몬 403 수신 시 `BillingError` (cloud.ts) — 재시도 없이 안내로 종료.
- **실증 완료**: 체크아웃(test 카드 $9.90 결제) → 웹훅 실수신 → DB active → 게이트 통과 → 취소/복원 플로우 → 31일 만료 시뮬레이션 (웹 locked + 데몬 감지). 가짜 이벤트 검증 (유효 서명 200 / 변조 401).
- 미검증: 연간 결제 플로우 (월간과 경로 동일해 위험 낮음).

## 프로필 페이지 (2026-10-26 완료)
- `/profile` (`app/(main)/profile/` + `components/page/profile/`): 서버 컴포넌트가 `neon_auth.user` 직독 (이메일·이름·아바타·가입일) + `subscriptions` + 기기/세션 수 집계.
- **neon_auth 스키마 컬럼은 camelCase** (`createdAt`·`emailVerified`). `created_at`로 쓰면 컬럼 없음 크래시 (실측).
- 클라이언트: 계정 카드(아바타·이메일·기기 수·세션 수) + 구독 카드(Plan/Billing cycle/Next billing + Cancel) + 취소 모달 + Member since.
- 헤더 UserButton 드롭다운에 **Profile 링크 추가**: `components/page/auth/UserMenuButton.tsx` (클라이언트 컴포넌트, `additionalLinks` prop 사용 — 서버 컴포넌트에서 ReactNode 아이콘 전달 불가 때문에 분리).
- 수동 개발: tailored-ad `ProfilePageClient.tsx` 참고. Change Plan은 플랜 1개라 제외 (v2), 결제 내역(Orders API) v1.5, 로고 업로드는 제품 특성상 제외.

## 기기 해제 (2026-10-26 완료)
- `DELETE /api/devices?deviceId=` (게이트웨이 등록): 세션 주인 기기만 (타인 404) → 토큰 전부 revoke + 기기 행 삭제. 해제된 데몬은 401 → not logged in.
- Devices 페이지: Unlink 버튼 + 확인 모달 ("can reconnect anytime with `localagents login`"). 빈 화면 문구도 옛 `register` → `login` 수정.
- 구분: `/api/device/revoke`는 데몬 본인 logout용 (기존), 웹 해제는 `/api/devices` (신규).

## Dodo 상품 생성 (2026-10-25)
- `products.create`가 `brand_id`를 생성 시 직접 받음. 상품명은 `Pro (Monthly)`/`Pro (Annual)` (브랜드가 체크아웃에 찍히므로 접두사 제거).
- 체크아웃 링크 2종(정적)은 동적 세션 API로 대체되어 보류.

## 랜딩·가격 UI (2026-10-25)
- `components/page/landing/pricing-section/`: Monthly $9/mo + Yearly $90/year (`$7.50/mo · billed annually` + `2 months free` 배지). Subscribe → 체크아웃 리다이렉트, 미로그인 401 → `/auth/sign-in`.
- 카피: "30-day free trial. No card required."

## 로그인·콜백 (2026-10-24 완료)
- 고정 콜백 라우트 `/api/auth/callback`: `localagents_connect` 쿠키(기기 페어링 복귀 경로) 있으면 소각하고 authorize로, 없으면 `/sessions`로. verifier query 계승.
- 근본 원인 교훈: Neon verifier→세션 교환은 **미들웨어(proxy.ts)**에서 돈다. matcher에 인증 화면(`/sessions`·`/devices`·`/device`) 등록 필수 — 안 걸면 SSR의 getSession이 세션을 못 봐 307 튕김.
- `app/auth/[path]/page.tsx`: callbackURL = 항상 `${origin}/api/auth/callback` (headers 기반). `app/api/device/begin`: 봉투 없이 고정 콜백 + 쿠키로 복귀 경로.

## Neon 조회·스토리지 정리 (2026-10-25)
- production 브랜치는 `devices`·`sessions_meta`만 있고 앱 테이블 전무 — **배포 때 마이그레이션 전체 적용 필요**.
- Storage 고아 19개 삭제 (~89MB 확보). 잔여 7개 = handoffs 1:1.
- 실측 버그 2건 (미수정): `cloud_tabs.title`이 세션 ID로 저장 (웹 목록에 ID 노출), `sessions_meta` Mac 4행 msg 수 0 정체.

## 다음 할 일
- [ ] Sessions 빈 화면 온보딩 (CLI 설치·`localagents login` 안내. 전환 직결)
- [ ] 연간 결제 플로우 확인 (프로필/랜딩에서 Subscribe $90/yr → Dodo 도달)
- [ ] 기기 해제 실사 테스트 (Arch 기기로 — 해제 후 `localagents login` 재연결 확인)
- [ ] device authorize 페이지 스타일 정리
- [ ] 랜딩 외 페이지 디자인 정합 (sessions 목록·상세 vs 랜딩 토큰)
- [ ] 배포 체크리스트: 도메인 연결 + Neon 콘솔 신뢰 도메인 등록 / Neon production 마이그레이션 전체 적용 / Cloudflare `DODO_PAYMENTS_ENVIRONMENT=live_mode`+라이브 키 / 웹훅 URL prod 재등록 / 약관 페이지 (결제사 규약 필수) / og:image
- [ ] MoR: Fungies 심사 대기
- [ ] 게이트웨이 플로우 빠른 확인 (지시 전송·승인·모델 변경 — 포트 변경 후 미검증이나 데몬 heartbeat/sync로 사실상 붙어 있음)
- [ ] 방송·자동동기화 설계 확정 (v2. 복수 PC 행 + 주인-PC 원칙 + dirty·디바운스)
- [ ] v2 후보: 플랜 변경(월↔연)·결제 내역(Orders API)·세션 ID 어뷰징 검사·tombstone·탭 프로젝트 경로 문제
- [ ] `--help`·`doctor` (표면 안정 후)
- [ ] login Esc 문구 수정 (`Nothing picked` + `Done N sessions` 모순)
- [ ] GUI 검증 (Arch push → pull → 데스크톱 확인. 변환기 최종 판정)
- [ ] 랜딩 남은 것 (실물 스크린샷 1600×1000·og:image·모바일 분리)
- [ ] 실측 버그: `cloud_tabs.title` 세션 ID 저장 / `sessions_meta` msg 수 0 정체
- [ ] 알려진 노이즈: "script tag" 콘솔 경고 (NeonAuthUIProvider 내부 테마 스크립트. 무해, prod 미발생. 기록용)

## 커밋 이력 (최근)
- `107423c` [Fix] [데몬 과금 표시 구분(취소 예정·만료)·프로필 취소 즉시 반영]
- `aa4f2b7` [Feature] [Devices 기기 해제 버튼·빈 화면 문구 수정]
- `d794b34` [Feature] [프로필 페이지·구독 취소/복원·드롭다운 Profile 링크]
- `b5d3603` [Feature] [Dodo 웹훅·과금 게이트·트라이얼 관리]
- `7472d71` [Update] [포트 분리 3004·3005 전환·Dodo 체크아웃 metadata 매핑 전환]
- `1dfd637` [Update] [과금·요금제 도입 계획 문서 추가] (PLAN-BILLING.md)

## 실행 계획 (참고)
- P1: outbox·heartbeat 스키마 + 데몬 승인 중계 (완료)
- P2: 웹 inbox (보기·승인) + 기기 목록 (완료)
- P3: fork 실행·새 지시 + 예약 실행 (예약 실행 미완)
- P4: 도메인 연결·배포·과금 (과금 완료. 도메인·배포 남음)

## 아키텍처 요약 (상세는 이전 기록 참조)
- 로컬 데몬 + 클라우드 제어서버 (Next.js + Neon) + 웹 UI. 데몬은 아웃바운드 폴링 (10초 빠른 층 + 플랜 주기 느린 층).
- Neon 역할 2개: 세션 거울 저장소 + 명령 outbox. PC↔PC 인계는 Neon Storage (서명 URL, `NEON_API_KEY` 서버 1개로 발급).
- OpenCode v1(1.18.x)/v2(2.x) 양쪽 대응: `daemon/src/convert.ts` 양방향 변환기. v1이 npm 기본 채널.
- CLI 표면: `login`·`status`·`whoami`·`push` (+숨김 진단 다수). 데몬 단일 설치 `npx localagents login`.
- 인계 모델: 웹↔클라이언트는 Neon DB (거울+outbox), 클라이언트↔클라이언트는 Storage 세션 파일 (push마다 버전 1개 + DB 포인터).
- 토큰 API: `device_tokens` (해시·revoke) + `lib/auth/device.ts`. 게이트웨이가 세션 확인 후 `x-internal-secret`+`x-user-id` 주입 (`lib/auth/internal.ts`, timingSafeEqual).
- 개명 이력: localagents (2026-10-06). 상표 주의: agentsync 계열 사용 금지 (AGENTSYNC 6836288호).
