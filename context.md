# context.md - cli-agents-dev

2026-10-30 02:15

## 프로젝트
- 폴더: `cli-agents-dev`. 서비스명 `localagents` (명령어 단수). 도메인 `localagents.link` (+ `cliagents.dev` 리다이렉트, dev 터널 `dev.localagents.link`)
- 스택: Next.js 16.3.6 (Turbopack) / TypeScript / Tailwind CSS. 배포는 **Cloudflare Workers** (OpenNext 1.20.6 고정)
- 버전: 웹·데몬 모두 `1.0.0`
- **레포는 분리하지 않는다**(2026-10-30 결정). 한 레포 + `daemon/` 하위 publishable 패키지. npm이 `files:["dist"]`로 CLI만 41kB 패키징하고, 웹은 데몬을 import하지 않는다. 루트 `tsconfig`에서 `daemon`을 exclude해 타입체크도 분리했다.
  - 분리 트리거: CLI 오픈소스 공개 / CLI 릴리스 빈도 증가 / 웹 배포가 CLI 때문에 깨짐 / 외부 기여자 유입

## 사업 아이템
- **본체 = PC↔PC 세션 이어받기**. 웹 인박스는 보조(폰에서 보기·지시·승인). SSH로도 가능한 일이라는 게 사장 판단.
- **현재 OpenCode만 지원**. Claude Code 지원 전까지 사용자 노출 문구에 절대 쓰지 않는다.
- 로컬 데몬 + 클라우드 제어서버(Next.js + Neon) + 웹 UI. 데몬은 아웃바운드 폴링(10초 빠른 층 + 플랜 주기 느린 층).
- Neon 역할 2개: 세션 거울 저장소 + 명령 outbox. PC↔PC 인계는 Neon Storage(서명 URL, `NEON_API_KEY`로 발급).

## 개발 환경
- 클라 3004 (`npm run dev`) / API 컨테이너 3005:3000 (`docker start localagents-server`). 데몬 baseUrl 기본 `http://localhost:3005`.
- env: `NEXT_PUBLIC_BASE_URL`(브라우저→API) / `BASE_URL`(서버 외부 알림) / `LOCALAGENTS_BASE_URL`(데몬 전용).
- CORS는 게이트웨이만 (`CORS_ALLOWED_ORIGINS`, dev 기본 localhost:3004). prod는 same origin.
- 배포: `npm run preview` / `npm run deploy` (둘 다 `check:routes` 선행).
- **빌드 전 `.env.local`을 밖으로 옮긴다** (OpenNext가 env를 워커 번들에 직렬화).

### 실측 교훈
- **API 컨테이너와 클라 dev의 기동 순서**: 컨테이너 먼저 → `.next`를 root 소유로 만들어 cla dev가 `EACCES`. 항상 클라 먼저. 잔해는 `sudo rm -rf .next`.
- **prod 빌드는 dev와 `.next`를 공유**: dev(3004)를 내리고 빌드.
- `opennextjs-cloudflare build`가 `next build`를 내부 실행 (package.json build 스크립트 미경유).
- 브라우저 `baseFetch`는 dev에서 `localhost:3005`로 나가고 게이트웨이가 **같은 프로세스 핸들러를 직접 호출**한다. 그래서 로그에 `/api/client-gateway?path=...` 한 줄만 남는다.
- **데몬이 401/연결 실패면 컨테이너부터 확인** (2026-10-30 실제로 SIGTERM으로 내려가 있었음).
- `node_modules` 없이 `npx tsc`를 치면 가짜 `tsc@2.0.4` 스텁이 설치된다.

## API 구조 (경로 = 인증 채널)
`npm run check:routes`가 강제한다(`scripts/check-route-auth.mjs`).

```
app/api/
  auth/      Neon Auth 핸들러 + OAuth 콜백        (공개/벤더)
  pairing/   begin·consume·pack                  (공개, 로그인 흐름)
  web/       브라우저 → 게이트웨이 → S2S          (messages·commands·devices·device/authorize·dodo 3종)
  daemon/    CLI·데몬 → 기기 토큰                  (sync·messages·heartbeat·handoffs·commands 3종·billing/status·whoami·device/revoke)
  webhook/   Dodo 서명 검증
  client-gateway/  web 채널 단일 진입점
```

- 인증 판정 단일 출처 `lib/utils/getIsValidRequest.ts`:
  - `C2S()` 세션 쿠키 (진입점만) / `S2S(req)` 내부 secret + `x-user-id` (게이트웨이 뒤) / `Device(req)` 기기 토큰 (데몬)
  - 전부 "신원 또는 null" 반환 → 라우트는 null 검사 한 번. `lib/auth/internal.ts`는 삭제됨.
