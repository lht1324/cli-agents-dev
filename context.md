2026-10-08 04:29

# context.md - cli-agents-dev

## 프로젝트
- 폴더: `cli-agents-dev` (구 `new_project`)
- 서비스 가명: localagents (명령어는 단수 `localagents`)
- 도메인 후보: `cliagents.dev` (연 $12.2, 본선) / `localagents.nexus` (연 $10.2, 리다이렉트용)
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
- 분배 확정: 플러그인·per-project npm 아님. 상주 데몬 1개 (`npx localagents login` 1방).
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

## 용어 확정 (2026-09-30)
- 탭 > 세션. 탭 = 대화 공간(CLI 터미널 탭·GUI 탭, `session_v2` 1행). 세션 = 사용량 0→100% 구간 1개(압축 경계). 동기화 단위는 세션.
- 기존 "탭 1개 = 세션 1행" 표현은 폐기.

## 터미널풍 UI + 입력 (2026-09-30 확정)
- 모양은 터미널풍 스크롤 + 입력창 가능. OpenCode 웹 통째 이식은 아님.
- 입력 경로: 웹 입력 → 클라우드 명령 outbox → 데몬 → 로컬 서버 실행. Neon 역할 2개 (세션 저장소 + 명령 outbox).
- 첨부: user 행에 base64 임베드 확인(PNG 클립보드 15KB·스크린샷 300KB대, `source: inline`). 저장은 영구, 기억은 윈도우 한정. 파일 메타만 항상 동기화, 본문 온디맨드.
- presence: heartbeat 3-state (online·stale·offline) + last seen. 수면·꺼짐·단선 구분 불가. 주기는 동기화 플랜과 묶음.
- 예약 실행: outbox 상태 4개 + 만료(예 7일) + 멱등키. offline·stale 기기엔 "PC 켜지면 실행됩니다" 경고.

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

## 에이전트·모델 원격 전환 (2026-10-02, 코드 완료·종단 미검증)
- API 실측: `GET /api/model` 1방에 provider+variants. `GET /api/agent`는 위치 귀속. 전환은 세션별 POST 2개 (`/agent {agent}`, `/model {id,providerID,variant?}`).
- 에이전트 필터: `mode=primary + hidden≠true` = Build·Plan만. 목록 기본값 = 현재값 (`sessions_meta.agent/model` 컬럼 추가, 데몬 `sync-sessions`으로 채움).
- 모델 선택: 공급자별 optgroup + variant 분리 선택. 값 있으면 placeholder 숨김.
- 거울: `model_catalog` 테이블 (device PK). 데몬 `sync-models`. serve 기동 직후 빈 목록 주의 (웜업 후 재실행).

## tool 호출 가공 (2026-10-02)
- 전수 5,058행: 출력은 text·file(이미지 74건)·빈값 3종. 입력 키 2세대 공존 (`filePath|path`, skill `name|id`).
- 저장: `{tool, input(본문·base64 제외), exit, hasImage, answer}` envelope. UI에서 종류별 가공. `tools.ts`는 exit 판정만残存.
- shell 2번째 줄 = 종료 상태 (`Command exited with code N`, SIGTERM, 백그라운드 알림). ✓/✗ 표시.
- question 출력 = `Q=A` 텍스트. 답변 500자 포함 저장.

## UI 개편 (2026-10-02)
- 스킬: `design-taste-frontend`. 다크 터미널풍 (ink·panel·line·go·warn 토큰). shadcn 미사용.
- 랜딩 개편 + 헤더 내비(Sessions·Devices). 본문 `max-w-5xl`. 대화 말풍선 (user 우·assistant 좌·tool 접힘·summary 구분선).
- assistant text 마크다운 렌더 (`react-markdown@10.1.0` + `remark-gfm@4.0.1`). 진입 시 최하단 + `↓` 플로팅 버튼.
- 메시지 원본 시각: `cloud_messages.createdAt`에 원본 기록. 말풍선 아래 `3:24 PM` 표시. 걸린 시간은 다음(컬럼 필요).

