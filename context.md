# context.md - cli-agents-dev

2026-10-27 02:35

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
- `:3000`은 tailored-ad 서버 보호. 데몬은 Cloudflare Tunnel 전용 (Bearer 토큰), 브라우저는 localhost (세션 쿠키 도메인 귀속).
- env 컨벤션: `NEXT_PUBLIC_BASE_URL`=브라우저→API (dev localhost:3005, 터널 URL 넣으면 로그인 깨짐) / `BASE_URL`=서버 외부 알림용 (웹훅 등) / `LOCALAGENTS_BASE_URL`=데몬 전용.
- CORS: 게이트웨이만. `CORS_ALLOWED_ORIGINS` (dev 기본값 localhost:3004).

## 개발 환경 교훈 (2026-10-27 실측)
- **API 컨테이너(3005)와 클라 dev(3004)의 기동 순서**: 컨테이너가 먼저 돌면 그쪽 next가 `.next`를 root 소유로 만들어 클라 dev가 `EACCES: mkdir .next/dev`로 죽는다. **순서는 항상 클라 dev 먼저 → 컨테이너 나중**. 이 순서로 사장 실측 해결.
- 잔해(.next root 소유) 정리는 `sudo rm -rf .next` (root 재본화 문제라 sudo 필요).
- `node_modules` 사라진 상태로 `npx tsc`를 치면 npm이 가짜 패키지 `tsc@2.0.4`(스텁)를 설치한다. 타입체크는 의존성 설치 확인부터.

## 과금 (2026-10-25~26 완성. 전 경로 실증, 연간 도달 확인 완료)
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
- **실증 완료**: 체크아웃(test 카드 $9.90) → 웹훅 실수신 → DB active → 게이트 통과 → 취소/복원 → 31일 만료 시뮬레이션 (웹 locked + 데몬 감지). 가짜 이벤트 검증 (유효 서명 200 / 변조 401). **연간 $90/yr 체크아웃 도달 확인 완료 (2026-10-26)** — 결제 실행까지는 경로 동일이라 생략 (사장 판정).

## 온보딩 (2026-10-26~27 완료)
- 빈 화면(`SessionsEmptyState.tsx`): "No sessions yet." + 설치 방식 **탭 2개** — npx(기본, `One command. Nothing left behind.` 2단계) / npm(`Global install. Two steps.` 3단계: Install → login → Keep working). 사장 지시로 탭 분리 ("npx는 1로 끝나는데 npm은 2번 이상").
- 명령 칩은 랜딩 터미널 칩 문법 (bg-black + border-line, `$` 초록), 칩별 독립 copied 표시 (명령 문자열 기준, 탭 전환 시 초기화).
- `@latest` 붙인 이유: npx 캐시 낡은 버전 사고 방지 (stale dist 교훈과 동류).
- 저장소 다변화 버튼(npm/Homebrew/curl 탭)은 기각 — 사장 결정(A): npm 미게시 상태에선 npx+npm 2탭이 맞고, 저장소 늘어나는 게 확정될 때 배열만 늘리면 되는 구조가 됨.
- PC↔PC 예고 한 줄: `Working on a second PC? Push a tab from there and it appears here.` (온보딩 카드 하단).
- **임시 `?isTest=1|true` 쿼리가 아직 살아 있음**: `/sessions`에서 목록을 빈 것처럼 취급 (스키마: `SessionsPageServer.tsx` 삼항). 온보딩 인박스 전용 — 인박스 실운영 확인 후 제거. 제거 커밋은 `[Fix] [isTest 임시 분기 제거]`.

## push/pull 웹 노출 (2026-10-27 완료)
- 설계 원칙: 정상 유저(자동 동기화만)에게 push/pull은 존재조차 안 보여야 한다. 하려는 순간(세션이 안 보일 때, 옮기고 싶을 때) 정확히 그 자리에만 뜬다.
- **목록 배지** (`SessionsPageServer.tsx`): Storage에 올라왔는데 내 기기가 안 받은 것 집계 → CLI pull 판정 규칙 동일 (`receivedBy`가 내 기기면 숨김, 웹은 로컬 DB 대신 `cloud_tabs` 거울로 탭 존재 판정). 문구 3분지: `N new sessions from your other PC.` / `N sessions have newer versions.` / 둘 다면 `Updates waiting from your other PC: N new, N newer versions.` + `localagents pull` 칩 + `Run this on the PC you want the sessions on.` 대기 0이면 아무것도 안 뜸.
- "탭 대기 중" 문구 기각 사유: 이미 동기화 중인 탭(경우 2)과 안 가진 탭(경우 1)이 뒤섞여 뜻불명 — 사장 지적으로 신규/갱신 분리.
- **상세 접이식** (`SessionDetailClient.tsx` 우측 레일): "Move to another PC" (기본 접힘) — `localagents push` 칩 + `Run on the PC that has this tab. Then localagents pull on the other PC.` (웹은 안내만, 실행은 CLI — 원격 트리거는 v2)
- Arch 사이 push→이 Mac 인박스 배지 실측 확인 완료.