- 게이트웨이는 `/api/web/**` 외 경로를 400으로 거부. self-fetch 금지(같은 프로세스 호출).
- `GET /api/web/messages`가 스레드 + presence + **마지막 명령 실행 결과**를 함께 반환(5초 폴링 1회).

## 데몬 배포·자동 실행 (2026-10-30 완료)
- **`login` 성공 직후 백그라운드 서비스 자동 등록** (유저는 명령 1개만).
  1. 실행 파일을 `~/.local/share/localagents/app/`로 복사 (npx 임시 캐시가 사라져도 안전)
  2. `~/.local/bin/localagents` shim 생성 (이미 있으면 건드리지 않음 → 개발 중 repo 실행 파일 보존)
  3. OS 감지: linux → systemd user 유닛 / darwin → LaunchAgent / 그 외 → 미지원 안내(로그인은 유효)
  4. `~/.local/bin`이 PATH에 없으면 셸 프로필에 한 줄 자동 추가(zsh/bash/fish, 표식으로 중복 방지)
- **`logout`**: 토큰 revoke + 서비스 **중지**(유닛 유지). 재로그인하면 다시 시작.
- **`uninstall`**: 토큰 revoke 시도 + 서비스 중지·비활성·유닛 삭제 + 앱 복사본·상태 삭제 + PATH 블록 제거. (logout과 다름)
- `login --no-service`로 자동 등록 생략. `service install`은 복구용으로 존재.
- **검증 완료(리눅스)**: uninstall → 유닛·복사본·상태 삭제 확인 → login → 서비스 자동 복구, heartbeat 200, `last sync: 6s ago`, `billing: Pro`.
- **macOS LaunchAgent는 코드만 있고 미검증** (사장님 MacBook에서 1회 필요). SSH 전용 세션에서는 `launchctl bootstrap gui/$UID` 실패 가능. node 업그레이드 시 `service install` 재실행 필요.
- Windows는 v1 미지원(작업 스케줄러 별도 설계 필요).
- **Node 하한 22.13.0**: `node:sqlite`가 v22.13에서 플래그 해제(공식 문서 확인). 그 미만은 시작 시 명확한 안내 후 종료. `node:sqlite`는 지연 로딩(`daemon/src/sqlite.ts`).
- npm 패키지 준비 완료: `private` 제거, `files:["dist"]`, `engines>=22.13`, bin shebang 추가, **런타임 의존성 0개**.
- **미완**: npm에 아직 미게시(`localagents` 404). 사장님 npm 계정으로 publish 필요. `daemon/package-lock.json`에 제거한 의존성이 남아 있어 `cd daemon && npm install` 한 번 필요.

## 과금 (live 실결제만 남음)
- **Pro $9/월 · $90/연** (2개월 할인). 30일 no-card 트라이얼, 31일째 hard cutoff. 데이터 보존·재구독 복원.
- Dodo(MoR). 브랜드 test `brnd_0NqSDEWhhRh98FCCuDWhy` / live `brnd_0NosKxf8s7qyYWiuNXBE6`. live 상품 복사 완료(`Pro (Monthly)` $9 / `Pro (Annual)` $90, metadata `{plan, interval}`).
- 상품 ID 하드코딩 금지: `products.list()`를 metadata로 매핑(1시간 캐시, 정확히 1개씩 아니면 loudly 실패).
- 모드 판정은 `DODO_PAYMENTS_ENVIRONMENT`만. 신형 키에 `sk_test_` 프리픽스 없음.
- **웹훅** `app/api/webhook/dodo`: Standard Webhooks HMAC, 리플레이 5분. `subscription.*` upsert, `cancelled/expired` → canceled. 구독 ID는 `subscription_id` 우선 → `id` 폴백.
  - ⚠️ **경로가 `/api/dodo/webhook` → `/api/webhook/dodo`로 바뀜. Dodo 대시보드 URL 교체 필요.**
- 게이트 `lib/billing.ts`: active 통과 / 첫 API 활동+30일 / 만료 403(`trial_ended`). 데몬 4경로 + 웹 fetch 2 + 서버 컴포넌트 3면.
- 체크아웃 `POST /api/web/dodo/checkout`: 이름·이메일 프리필, 이메일 수정 불가, 이름 수정 가능. DB에 이메일 없으면 잠그지 않음.
- 취소/복원: `cancel_at_next_billing_date` 토글 + DB 즉시 반영(웹훅과 멱등).
- 데몬 표시: `Pro` / `Pro, cancels at YYYY-MM-DD` / `Trial, N days left` / `Subscription ended...`.
- test 모드 전 경로 실증 완료. **live 실결제 1건 미실시.**

