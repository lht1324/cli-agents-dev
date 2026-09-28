2026-09-29 01:02

# context.md - cli-agents-dev

## 프로젝트
- 폴더: `cli-agents-dev` (구 `new_project`)
- 서비스 가명: cliagents (명령어는 단수 `cliagent`)
- 도메인 후보: `cliagents.dev` (연 $12.2, 본선) / `cliagent.nexus` (연 $10.2, 리다이렉트용)
- 스택: Next.js 15+ / TypeScript / Tailwind CSS (사장 기술 기준)

## 사업 아이템 (확정 방향)
- 다중에이전트 세션 온라인 관리. Claude Code + OpenCode 세션을 한 화면 통합 inbox로.
- 제외: 메일 범용 클라이언트, 게임, 범용 메신저 (경쟁 과포화)
- 제외: Antigravity (공개 API 없음), 엔터프라이즈 AMP (SI 영업 필요)

## 아키텍처 (A안 확정)
- 로컬 데몬(유저 PC 백그라운드 프로세스) + 클라우드 제어서버(Next.js + Neon 메타DB) + 웹 UI(뷰어)
- 브라우저에서 CLI 직접 실행 불가. 데몬이 아웃바운드 WS 1개로 명령 수신·결과 푸시.
- OpenCode는 `opencode serve` API 활용. Claude는 JSONL 감시 + `-p --resume` + SDK SessionStore.
- PC 꺼지면 offline 표시. `PC 꺼져도 실시간`은 B안(클라우드 실행)이며 후순위. B안은 Daytona류 외부 샌드박스 임대 전제.
- MVP 범위: 통합 목록 + 상태 + 원격 승인 1개. 전문 미러링은 2단계.
- 분배 확정: 플러그인·per-project npm 아님. 상주 데몬 1개 (`npx cliagent login` 1방).
- 클라이언트 확정: 웹 뷰어 1개. CLI 클라이언트는 중복, Electron은 과함. 터미널 부착은 2단계 이후.
- 기능 분리 확정 (2026-09-29): 본체 = PC 간 탭 복원. 부속 = 웹 리모컨(보기·승인·새 지시, 실행은 PC 서버). 웹에 터미널 재현 없음.
- 웹 범위 확정: 랜딩·설명서·요금제 + 프로필·구독 관리 + 원격 inbox. 계정면 + 마케팅면 + 동반 기능.
- 레포 구조 확정: 데몬은 별도 레포 아님. 같은 레포 `daemon/` 하위. 타입 공유·단일 푸시. 패키지 분리는 2번째 프로젝트 때.

## 데이터·요금 원칙
- Neon에는 세션 메타/요약만. transcript 전문 상시 동기화 없음 (요금+개인정보).
- 전문은 필요 시 해당 1건만 온디맨드 조회 (E2E 암호화·만료기한付き). opt-in + 로컬 마스킹(sk-*, ghp_* 등) + 30일 보관.
- 플랜별 동기화 차등: 30분/10분 배치 vs 쿼리마다 실시간. 플래그 1개로 제어. 세션 개수 차등 아이디어는 후보 (용량 상한·보관기간과 세트).
- 마지막 성공 동기화 시각을 1급 상태로 UI 표시 (`synced N분 전`).

## OpenCode 로컬 DB 실측 (2026-09-28, 사장 PC)
- 경로: `~/.local/share/opencode/opencode.db`. 당초 예상 300MB → 실측 **832MB** (폴더 전체 989MB).
- 테이블 행수 (정리 전): session 25, message 4,232, part 16,217, project 5, event 39,983.
- 용량 구성: **event 408MB + part 350MB + message 5.8MB** + 인덱스 나머지. 사장이 보존하려는 '대화'(message)는 4개 세션 합쳐 5.8MB에 불과.
- 세션별 무게: `TailorAd context.md 확인` 1개가 약 680MB로 전체의 86% (part 322MB + event 357MB). 나머지 3개는 합쳐 약 80MB.
- 범인 2개: (1) `tool=read` × `/Users/jaeho/Downloads/` 대용량 파일 반복 읽기, 개당 4.7~5.1MB가 part에 적재. (2) 이중 저장. `message.part.updated` 이벤트 12,488행·332.8MB가 part 내용의 복사본. 같은 5MB가 part와 event에 중복.
- 참고: `session` 테이블에 `directory` 절대경로 저장. 통 DB 덮어쓰기 금지의 근거.
- 현재 세션 컨텍스트 패널 실측: 제한 1,048,576 토큰, 사용률 8%, 내역은 사용자 4.2% / 어시스턴트 22.4% / 도구 호출 73.2% / 기타 0.2%. 도구 호출이 컨텍스트의 7할.