## CLI 명령어 목록 (2026-10-06 확정)
- 유저 표면 4개: `login`(OAuth+첫동기화) · `status`(기기·서버도달·마지막성공·밀린명령, 주소 없음) · `whoami`(이메일·플랜) · `push`(묶음 1회).
- 삭제済み: `register`·`token`(login이 대체) · `approve`(웹 버튼으로) · `pull`(2단계 이식 때 부활).
- 숨김 진단 (`--jaeholee` 없이 치면 unknown): `sessions`·`heartbeat`·`sync`·`fork`·`sync-messages`·`sync-models`·`sync-sessions`·`poll`. `run`은 unit용이라 예외.
- 보류: `logout`(출시 직전, revoke+상태삭제 30분) · `--help`(표면 안정 후) · `doctor`(진단 묶음) · `sessions` 표면 잔류 여부.
- `send` 폐기. 메시지 전송은 웹에서만.

## 다음 할 일
- [x] 세션 정의 확정 (탭>세션, 현재 epoch 전문 + 이전 접기)
- [x] MVP 플로우 3개 고정 (전문+초과 폴백 / 허용·거부 2버튼 / 주기+수동 버튼)
- [ ] MVP 범위 확정 (통합 목록+승인)
- [x] 도메인 구입 (`cliagents.dev` 구입済み. consigliere는 별명·기능명 후보, `.salon` 반대)
- [x] Next.js + Drizzle + Neon 보일러플레이트 (Storage 제외, OAuth Google+GitHub)
- [x] Neon Auth dev/prod 분리 (브랜치별 Auth URL, `.env` 교체済み. GitHub 콜백 2개目は 배포 시)
- [x] `daemon/` 스캐폴드 (서버 탐색·인증·세션 목록, 종단 검증済み)
- [x] 데몬 승인 중계 (`permissions` 조회·응답 + `sync` 거울, 실사격済み)
- [x] 명령 outbox 테이블 (commands + cloud_tabs/messages/folds, Neon dev 적용済み)
- [x] heartbeat 방식 결정 (`devices.lastSeenAt` 갱신으로 확정)
- [x] 웹 원격 inbox UI (보기·승인) + 기기 목록 (웹→PC 종단済み: sync→Allow→poll→실행)
- [x] `localagents fork` 명령 (fork + 대장 등록, 실측済み)
- [x] 새 지시 종단 (웹 전송 → poll → 에이전트 응답 확인済み)
- [x] 상세 307 해소 (원인: 손 복사 id 오기. 목록 링크화로 재발 방지)
- [x] 에이전트·모델 전환 코드 + 종단 (variant medium 변경 → poll → PC GUI 확인済み 2026-10-02)
- [x] 대화 동기화·시각·tool 가공·UI 개편 (말풍선·마크다운·폭·점프 버튼)
- [x] OS 등록 Arch (`active (running)` 확인, 재부팅 미확인)
- [x] 토큰 API (heartbeat·poll·sync·messages 전환済み)
- [x] loopback 로그인 구현 (브라우저 OAuth → Connect → 토큰 → heartbeat 종단済み 2026-10-05)
- [x] `push` 묶음 명령 + `status` 개편 (주소 제거, 2026-10-06) + `whoami` 추가 (이메일·플랜)
- [ ] UI 개선 (최우선, 진행 중. 아래 2026-10-07 기록 참고)
- [x] `logout` 구현 (revoke+상태삭제. 401이면 로컬만 정리. `d5a7433`)
- [x] 기기 지문 고정 ID (machine-id+유저 해시. `24cb7ad`. 중복행 정리済み)
- [x] `GET /api/commands/pending` 읽기 전용 (next의 delivered 부작용 회피)
- [x] `register`·`token`·`approve` 삭제, `--jaeholee` 숨김, `run` 예외
- [x] 항시 서버 통일 (탐색 4096~4105, exit kill 제거, unit `KillMode=process`)
- [x] 하트비트 10초 분리 (presence 정확. `lastSyncAt` 기록漏れ 수정)
- [ ] `--help` (표면 안정 후로 보류)
- [ ] `doctor` 진단 묶음 (고급 명령 숨김)
- [x] 개명 `localagents` (2026-10-06, 코드+PC 이관済み. `7a8d301`. 도메인·DB 테이블 유지)
- [x] 플러그인 통지 (2층 루프 + 즉시 drain. 아래 완료 기록 참고)
- [x] Storage 인계 기반 (서명 URL 왕복 + `AWS_*` 삭제 + pull upsert·v1 대응. `b5ef5f6`. 구버전 title NULL은 재push 시 해결)
- [ ] 방송·자동동기화 설계 확정 (복수 PC 행 + 주인-PC 원칙 + dirty·디바운스)
- [x] 메시지 핀포인트 동기화 (PK `(tab_id, message_id)` + 커서 증분 + 조건부 backfill. 아래 기록 참고)
- [x] 실시간 폴링 (웹 5초 + 터미널식 고정 입력. Ably/Pusher 기각, 아래 기록 참고)
- [x] 기기 연결 암호 봉투 (아래 기록 참고)
- [ ] P4 (Dodo 브랜드済み·상품/가격 생성 대기·도메인 연결·배포·과금. MoR: Fungies 심사 대기)