## 법률 문서 3종 (2026-10-27 완료, MoR 규격)
- `/legal/terms` (12조)·`/legal/privacy` (11조)·`/legal/refunds` (8조). `app/(main)/legal/*/page.tsx` + `components/page/legal/` (본문 마크다운 상수 `LegalMarkdownData.ts`, 공용 렌더러 `LegalPageClient.tsx`).
- 공개 페이지: 인증·게이트 없음, proxy matcher 회피, 영어 metadata 각 페이지 export.
- 렌더러: `$ localagents legal` 프롬프트 라인 + h2 앵커 슬러그(ToC 생성 동일 규칙) + 우측 고정 ToC (mono) + 문의 메일. TOS/Privacy/Refunds 3종 모두 (Dodo KYC 요구 3종).
- 핵심 내용 결정 (코드에 반영된 사업 결정): 트라이얼 = 첫 활동+30일 무카드·31일 lock·데이터 보존 / 취소 = 기말 발효·데이터 보존 / **환불 = 14일 내 충전 1건 잔여 온정적 일할** (크레딧 제품이 아니라 일할이 깔끔). 예: 월간 3일째 취소 27/30×$9=$8.10 / 데이터 파기 없음·재구독 복원 (31일 컷 설계의 문서 근거) / 서브프로세서 4개 (Neon·Cloudflare·Dodo OAuth Google/GitHub) / 관할 대한민국·서울중앙지법 (tailored-ad와 동일).
- **미설정**: 문의 메일 `support@localagents.link`는 문서에 기재됐지만 실제 메일 생성은 사장님 영역. Dodo 브랜드 설정(`brnd_0NqSDEWhhRh98FCCuDWhy`)에 3 URL 등록은 prod 세팅 때 사장님 콘솔.
- 랜딩 연결 완료: 푸터에 Terms·Privacy·Refunds 링크 3개 (최하단 스테이터스 라인 우측, mono dim) / Pricing 문구 보강: `30-day free trial. No card required. Nothing auto-starts after the trial.` — "No auto-renew" 기각된 이유: 유료 구독 자동 갱신(정책상 사실)과 충돌 → "no silent conversion" 뜻으로 전달.

## 기기 승인 화면 (2026-10-27 C3 완료)
- `DeviceAuthorizeClient.tsx` 재작성: `$ localagents login` 프롬프트 라인 + 기기 정보 카드 (Name/Platform/Hostname 정의 리스트 — 승인 신뢰 결정 화면이라 정보 노출이 본질) + Platform 사람 언어 변환 (darwin→macOS 등) + Connect(초록 CTA)/Cancel 2버튼 + 에러 text-stop.
- 원시 fetch → `postFetch` (baseFetch 래퍼) 전환.

## 프로필 페이지 (2026-10-26 완료)
- `/profile` (`app/(main)/profile/` + `components/page/profile/`): 서버 컴포넌트가 `neon_auth.user` 직독 (이메일·이름·아바타·가입일) + `subscriptions` + 기기/세션 수 집계.
- **neon_auth 스키마 컬럼은 camelCase** (`createdAt`·`emailVerified`). `created_at`로 쓰면 컬럼 없음 크래시 (실측).
- 클라이언트: 계정 카드 + 구독 카드 + 취소 모달 + Member since.
- 헤더 UserButton 드롭다운 **Profile 링크**: `UserMenuButton.tsx` (클라이언트 래퍼 — 서버에서 ReactNode 아이콘 전달 불가 때문에 분리).
- Change Plan은 플랜 1개라 제외 (v2), 결제 내역(Orders API) v1.5.

## 기기 해제 (2026-10-26 완료)
- `DELETE /api/devices?deviceId=` (게이트웨이 등록): 세션 주인 기기만 (타인 404) → 토큰 전부 revoke + 기기 행 삭제. 해제 데몬은 401 → not logged in.
- Devices 페이지: Unlink 버튼 + 확인 모달. 빈 화면 문구 옛 `register` → `login` 수정.
- 구분: `/api/device/revoke`는 데몬 본인 logout용 (기존), 웹 해제는 `/api/devices` (신규).

## 로그인·콜백 (2026-10-24 완료)
- 고정 콜백 라우트 `/api/auth/callback`: `localagents_connect` 쿠키(기기 페어링 복귀 경로) 있으면 소각하고 authorize로, 없으면 `/sessions`로.
- 근본 교훈: Neon verifier→세션 교환은 **미들웨어(proxy.ts)**에서 돈다. matcher에 인증 화면 등록 필수.

## Neon 상태 (2026-10-25)
- production 브랜치는 `devices`·`sessions_meta`만 있고 앱 테이블 전무 — **배포 때 마이그레이션 전체 적용 필요**.
- Storage 고아 19개 삭제 (~89MB 확보). 잔여 7개 = handoffs 1:1.
- 실측 버그 2건 (미수정, 백로그로 이동): `cloud_tabs.title` 세션 ID 저장, `sessions_meta` Mac 4행 msg 수 0 정체.