## 세션 정리 작업 (2026-09-28 완료)
- 25개 → 4개로 축소. 남긴 것: `cli-agents-dev 컨텍스트 검토`(ses_f1c05c…), `TailorAd context.md 확인`(ses_f82fb9…), `브리핑 요청`/short_real 최신 09-15(ses_fc05e0…), `브리핑 요청`/portfolio(ses_f7dcd1…).
- 연관 삭제: message 1,334행, part 5,000행, event 5,248행. CASCADE 확인 테이블: message→part, todo, session_share, session_message, session_input, session_context_epoch (전부 session(id) 참조). event는 session을 직접 참조하지 않아 `event_sequence` 21건을 함께 삭제해 연쇄 처리. project/workspace/permission은 프로젝트 귀속이라 유지.
- 결과: 832MB → 793MB. 39MB만 감소 (남긴 4개가 본체: message 2,898행·part 11,217행). 진짜 다이어트는 남긴 세션 안의 거대 read 파트 정리이며 미실시 (A안: 손대지 않음).
- 백업: `/var/folders/7y/5m9115_d3tv0jz49btch7lth0000gn/T/opencode/opencode-backup-20260928.db` 832MB. VACUUM + `wal_checkpoint(TRUNCATE)` 수행 (WAL 798MB→24KB). OpenCode.app 실행 중 작업, 무사.

## 동기화 설계 결론 (이번 세션 확정)
- '꺼지기 직전 무조건 동기화' 불가. OS가 수 초만 주고 강제 종료·전원단절에는 훅 없음. n분 주기 + 종료/수면 best-effort flush + 부팅 catch-up.
- 통 DB 덮어쓰기 금지. B 고유 세션 삭제·절대경로 불일치·WAL 파손. 세션 1개 논리 이식(insert)으로.
- 파일 diff 아님. `updated_at > last_sync` 행만 전송, 커서는 `last_sync` 토큰 1개. 평소 메타 KB 단위.
- OAuth는 Google+GitHub 먼저, X는 나중 (심사·유료티어·스펙변경).
- Storage는 이번 보일러플레이트에서 제외. 필요해지면 Neon Object Storage로 붙임 (아래 참고).

## 세션 정의 (2026-09-29 확정)
- 탭 1개 = 세션 1행. GUI 멘탈모델과 DB 일치.
- 동기화 범위 = 현재 epoch 전문 + 이전 epoch 접기(요약 1줄). 압축 발동 시 compaction 행 기준으로 자름. 서버는 전부 보유, 클라우드는 현재만(큐, flush는 우리 DB에서만).
- 복원 3층: 텍스트 항상 + tool 메타 유료 + payload 제외(온디맨드 1건). 전송 gzip. 키는 user_id Partition + (session_id, seq).
- 연산: 로그 INSERT-only + 헤더 UPDATE(제목·비용·토큰·시간) + flush DELETE(클라우드 전용).
- MVP = 보기 + 새 턴 잇기. 이어서 실행은 workspace 동기화 붙는 2단계.
- 전용 세션 = fork 분기. 기존 탭은 읽기·승인만. TUI 직접 운전 금지.
- 로컬 큐-DELETE 없음. 우리 탭은 입력 통제로 마르게 + 세대 교체는 fork. 이식은 import 우선, 선택 이식은 직접 SQL(2단계).