## 세션 소유권·기기 선택
- **소유는 계정**: `sessions_meta.user_id` (devices에서 백필). 목록·프로필·상세가 `user_id`로 판정.
- **`device_id` = 현재 호스트**: 명령 라우팅·presence에만 사용. 소유가 아니다.
- `session_locations(tab_id, device_id, last_seen_at)`: push/pull로 같은 세션이 여러 PC에 존재 가능(N:M). sync와 메시지 sync에서 upsert, 그 기기에서 사라진 세션은 그 기기 행만 삭제.
- 상세 명령 대상: **활성 기기만**(heartbeat 2분). 기본값 = 현재 호스트가 활성이면 그것, 아니면 최근 활성. **활성 0이면 쓰기 전부 차단**(읽기 허용). 위치 행이 없는 기존 세션도 현재 호스트가 살아 있으면 후보에 포함.
- 승인은 선택 대상 아님(프롬프트를 띄운 기기 귀속). 서버도 `web/commands`에서 대상 기기 소유·활성(409)·세션 소유 검증.
- `commands.tab_id` 컬럼 승격 → 상세에 마지막 명령 결과 표시.
- 모델·Variant는 **미지정이 정상**. 카탈로그에 없는 모델(내려간 모델)은 `(none)`으로 표시하고 거짓 선택값을 보여주지 않는다. 모델 `(none)`은 선택 불가, Variant `(none)`은 선택 가능.
- v2: 명령 브로드캐스트(세션 타겟 + 선착순 클레임). 지금은 활성 기기 명시 선택으로 회피.

## 기기 해제·재연결
- **소프트 삭제**: 기기 행 삭제는 FK 7개에 걸려 불가(실측 500). 해제 = 토큰 revoke + `unlinked_at` + 목록 숨김 + 대기 명령 만료 + 승인·위치 정리. 세션·대화는 보존.
- **재로그인 자동 연결**: 세션이 그 기기 주인과 같고 미해제면 **승인 화면 생략**하고 토큰 발급 → 데몬 콜백. 최초/다른 계정/해제된 기기만 Connect 화면.
- `login`은 토큰이 살아 있으면 브라우저를 열지 않고 "already logged in" 후 종료.

## 랜딩·온보딩 카피 (2026-10-30 PC↔PC 중심으로 개편)
- 히어로: `Start a session on one PC. Continue it on every PC.` / CTA **`Start free`**
- How it works: 01 `npx localagents@latest login` (Connect this PC) → 02 `localagents push` → 03 `localagents pull`, 그리고 **`Your phone is optional`** 보조 블록.
- Features 좌우 교체: `Move between PCs` / `Check in from your phone`. 가격 불릿은 `cross-PC push / pull`이 맨 앞.
- 빈 화면(`SessionsEmptyState`): npx/npm 탭, 안내 `One command. No global install.`(서비스·복사본을 남기므로 "Nothing left behind" 폐기), `Requires Node 22.13 or newer.`, `To stop background sync: npx localagents@latest uninstall`.
- 카피 원칙: 사용자 노출 문구에 em dash·AI 상투어 금지.

## 법률 문서 (MoR 규격)
- `/legal/terms`·`/legal/privacy`·`/legal/refunds`. 랜딩 푸터 링크. 공개 페이지(게이트 없음), 페이지별 metadata.
- 트라이얼 첫 활동+30일·31일 lock·데이터 보존 / 취소 기말 발효 / 환불 14일 내 잔여 일할 / 서브프로세서 4개 / 관할 대한민국·서울중앙지법.
- `support@localagents.link` 기재. **Dodo 브랜드에 법률 3 URL 등록 미완.**

## 기타 화면
- `/sessions`: 수신 대기 배지(다른 PC가 push하고 내 기기가 안 받은 것, 신규/갱신 3분지). 해제한 기기는 판정 제외.
- 세션 상세: 우측 레일 "Move to another PC"(기본 접힘, push/pull 안내), Pending approvals, Session stats.
- `/profile`: 계정 카드 + 구독 카드 + 취소 모달. `neon_auth` 컬럼은 camelCase(`createdAt`) — `created_at`은 크래시.
- `/devices`: Unlink 모달.
- 브랜드 자산: `public/logo/*`, `public/og/og.png`, `components/public/BrandMark.tsx`(원본 SVG 직접 로드).
- 메타 단일 소스 `lib/site.ts`(`buildPageMetadata`, `NOINDEX_METADATA`), `sitemap.ts`(4 URL), `robots.ts`, `llms.txt`, JSON-LD `WebSite`+`SoftwareApplication`.
- 내부 화면은 **메타 noindex** (robots disallow는 메타를 못 읽게 함).