## 다음 할 일
- [ ] 인박스 실운영 확인 후 `?isTest` 임시 분기 제거 (`[Fix] [isTest 임시 분기 제거]`)
- [ ] 배포 체크리스트: 도메인 연결 + Neon 콘솔 신뢰 도메인 등록 / Neon production 마이그레이션 전체 적용 / Cloudflare `DODO_PAYMENTS_ENVIRONMENT=live_mode`+라이브 키 / 웹훅 URL prod 재등록 / **Dodo 브랜드 설정에 법률 3 URL 등록** (약관 페이지는 완료) / og:image
- [ ] `support@localagents.link` 실제 메일 생성 (사장님)
- [ ] MoR: Fungies KYC 완료 대기 (심사 대기)
- [ ] 기기 해제 실사 테스트 (Arch에서 해제→`localagents login` 재연결. UI는 완성, 동선만 검증)
- [ ] 랜딩 외 페이지 디자인 정합 (sessions 목록·상세 vs 랜딩 토큰) — authorize 스타일은 완료
- [ ] 게이트웨이 플로우 빠른 확인 (지시 전송·승인·모델 변경 — 포트 변경 후 미검증이나 데몬 heartbeat/sync로 사실상 붙어 있음)
- [ ] 랜딩 남은 것 (실물 스크린샷 1600×1000·og:image·모바일 분리)
- [ ] 방송·자동동기화 설계 확정 (v2. 복수 PC 행 + 주인-PC 원칙 + dirty·디바운스)
- [ ] v2 후보: 플랜 변경(월↔연)·결제 내역(Orders API)·세션 ID 어뷰징 검사·tombstone·탭 프로젝트 경로 문제·웹에서 push 원격 트리거 (outbox 명령 타입+데몬 핸들러, 진행상황이 TTY라 v2)
- [ ] `--help`·`doctor` (표면 안정 후)
- [ ] login Esc 문구 수정 (`Nothing picked` + `Done N sessions` 모순)
- [ ] GUI 검증 (Arch push → pull → 데스크톱 확인. 변환기 최종 판정)
- [ ] 실측 버그: `cloud_tabs.title` 세션 ID 저장 / `sessions_meta` msg 수 0 정체
- [ ] 알려진 노이즈: "script tag" 콘솔 경고 (NeonAuthUIProvider 내부 테마 스크립트. 무해, prod 미발생. 기록용)

## 커밋 이력 (최근)
- `5a7b10e` [Update] [랜딩 푸터 법률 링크·트라이얼 자동 전환 없음 문구]
- `1846530` [Feature] [법률 문서 3종 페이지(TOS·Privacy·Refunds)]
- `6bf8024` [Feature] [인박스 수신 대기 배지·상세 push 안내·온보딩 PC 간 이동 예고]
- `f82e201` [Update] [기기 승인 화면 랜딩 톤 정리·기기 정보 카드]
- `3947535` [Feature] [Sessions 빈 화면 온보딩·isTest 임시 쿼리]
- `974e2db` [Docs] [context.md 세션 기록 갱신 (과금·프로필·기기 해제)]

## 실행 계획 (참고)
- P1: outbox·heartbeat 스키마 + 데몬 승인 중계 (완료)
- P2: 웹 inbox (보기·승인) + 기기 목록 (완료)
- P3: fork 실행·새 지시 (예약 실행 미완)
- P4: 도메인 연결·배포·과금 (과금·법률 완료. 도메인·배포 남음)

## 아키텍처 요약 (상세는 이전 기록 참조)
- 로컬 데몬 + 클라우드 제어서버 (Next.js + Neon) + 웹 UI. 데몬은 아웃바운드 폴링 (10초 빠른 층 + 플랜 주기 느린 층).
- Neon 역할 2개: 세션 거울 저장소 + 명령 outbox. PC↔PC 인계는 Neon Storage (서명 URL, `NEON_API_KEY` 서버 1개로 발급).
- OpenCode v1(1.18.x)/v2(2.x) 양쪽 대응: `daemon/src/convert.ts` 양방향 변환기. v1이 npm 기본 채널.
- CLI 표면: `login`·`status`·`whoami`·`push` (+숨김 진단 다수). 데몬 단일 설치 `npx localagents login`.
- 인계 모델: 웹↔클라이언트는 Neon DB (거울+outbox), 클라이언트↔클라이언트는 Storage 세션 파일 (push마다 버전 1개 + DB 포인터).
- 토큰 API: `device_tokens` (해시·revoke) + `lib/auth/device.ts`. 게이트웨이가 세션 확인 후 `x-internal-secret`+`x-user-id` 주입 (`lib/auth/internal.ts`, timingSafeEqual).
- 개명 이력: localagents (2026-10-06). 상표 주의: agentsync 계열 사용 금지 (AGENTSYNC 6836288호).
