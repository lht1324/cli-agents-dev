2026-09-28 01:43

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

## 데이터·요금 원칙
- Neon에는 세션 메타/요약만. transcript 전문 저장 금지 (요금+개인정보).
- 개인정보: 기본 메타만 수집, 본문은 opt-in + 로컬 마스킹(sk-*, ghp_* 등) + 30일 보관.
- 플랜별 동기화 차등: 30분/10분 배치 vs 쿼리마다 실시간. 플래그 1개로 제어.

## 결제사 점검 결과
- Polar / Paddle / Lemon Squeezy / Creem / Fungies.io 모두 devtool SaaS 허용.
- 금지는 AI 이미지·딥페이크·음성복제·스파이웨어 한정. 세션 매니저는 workflow측이라 통과 라인.
- 주의: 타서비스 우회 마케팅 금지, 지원메일·취소버튼·약관 필수.

## Neon vs Supabase 결론
- Neon Console SQL Editor로 값 확인·SQL 실행 가능. Supabase식 인라인 표편집감은 아님.
- Supabase Pro 사용량을 Neon에 얹으면 약 $23~24로 동가. scale-to-zero 저트래픽이면 Neon 압승.
- Neon은 제어DB로 도입. Realtime/Edge 대체는 별도 WS 필요.

## 다음 할 일
- [ ] MVP 범위 확정 (통합 목록+승인)
- [ ] 도메인 구매 (`cliagents.dev`, Cloudflare에서 재확인)
- [ ] Next.js + Drizzle + Neon 보일러플레이트
- [ ] SKILLS.md / 스킬 온보딩 (미착수)
