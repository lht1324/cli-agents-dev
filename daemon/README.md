# daemon (`cliagent`)

cliagents 상주 데몬 뼈대. 같은 PC의 OpenCode 서버를 찾아붙는다.

## 원칙

- 기존 serve를 찾아 attach가 기본. 없으면 직접 띄우지 않고 안내만 한다
- 서버 API経由. db 직접 읽기는 백업 경로로만 둔다
- 전송은 gzip + 키 `(session_id, seq)`. 로그 INSERT-only

## 명령

- `cliagent status` — 서버 탐색 + 상태 확인
- `cliagent sessions` — 세션 목록 출력
- `cliagent login` — 페어링. 미구현

## 다음 단계

- WS 명령 큐 수신 + 주기 푸시
- fork 실행 + 승인 응답 중계
- `npx cliagent` 배포용 패키지 승격