## 실행 계획 (2026-09-30)
- P1: outbox·heartbeat 스키마 + 데몬 승인 중계. 돈값 코어의 로컬 절반.
- P2: 웹 inbox (보기·승인) + 기기 목록. P1과 합쳐져 첫 종단(폰 승인) 완성.
- P3: fork 실행·새 지시 + 예약 실행("PC 켜지면 실행" 경고付き). bypass 세션은 배지 + 원격 지시 주의.
- P4: 도메인 연결·배포·과금. Storage·이어서 실행·자동화 관제는 2단계.

## 기기·로그인 결정 (2026-10-01)
- `devices`에 `platform`·`hostname` 컬럼 추가, dev 적용済み. 값은 Node `os` 모듈.
- device_id = UUIDv7 (시간+랜덤). hostname 합성 반대. user_id = Auth id 그대로.
- 식별은 env 아님. 상태 파일(`~/.config/localagents/device.json`, 600). env는 배포 설정만.
- 로그인은 loopback 우선 (`localagents login` → 브라우저 OAuth → localhost 콜백 → whoami → 상태 파일). 페어링 코드는 headless 폴백.
- OS 표시는 전부 텍스트. Apple·MS 로고는 상표 허가 필요라 제외. Linux 펭귄도 통일상 제외.
- Fungies KYC 완료. Waffo 거절 메일 발송済み (출금 중국 한정).

## P3 진행 (2026-10-01, 진행 중)
- fork: `daemon/src/fork.ts` + `fork` 명령 + `sessions_meta` 대장 등록. 실측 6세션(`CLIAgentsDev (fork #1)`) 확인済み.
- 새 지시: outbox `message` 타입 + 상세 입력창. 종단 검증済み (웹 전송 → poll `message done` → 에이전트 응답 확인).
- 상세 307 해소済み. 원인은 손 복사 id 오기 (db 행 `...8ph...I41` vs 입력 `...Bph...I4i`). 목록 제목 링크화로 재발 방지. 코드 정상이었음.
- 남은 것: 예약 실행 ("PC 켜지면 실행" 경고 + 부팅 catch-up).

## 1줄 설치 설계 (2026-10-03 확정, 미구현)
- 목표: `npx localagents login` 1줄에 설치·OAuth·등록·서버기동·주기실행까지. 붙여넣기 0건.
- 데몬이 서버 직접 기동済み (`daemon/src/serve.ts`: 기존 탐색 → 없으면 자식으로 기동, 비번 랜덤 32B 상태 보관, 포트 4096~4105 폴백, 종료 시 kill).
- 비번은 상태 파일 일원화. 명시 명령도 env 없이 됨. OS unit은 `EnvironmentFile` 1개 (`DATABASE_URL`만).
- 남은 것: 없음 (토큰 API 전환済み, loopback済み, OS 등록済み). 1줄 설치 remaining: 플러그인 자동 설치.

