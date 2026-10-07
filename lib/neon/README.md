# lib/neon

Neon 제어DB 개인 라이브러리. 나중에 `@agentgit/db` 패키지로 떼어내는 것을 전제로 작성한다.

## 구성

- `client.ts` — `createNeonClient(connectionString)` 팩토리 + 앱용 `getDb()` 싱글톤
- `schema.ts` — 앱 테이블. Better Auth 테이블은 Neon Managed 스키마(`neon_auth`)에 두어 여기와 분리한다
- `index.ts` — 공개 API 배럴

## 원칙

- `client.ts` 팩토리는 `process.env`를 직접 읽지 않는다. 패키지로 옮겨도 그대로 동작한다
- transcript 전문·payload 저장은 금지. 메타·요약만 둔다
- 새 프로젝트에서 쓸 때는 이 폴더 통째로 복사하거나 패키지로 승격한다
