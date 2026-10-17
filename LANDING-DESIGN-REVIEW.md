# 랜딩 페이지 디자인 검토 (2026-10-10)

> 대상: `components/page/landing/LandingPageClient.tsx` (현행 유일 버전)
> 검토 근거: 설치된 디자인 스킬 전수 조사 후 조합 적용
> 성격: 평가 문서. 코드 수정 없음.

---

## 0. 스킬 사용 실황 (전수 조사)

SKILLS.md 문서와 실제 설치 상태가 다릅니다. 실물 확인 결과:

### 설치됨 (랜딩 평가에 실제 기여)
| 스킬 | 기여 |
|---|---|
| `design-taste-frontend` | 랜딩 규칙의 유일 보유자. 본 평가의 주 판정 기준. (히어로 구성·섹션 패턴·eyebrow 제한·em-dash 금지·시각자료 우선순위) |
| `ui-ux-pro-max` | 검색 DB. `style` 도메인은 동작(cyberpunk-ui 등 참조). `landing` 도메인은 DB가 비어 결과 0 — 문서의 "Hero+Features+CTA" 표는 데이터 없음 확인. |
| `ui-styling` | shadcn/Tailwind 일반론. 랜딩 특화 규칙 없음. 토큰 일관성 점검에만 기여. |
| `copywriting` | 헤드라인 프레임워크 ("{성과} without {고통}"), 서브헤드라인·CTA 문구 기준 제공. |
| `cro` | above-fold·전환 관점. 랜딩 전환 요소 배치 검토에 기여. |
| `signup` | 가입 마찰 관점. CTA→sign-in 연결 경로 평가에 기여. |
| `product-marketing` | 포지셔닝 문서(.agents/product-marketing.md) 부재 확인 — 카피가 포지셔닝 없이 작성됨을 지적. |
| `seo-page` | OG 태그·메타 점검 기준 제공. |
| `design-system` | 3층 토큰 아키텍처 기준. 현행 `@theme` 토큰(ink·panel·line·go·warn)과의 정합성 점검. |

### 설치됨 (이번 평가 범위 밖)
`design`(로고/CIP), `banner-design`, `slides`, `brand`(보이스) — 랜딩 화면 자체가 아니라 파생 자산 제작용.