## 브랜드 확정 (2026-10-03)
- 상호 `LocalAgentsLink`, 도메인 구입済み. `cliagents.dev`는 리다이렉트용 유지.
- 개명 검토 기록: `CLI`는 CLI·GUI 병행 현실과 어긋남 (OpenCode·Claude 데스크톱 존재). `overlord` 전멸. `agentsync` 계열 사용 금지 (AGENTSYNC 미국 등록상표 6836288호, 권리자 소송 전적. `agenticsync`·`localagentsync` 포함).
- `remote*`는 부속을 본체로 오해시킴. `.tech` 갱신 함정 (`remoteagent.tech` $9.99→$49.20) 주의.

## Dodo 가입 (2026-10-03 진행 중)
- 후보 1순위 등극. 4%+40¢(美내)+1.5% 해외+0.5% 구독. 한국 merchant·KRW·카카오/네이버/페이코 가능. SaaS·AI 환영 명시.
- 출금은 Local (국내망). 국민은행 코드 004. 이름 여권 영문, 예금주 은행 기록 그대로, 주소 영문 로마자, 우편 5자리.
- 개인 자격 가능. 계좌개설확인서 영문 권장 (없으면 한글 + 영문명 로마자 표기).
- 주소 영문 예시: `302-ho, A-dong, 41, Seongan-ro 3-gil, Gangdong-gu, Seoul`, City `Seoul`.

## 토큰 API (2026-10-03, heartbeat 완료 → 2026-10-06 정리)
- `device_tokens` (해시·만료·revoke) + `lib/auth/device.ts` 검증 + `POST /api/heartbeat`.
- heartbeat API 경유 확인. 웹 online 표시 확인.
- sync·messages·commands/next 전환済み. `register`·`token` 명령은 삭제 (`login`이 대체).
- `whoami` 확장: 이메일(`neon_auth.user`) + 플랜. `status`에는 안 넣음.
- `GET /api/commands/pending` (읽기 전용 count. `next`는 delivered 부작용이라 `status`에서 사용 금지).

## loopback 로그인 (2026-10-05 완료 → 2026-10-06 봉투화, 이 PC)
- 흐름: 데몬 `login` → pack 사전 포장 → 브라우저 OAuth → Connect → 콜백 토큰 → whoami → 상태 파일. `logged in` 확인.
- URL 평문 0: `begin?data=` → sign-in(`callbackURL=/r/<blob>`) → consume → `authorize?data=`. 쿠키 폴백 유지.
- 교훈: dev 서버 구코드 주의 (재시작 후 시험). Neon 수면 시 첫 연결 실패 가능 (재시도).

## 플러그인 통지 (2026-10-06 완료)
- 구현: `daemon/plugin/localagents-sync.js` + `daemon/src/spool.ts` (`drainSpool`, `poll`에 연결済み).
- v2 모양 `export default { id, server, setup }` + 종류별 키 (generic `event` 키 미발화, `gk-hooks.js` 대조로 확정).
- KEEP: tool/permission/session + 텍스트 완성 신호(`text.ended`·`step.ended`). reasoning은 제외 (PC 밖 반출 금지).
- 2층 루프 (2026-10-06): 10초 빠른 층(스풀+drain+명령) + 플랜 주기 느린 층. 467건 3틱 drain 실측.
- drain 상한 20 → 200. 커서가 중복을 걸러 해롭지 않음.