## 로그인·Neon Auth
- 고정 콜백 `/api/auth/callback`. verifier→세션 교환은 미들웨어(`proxy.ts`)에서 → matcher에 인증 화면 필수.
- 신뢰 도메인 등록됨: `localagents.link`, `localagents.lht1324.workers.dev`.
- **`sessionDataTtl` 900초** (기본 300). 짧으면 upstream `/get-session` 429 → 캐시 미생성 → 재시도 악순환(실측).

## Neon 상태
- dev: 마이그레이션 **18/18**. 세션 13 / 기기 2 / 위치 추적 동작.
- **prod: 16/18.** 없는 것 → `sessions_meta.user_id`, `session_locations`, `devices.unlinked_at`, `commands.tab_id`. **배포 전 적용 필수**(prod 세션 0건이라 백필 즉시 끝).
- production `br-red-morning-azc2kkl8` / development `br-solitary-tree-azkgbwbu`. 프로젝트 `patient-water-01729139`.
- ⚠️ `NEON_API_KEY`가 org 스코프 → 이 서비스가 뚫리면 tailored-ad까지 사정권. 프로젝트 스코프 교체 권장.
- 실측 버그(미수정): `cloud_tabs.title`이 세션 ID로 저장 / `sessions_meta` Mac 4행 msg 수 0.

## 다음 할 일

### 출시 전 필수
- [ ] **npm publish** (`daemon/`에서. `localagents` 아직 404) → 클린 환경에서 `npx localagents@latest login` 검증
- [ ] `cd daemon && npm install` (의존성 제거 반영, lock 갱신)
- [ ] **prod 마이그레이션 0016·0017** → 바로 **`npm run deploy`**
- [ ] **Dodo 웹훅 URL** → `https://localagents.link/api/webhook/dodo`
- [ ] **live $9 실결제 1건** → DB `status=active`·`dodo_subscription_id` 확인 → 환불
- [ ] prod 로그인 상태에서 `/sessions`·`/profile` 렌더 확인
- [ ] Dodo 브랜드에 법률 3 URL 등록, `support@` 수신 확인
- [ ] macOS LaunchAgent 1회 검증 (사장님 MacBook)

### 출시 후
- [ ] Workers Builds 자동 배포 (master=production / develop=preview)
- [ ] `NEON_API_KEY` 프로젝트 스코프 교체
- [ ] 명령 브로드캐스트 v2 (세션 타겟 + 선착순 클레임)
- [ ] heartbeat에 OpenCode 실행 여부 (기기는 켜졌는데 OpenCode가 꺼진 경우 구분)
- [ ] Windows 서비스 등록(작업 스케줄러)
- [ ] 랜딩 실물 스크린샷·모바일 분리, sessions/devices 디자인 정합
- [ ] GUI 검증 (Arch push → pull → 데스크톱)
- [ ] `cloud_tabs.title` 버그 / `sessions_meta` msg 수 0
- [ ] `--help`·`doctor`, login Esc 문구
- [ ] 세션 캐시 429 재발 관찰
- [ ] MoR: Fungies KYC 대기
- [ ] v2 후보: 플랜 변경·결제 내역·세션 ID 어뷰징·tombstone·탭 프로젝트 경로·웹에서 push 원격 트리거

## 커밋 이력 (최근)
- `19d1cc1` [Fix] [셸 프로필 PATH 자동 추가·uninstall 시 제거]
- `b269a2c` [Update] [랜딩·온보딩을 PC↔PC 중심으로 정리·서비스 PATH 안내]
- `e933d8b` [Feature] [로그인 시 백그라운드 서비스 자동 등록·logout 중지·uninstall 명령]
- `935fec9` [Fix] [Node 22.13 하한·node:sqlite 지연 로딩·버전 안내]
- `5de048a` [Fix] [세션 위치 갱신 지연 보완·기존 세션 호스트 폴백·데몬 npm 배포 설정]
- `1b62fe3` [Refactor] [API를 web/daemon/pairing/webhook으로 분리·인증 채널 통합]

## 아키텍처 요약
- 로컬 데몬(CLI) + 클라우드 제어서버(Workers + Neon) + 웹 인박스. 데몬은 아웃바운드 폴링.
- CLI 표면: `login`·`logout`·`status`·`whoami`·`push`·`pull`·`uninstall` (+ `service install`, 숨김 진단 다수)
- 인계: 웹↔클라이언트 = Neon DB(거울+outbox), 클라이언트↔클라이언트 = Neon Storage(push마다 버전 1개 + DB 포인터)
- 토큰: `device_tokens`(해시·revoke·만료). 게이트웨이가 세션 확인 후 내부 secret + userId 주입.
- OpenCode v1/v2 양방향 변환기 `daemon/src/convert.ts`.
- 개명 이력: localagents (2026-10-06). agentsync 계열 상표 사용 금지.