## 결제사 점검 결과
- Polar / Paddle / Lemon Squeezy / Creem / Fungies.io 모두 devtool SaaS 허용.
- 금지는 AI 이미지·딥페이크·음성복제·스파이웨어 한정. 세션 매니저는 workflow측이라 통과 라인.
- 주의: 타서비스 우회 마케팅 금지, 지원메일·취소버튼·약관 필수.
- MoR 미정. `SKILLS.md`에서 Paddle 10종 삭제하고 빈 상태로 둠. Paddle 설치 형식 확인됨: `developer.paddle.com@paddle-xxx` (각 1.6~1.7K installs).

## Neon vs Supabase 결론
- Neon Console SQL Editor로 값 확인·SQL 실행 가능. Supabase식 인라인 표편집감은 아님.
- Supabase Pro 사용량을 Neon에 얹으면 약 $23~24로 동가. scale-to-zero 저트래픽이면 Neon 압승.
- Neon은 제어DB로 도입. Realtime/Edge 대체는 별도 WS 필요.
- Neon Object Storage (2026-09-28 조사): S3 호환 내장 스토리지. 별도 AWS 계정·IAM 없이 Neon credential 1개. `neon.ts`에 bucket 선언 후 `neon deploy` 1방. 브랜치와 함께 copy-on-write 분기. Free에 5GB 포함. 단 설정 예시가 `preview.buckets`라 프리뷰 성격. 필요해지면 붙이고 R2/S3 별도 계약은不要.
- Neon Free에 Managed Better Auth 포함 (Google/GitHub OAuth 설정 몇 줄).

## SKILLS.md / 스킬 상태 (2026-09-28 완료)
- `SKILLS.md` 작성 완료, `develop`에 커밋·푸시 (`692bcaa [Update] [Paddle 스킬 문서 제거]` + `.idea` 1건, `origin/develop` 동기화).
- 전역 스킬 60여 개 유지. Paddle은 전역·로컬 어디에도 미설치.
- `tailored-ad`는 손대지 않음 (SKILLS.md 99줄 동일 사본 존재, Paddle 포함).

## 다음 할 일
- [x] 세션 정의 확정 (탭=세션, 현재 epoch 전문 + 이전 접기)
- [x] MVP 플로우 3개 고정 (전문+초과 폴백 / 허용·거부 2버튼 / 주기+수동 버튼)
- [ ] MVP 범위 확정 (통합 목록+승인)
- [ ] 도메인 구매 (`cliagents.dev`, Cloudflare에서 재확인)
- [x] Next.js + Drizzle + Neon 보일러플레이트 (Storage 제외, OAuth Google+GitHub)
- [x] Neon Auth dev/prod 분리 (브랜치별 Auth URL, `.env` 교체済み. GitHub 콜백 2개目は 배포 시)
- [x] `daemon/` 스캐폴드 (서버 탐색·인증·세션 목록, 종단 검증済み)
- [ ] 데몬 다음 기능 (승인 중계 vs fork 실행 중 택1)
- [ ] 웹 원격 inbox UI (보기·승인)

## 데몬 종단 검증 (2026-09-29, 이 PC)
- 명령: `daemon/`에서 build 후 자체 serve(번들 CLI 2.0.18, 4096, 비번) → `status`·`sessions` 성공. 세션 5개 제목 출력 확인.
- 교훈 3개: (1) 데스크톱 v2 API는 `/api/*` 아래 + 인증 필수. HTML 폴백에 속지 말 것. (2) health 엔드포인트 없음. 탐색 기준은 `/api/session` 목록 조회로 변경. 목록 형태 `{data:[...]}` 래퍼 주의. (3) 시스템 CLI 1.18과 데스크톱 번들 2.0.18 버전 꼬임. serve는 번들 CLI로 띄울 것.
- `daemon/tsconfig.json` 수정 1건 (`lib` DOM + `types` node)._tsbuildinfo 계열은 `.gitignore`済み.