## 메시지 동기화 B안 (2026-10-05~06 완료)
- PK `(tab_id, seq)` → `(tab_id, message_id)` (`0008`, dev 적용). upsert 멱등 + `createdAt, seq` 정렬.
- 커서 증분 (`daemon/src/cursors.ts`, PC 로컬): `(createdAt, messageId)` 쌍 비교. 1회차 213행 → 2회차 0행 실측.
- 조건부 backfill (`daemon/src/localdb.ts`, `backfillMissing`): 로컬 DB 읽기 전용으로 마지막 compaction까지 거슬러 올라가 현재 세션 전부. 클라우드 탭 목록(`GET /api/sync`) 대조 후 없는 탭만. 실측 316행→382행.
- API 한계 실측: `limit` 최대 200, `offset` 무시. 현재 세션 310행 사례로 DB 직독 필수 확정.
- compaction 실측: `session_message` `type='compaction'`, `reason=manual` 9건 (4개 탭), 자동 0건. 키 `status·reason·summary·recent·time`. 주체는 `reason` 1개로만 구분.
- compaction 전용 UI: `kind=compaction` + 접힌 박스 (`Session compacted. Show summary.`, 영어). 구 `summary`행도 같이 그림.

## 실시간 폴링 (2026-10-06 완료)
- Ably/Pusher 기각: 종단 latency가 daemon 10초에 묶여 푸시 이득 4초뿐. Neon 읽기 1방은 푼돈.
- `GET /api/messages?tabId=` + `lib/neon/live.ts` (`useLiveThread`, 5초, 탭 숨김 시 정지).
- 터미널식 레이아웃: 입력 하단 고정, 대화만 스크롤, 바닥 근처 자동 추적. Agent·승인은 접이식.

## 기기 연결 암호 봉투 (2026-10-06 완료)
- `lib/auth/packet.ts` (AES-256-GCM, 키 `DEVICE_PACKET_KEY` 64hex, `.env.local`のみ).
- 이중 봉투: 안쪽 기기 파라미터 → 바깥쪽 복귀 경로 문자열 통째. URL엔 암호문만 (`/r/[blob]` 관문, allowlist).
- 데몬은 `POST /api/device/pack`으로 사전 포장 후 `begin?data=` 오픈. 첫 주소창부터 평문 없음.
- `login` 직후 첫 동기화 (heartbeat+세션+조건부 backfill). 1회성 명령 종료 hang 수정 (`killOwned`).

## UI 개선 (2026-10-07 진행 중, 최우선)
- 스킬: `design-taste-frontend` (audit-first) + `ui-ux-pro-max` 검색 (대시보드 규칙: 본문 65~75자) + `ui-styling` (토큰 일관). `impeccable`은 문서のみ 미설치.
- 세션 통계 실데이터 (`0009`, `eeed0cd`): `sessions_meta`에 cost·last 호출 토큰 5종·누적 횟수·생성시각. 마지막 assistant 행 tokens = 패널 수치와 일치 실측. 횟수는 누적이라 패널 live-window와 다름 (명시).
- 표시명·제한은 카탈로그에서 해결 (모델명·`limit.context`, `/api/provider` 추가 수집). 사용률 = 합계/제한.
- presence 점 (● 초록/빨강) + 5초 폴링에 포함. 하트비트 10초 분리. `never synced` 수정 (쓰는 코드가 없었음).
- 레이아웃: 7:3 2열 (대화·우레일), 입력 하단 고정 컴포저 (선택 즉시 적용, Enter 전송), 제목 레일로 이동, 전체 스크롤 제거 (`100dvh-헤더`).
- tool: edit diff 표시 (+A/-B 초록빨강, 0 흰색) + 펼침 diff 색상. 요약 경로 전체 유지.
- 스크롤바 slim (핸들만 6px) + 대화창 우패딩. 점프 버튼 가운데.
- 미커밋 UI batch 커밋済み (`d52a72d`). synced 실시간 포함.
- 대형 edit diff 생략 (`2713738`) + envelope 필드 단위 절단 (`f3d8352`).
- 교훈: 데몬 빌드 뒤 반드시 재시작. 구 dist가 30분마다 null로 덮음 실측.