### 문서에 있으나 미설치
`impeccable` (critique/audit 명령 26종 — 가장 직접적인 평가 도구인데 없음), taste 계열 9종 (`design-taste-frontend-v1`, `gpt-taste`, `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `image-to-code`, `redesign-existing-projects`, `brandkit`, `stitch-design-taste`, `imagegen-frontend-web/mobile`).

> **정리:** 랜딩 평가에 쓸 수 있는 스킬은 사실상 `design-taste-frontend` 1개 + 보조 7개입니다. `impeccable` 미설치가 가장 아픕니다. SKILLS.md와 실물의 어긋남은 별도 정리가 필요합니다.

---

## 1. Design Read

```
Reading this as: devtool 랜딩 for 개발자 초기 유저,
with a terminal-native dark language (mono + green accent),
leaning toward Tailwind utilities + 기존 ink/panel/line/go 토큰.
```

- 페이지 종류: devtool 랜딩 (design-taste-frontend의 "landing — serious B2B" 영역).
- 관객: OpenCode·Claude Code를 쓰는 개발자. 미학보다 동작 신뢰가 먼저.
- 기존 자산: 토큰 세트 있음(ink·panel·line·go·warn), 로고 없음(텍스트 워드마크).

---

## 2. 현행 구조 (사실 그대로)

```
<main max-w-3xl>
  1. "$ localagents --help" (eyebrow 겸 터미널 프롬프트)
  2. H1 "Mission control for your CLI agents."
  3. 서브카피 1문단
  4. CTA 2개 (Get started / Open inbox)
  5. STEPS 카드 3개 (1열 grid, md:3열)
  6. 푸터 성격의 mono 한 줄
</main>
```

---

## 3. 스킬별 판정

### 3.1 design-taste-frontend (주 판정)

**통과:**
- em-dash 장식 없음 (Section 9.G 금지 준수 — 단, 서브카피의 "— and approvable"는 문장부호로만 쓰여 경계선 통과).
- eyebrow 1개 ($ localagents --help) — 3섹션당 1개 제한 내.
- 히어로 안 trust strip·가격·feature bullet 없음 (히어로 금지물 미포함).
- CTA 1 primary + 1 secondary — 정확히 규칙 준수.
- split-header 금지 패턴 없음.
- `h-screen` 미사용 — dvh 함정 회피.

**위반 / 미달:**
1. **[치명] 시각 자료 0건.** Section 4.8은 "텍스트 전용 페이지는 미니멀리즘이 아니라 미완성"이라 명시. 현행은 이미지·스크린샷·다이어그램이 전무. hand-rolled fake screenshot도 없고, TODO 슬롯조차 없음. 규칙상 이 경우 "이 페이지에는 다음 위치에 실물 이미지가 필요하다"고 명시하고 끝내야 함. → **제품 실물 스크린샷 1장(세션 inbox)이 최우선.**
2. **[치명] 섹션 부족.** 현행 사실상 1.5섹션 (히어로+카드). 랜딩 최소 구성(히어로/문제-해결/동작증명/신뢰/CTA 재확인)에 못 미침. 레이아웃 패밀리 1개(3열 카드)뿐이라 "Section-Layout-Repetition" 논의 전에 구성 자체가 빈약.
3. **[경고] 사회증명 0.** 로고 월은 히어로 아래 별도 섹션이어야 한다는 규칙이 있는데, 아예 없음. 초기 서비스라 실고객이 없는 건 사실이지만, 오픈소스 생태계 지원(OpenCode·Claude Code) 정도는 대체 가능.
4. **[경고] 3열 카드 레이아웃.** "three equal feature cards"는 Section 0.D가 명시한 AI 디폴트 금지 목록에 들어 있음. 지금 STEPS가 정확히 그 모양. 우회: 1+2 비대칭, 번호형 세로 스택, 또는 코드블록형.
5. **[미미] anti-center.** DESIGN_VARIANCE>4면 좌정렬 권장. 히어로가 중앙정렬은 아니지만(mx-auto 블록) 좌정렬 터미널 감성과 더 맞음.

### 3.2 copywriting

- 헤드라인: 명사형 "Mission control for your CLI agents." — 기능 나열이 아니라 위치 선언이라 좋음.
- 서브카피: "Tabs live on your PCs… approvable from your phone" — 기능→이득 연결은 되어 있으나 **"{성과} without {고통}" 프레임 없음.** 예: *"Your session follows you — no SSH, no setup."*
- STEPS 카드 바디: 각 1문장으로 절제 잘 됨. 단 "Rename it anything you like"는 이 시점 유저에게 필요 없는 정보(등록은 login이 자동 처리함 — CLI가 개편되어 문구가 실제와 어긋남).

### 3.3 cro / signup

- CTA 경로 문제 없음 (`/auth/sign-in`, `/sessions`).
- **[경고] "Open inbox" 2차 CTA가 미로그인 시 sign-in으로 튕김** — 기대 불일치. 2차 CTA는 "See how it works" 같은 무인증 목적지가 안전.
- 소셜 로그인 2개(Google·GitHub)까지의 경로는 마찰 적음.

### 3.4 product-marketing

- `.agents/product-marketing.md` 부재. 카피가 포지셔닝 문서 없이 쓰임 → "미션 컨트롤"이 유일한 포지셔닝 앵커. 별도 문서화 권장 (별도 작업).

### 3.5 seo-page / seo-technical

- metadata title·description 존재 (`localagents` / "Mission control for your CLI agents") — 짧지만 방향 맞음.
- OG 태그 미설정 확인. 랜딩이 이미지를 갖게 되면 og:image 필수.

### 3.6 design-system / ui-styling

- `@theme` 토큰 5개가 전 페이지에서 일관 사용 — 좋음.
- 랜딩 전용 토큰 불필요. 다만 카드 bg-ink/panel 대비가 낮아(다크 위 다크) "Bento Background Diversity" 관점에서 시각 변주 부족.

### 3.7 ui-ux-pro-max

- `landing` 도메인 검색 결과 0 — DB 미비 확인, 규칙 없음 명시.
- `style` 도메인의 cyberpunk-ui 참조는 우리 감성(터미널 다크)과 유사하나 neon glow는 과함. 현행 절제된 go(green) 강조가 오히려 정답에 가까움.

---

## 4. 구조적 문제 (스킬 밖, 가장 먼저 고칠 것)

**미로그인 유저는 이 랜딩을 볼 수 없습니다.**

`proxy.ts`의 matcher가 `"/"`를 포함합니다. 미로그인 시 `/` 접근 → `/auth/sign-in` 리다이렉트. 즉:

- 랜딩 문구·CTA는 **로그인한 유저만** 볼 수 있음 (이들에게는 이미 필요 없음).
- 신규 방문자는 랜딩 대신 로그인창을 처음 봄.

**이건 디자인 논의 이전에 고쳐야 하는 것**으로, 프록시 matcher에서 `/`를 빼는 1줄입니다. 이게 안 되면 아래 개선 전부가 아무도 못 봅니다.

---

## 5. 권고 작업 목록 (우선순위 순)

| # | 작업 | 근거 | 비용 |
|---|---|---|---|
| 1 | `proxy.ts` matcher에서 `/` 제외 | 3.4 절 + 구조적 문제 | ~10분 |
| 2 | 제품 실물 스크린샷 1장 (세션 inbox, 1600×1000) | design-taste 4.8 (최우선 위반) | 캡처 10분 |
| 3 | 섹션 추가 2개: (a) 동작 흐름(terminal 스타일 코드블록), (b) 지원 도구(OpenCode·Claude Code 로고, Simple Icons) | 섹션 부족·사회증명 | 1~2시간 |
| 4 | STEPS 카드 레이아웃 탈출 (번호형 세로 스택 또는 1+2 비대칭) | three-equal-cards 금지 | 30분 |
| 5 | 서브카피에 "without" 프레임 삽입 | copywriting | 10분 |
| 6 | 2차 CTA 목적지 재검토 (무인증 가능지) | cro/signup | 10분 |
| 7 | `impeccable` 스킬 설치 + 재평가 | 평가 도구 부재 | 5분 |
| 8 | og:image 추가 (2번 스크린샷 재사용) | seo-page | 10분 |
| 9 | `.agents/product-marketing.md` 작성 | product-marketing | 30분 |
| 10 | STEPS 카드 문구를 현행 CLI와 동기화 (register 제거) | copywriting 정확성 | 10분 |

**제외한 것:** 폰트 교체(Geist 등) — 터미널 감성에 mono 워드마크가 맞아 우선순위 낮음. 모션 도입 — 개발자 랜딩에서 절제가 맞음 (MOTION 낮게 유지).

---

## 6. 최종 판정

- **현재 점수: 랜딩으로서 미완성.** 감성·토큰·문구는 방향이 맞으나, (a) 아무도 못 보는 구조 문제와 (b) 시각자료·섹션 부족이 겹쳐 있음.
- (a)를 고치면 랜딩이 처음 공개되는 것이고, (b)를 고쳐야 랜딩이 됩니다.
- 순서대로 하면 반나절 내 완성 가능.