## 인계 모델 확정 (2026-10-07)
- 본질: 웹 원격조작 아님 (그럴 거면 SSH). 다른 PC에서 원 PC 세션을 '그대로' 이어받기.
- 역할 분리: 웹↔클라이언트는 Neon DB (거울+outbox, 열람·명령용). 클라이언트↔클라이언트는 Storage 세션 파일 (운반용).
- 파일: 탭당 현재 세션만 (message+part+session 3종, events 제외). 덮어쓰기 금지 → push마다 버전 파일 1개 + DB에 최신 포인터 1개. 만료+수신확인 후 삭제 (즉삭 금지).
- 키: `<userId>/<tabId>/<epoch>/<version>.bin.gz` (버킷 바로 아래, `handoffs/` 접두사 없음 — 구 문서 정정). 스코프 크리덴셜로 격리. 탭당 용량 상한.
- pull 적용: 같은 id 있으면 upsert, `project_id`·`directory`는 B 기준 재매핑. 삭제 행은 tombstone 필요.
- 방송 (안, 미확정): 웹→복수 PC는 기기 수만큼 행 (설계 변경 1개). 실행 주인은 1대 (세션 affinity), 다른 PC 화면은 읽기 거울까지만. 양쪽 실행 주입은 중복 실행·승인 혼선으로 금지.
- 자동 동기화 (안, 미확정): 기본=수동 push/pull, 유료=dirty+디바운스 자동 (신호 오면 표시만, idle 1~2분·종료 때 1번 업로드). 보는 탭은 배지+확인 후 적용. 주기 차등 아님, 방식 차등.
- DB diff: 행 단위로 이미 하는 중. 삭제·스키마·충돌만 별도 처리.

## Mac 실태 + 버전 정정 (2026-10-07, 이 PC)
- 설치 없음: 바이너리·`~/.config/localagents/`·신 플러그인 없음. 구 `cliagent` 잔재는 유지 (손대지 않음).
- serve 1.18뿐 (2.x 번들 없음). v2 플러그인 미발화 실측済み → 즉시 통지 불가, 10초 폴링층으로 동작. 거울/heartbeat/push는 버전 무관.
- 정정: 이 Mac 데스크톱은 1.18.25 (v2 아님). v1 라인(1.18.x, 09-28에 1.18.33)이 현역, v2(2.0.20)는 별도 라인 공존. CLI 1.18.2 + 데스크톱 1.18.25 = 둘 다 v1.
- DB 세션 7개 전부 1.18 (1.18.2×3, 1.18.25×4), archived 0, 포크 자식 0. 최신은 이 세션 (10-06 03:30).

## 세션 정리 2차 (2026-10-07 완료, 이 PC)
- 삭제 3개 + 연관 전부 (9 테이블 고아 0 확인): API 테스트 2개 + 회귀수선전. 백업 `opencode-backup-20261006.db` 855MB.
- 개명 4개: jaeholee.xyz / ShortReal AI / TailoredAd / LocalAgentsLink.
- 용량: 폴더 995MB, event 441MB + part 371MB + message 6.7MB. 대화 본체는 그대로 가벼움.

## 서명 URL 인계 (2026-10-08 완료, 이 PC)
- 방식 확정: 데몬 `AWS_*` 삭제. `POST /api/handoffs/url`이 서버 `NEON_API_KEY` 1개로 서명 발급 → 데몬 직행. 업로드·다운로드 왕복 실측済み.
- 근거: Neon presign endpoint (`.../buckets/{b}/objects/{k}/presign`, Beta) + S3 `getSignedUrl` 둘 다 문서상 지원. 실측은 전자.
- 키 보관: 서버 `.env.local`のみ (`NEON_API_KEY` + `NEON_PROJECT_ID` + `NEON_BRANCH_ID`). PC별 발급 불필요 (키=유저 식별, 접두사로 격리). endpoint는 key가 본인 userId/ 시작 강제.
- 구 버전 5건은 title NULL → 목록에 id 표시. 새로 push하면 이름 뜸.
- Storage 탐침 파일 3개 잔류 (`probe-*.bin`, 수십 바이트).

## Mac 첫 동기화 (2026-10-08 완료, 이 PC)
- 설치: `~/.local/bin/localagents` 래퍼 + 플러그인 복사 (구 `cliagents-sync.js` 유지). `login` 성공 (heartbeat via api).
- 장애 1: 첫 동기화 4개 전부 실패. 원인 = `localdb.ts` darwin 경로 단정 (`~/Library/...`에 파일 없음, 이 Mac은 XDG). 양쪽 probe로 수정.
- 장애 2: `session_message` 0행 — 1.18은 `message`+`part` 사용. v1 리더/라이터 추가 + 맛보기 자동 선택. 크로스버전(v2→v1)은 id 유지·그릇 변환.
- pull upsert 실측: 272행 버전 → 새 탭 생성, 메시지 52+파트 214, 내용 원형. 있으면 병합·없으면 생성. 삭제 행은 미동기화 (tombstone 다음).
- `b5ef5f6` 푸시済み.

## OS 등록 (2026-10-03 완료 → 2026-10-06 개명, Arch)
- `~/.local/bin/localagents` 래퍼 + `~/.config/localagents/env` (DATABASE_URL 1개, 600) + systemd user unit `localagents.service`.
- `enable --now`済み. `active (running)` 확인. 재부팅 테스트 미실시.

## 데몬 종단 검증 (2026-09-29, 이 PC)
- 명령: `daemon/`에서 build 후 자체 serve(번들 CLI 2.0.18, 4096, 비번) → `status`·`sessions` 성공. 세션 5개 제목 출력 확인.
- 교훈 3개: (1) 데스크톱 v2 API는 `/api/*` 아래 + 인증 필수. HTML 폴백에 속지 말 것. (2) health 엔드포인트 없음. 탐색 기준은 `/api/session` 목록 조회로 변경. 목록 형태 `{data:[...]}` 래퍼 주의. (3) 시스템 CLI 1.18과 데스크톱 번들 2.0.18 버전 꼬임. serve는 번들 CLI로 띄울 것.
- `daemon/tsconfig.json` 수정 1건 (`lib` DOM + `types` node)._tsbuildinfo 계열은 `.gitignore`済み.

## 승인 종단 (2026-10-01 완료, 이 PC)
- 흐름: ask 설정 serve(4097) → bash 지시 → pending 포착 → 데몬 `sync` 거울 → 웹 상세 Allow → outbox → 데몬 `poll` 응답 → 에이전트 실행 → 파일 `WEB-APPROVE-OK` 확인. 대기 목록 비움 확인.
- 테스트 세션·파일·serve 정리済み. `pkill -f` 자기매칭 주의 (PID 지정으로 대체).
- 남은 것: P3 (fork·새 지시·예약 실행), P4 (도메인·배포·과금).

## outbox 종단 (2026-09-30 완료, 이 PC)
- 스키마: `commands`(우체통, pending→delivered→done→expired + 멱등키·만료) + 거울 3종(`cloud_tabs` UPDATE 헤더, `cloud_messages` INSERT-only 복합키, `cloud_folds` epoch 요약). `0001_massive_plazm.sql` → Neon dev 적용, 6 테이블 실측 확인.
- 데몬: `daemon/src/db.ts`(Neon 직결) + `commands.ts` + `poll` 1회 수행. 의존성 `@neondatabase/serverless 1.1.0` 추가. env는 `DATABASE_URL` + `LOCALAGENTS_DEVICE_ID` (pairing 미구현이라 수동).
- 웹: `POST /api/commands`(outbox INSERT) + `lib/utils/getNextBaseResponse.ts`. curl 201 → 데몬 `poll`이 같은 행 `done` 회수. 웹→PC 종단 완성.
- 잡음 정리: `drizzle.config.ts`가 `.env.local`을 안 읽어서 generate 실패 → 2줄 로딩으로 수정. `.env.example` 실값 유출未遂 → 플레이스홀더로 복구 (`.env.local`은 무시됨 확인). `next-env.d.ts` 추적 해제 + gitignore. `AGENTS.md`의 nextjs-agent-rules 블록은 `next dev`가 자동 추가한 것이라 커밋.
- dev DB 테스트 행: `devices/test-pc-1`, `commands/cmd-ping-1` + 웹 ping 1건. 전부 `done`. 둬도 됨.
- 미결: heartbeat 방식 (`devices.lastSeenAt` 갱신 vs 전용 테이블).
