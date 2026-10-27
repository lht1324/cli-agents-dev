# Skills 관리 가이드

이 프로젝트의 AI 에이전트 스킬은 `npx skills` CLI(Anthropic skills)로 설치·관리합니다.

> **설치 원칙**: 스킬은 **반드시 전역(`~/.agents/skills/`)으로 설치**합니다. `npx skills add` 실행 시 `-g` 플래그를 붙이지 않으면 프로젝트 로컬(`.agents/skills/`)에 설치되므로 주의하십시오. 프로젝트 로컬 설치는 피하며, `.agents/skills/`와 `skills-lock.json`은 Git 추적 대상이 아닙니다. 새 PC에서는 아래 명령으로 필요한 스킬을 직접 설치하십시오.

## 스킬 목록 (카테고리별)

### 디자인 / UI·UX
| 스킬 | 출처 | 용도 |
|---|---|---|
| impeccable | pbakaus/impeccable | 디자인 전반 — shape/critique/audit/polish/bolder 등 명령 26종 |
| ui-ux-pro-max | nextlevelbuilder/ui-ux-pro-max-skill | 로컬 검색 기반 UI/UX 인텔리전스 (스타일·팔레트·폰트·UX 규칙 DB) |
| ui-styling | nextlevelbuilder/ui-ux-pro-max-skill | UI 스타일링 보조 |
| design-taste-frontend | Leonxlnx/taste-skill | 안티-슬롭 프론트엔드 (v2, 기본값) |
| design-taste-frontend-v1 | Leonxlnx/taste-skill | 구버전 taste (호환용 보존) |
| gpt-taste | Leonxlnx/taste-skill | 엘리트 UX/UI + GSAP 모션 |
| high-end-visual-design | Leonxlnx/taste-skill | 하이엔드 에이전시 디자인 |
| minimalist-ui | Leonxlnx/taste-skill | 에디토리얼 미니멀 UI |
| industrial-brutalist-ui | Leonxlnx/taste-skill | 브루탈리즘 UI |
| image-to-code | Leonxlnx/taste-skill | 이미지 → 코드 |
| redesign-existing-projects | Leonxlnx/taste-skill | 기존 프로젝트 프리미엄 업그레이드 |
| brandkit | Leonxlnx/taste-skill | 브랜드 키트/아이덴티티 보드 이미지 생성 |
| imagegen-frontend-web | Leonxlnx/taste-skill | 웹 프론트엔드 이미지 디렉션 |
| imagegen-frontend-mobile | Leonxlnx/taste-skill | 모바일 앱 스크린 이미지 생성 |
| stitch-design-taste | Leonxlnx/taste-skill | Google Stitch용 디자인 시스템 |
| brand | nextlevelbuilder/ui-ux-pro-max-skill | 브랜드 보이스/아이덴티티 |
| design | nextlevelbuilder/ui-ux-pro-max-skill | 종합 디자인 (로고/CIP/배너/아이콘) |
| design-system | nextlevelbuilder/ui-ux-pro-max-skill | 디자인 토큰/시스템 |
| banner-design | nextlevelbuilder/ui-ux-pro-max-skill | 소셜/광고 배너 디자인 |
| slides | nextlevelbuilder/ui-ux-pro-max-skill | HTML 프레젠테이션 |

### 컴포넌트 / 코딩
| 스킬 | 출처 | 용도 |
|---|---|---|
| shadcn | shadcn/ui | shadcn 컴포넌트 설치·관리·스타일링 |
| migrate-radix-to-base | shadcn/ui | Radix → Base UI 마이그레이션 |
| full-output-enforcement | Leonxlnx/taste-skill | 코드 생성 잘림 방지 |
| customize-opencode | built-in | opencode 자체 설정 관리 |
| ponytail | (글로벌) | 최소한의 해법 (YAGNI) |
| ponytail-audit / review / gain / debt / help | dietrichgebert/ponytail | ponytail 부가 도구 (코드 감사·리뷰·이득/부채 분석) |
| find-skills | (글로벌) | 스킬 탐색/설치 안내 |

### SEO / 마케팅 / 애널리틱스
| 스킬 | 출처 | 용도 |
|---|---|---|
| seo ~ seo-technical (24종) | AgricIDaniel/claude-seo | SEO 감사·기술·콘텐츠·스키마·GEO·백링크 등 |
| analytics | (글로벌) | 애널리틱스 추적 설정/감사 |
| tracker | (글로벌) | Hellyeah/tracker 소스 계측 |
| hellyeah | (글로벌) | Hellyeah CLI 광고 캠페인 운영 |
| copywriting | (글로벌) | 마케팅 카피 작성 |
| cro | (글로벌) | 전환율 최적화 |
| signup | (글로벌) | 가입 플로우 최적화 |
| onboarding | (글로벌) | 온보딩/활성화 최적화 |
| pricing | (글로벌) | 요금제 설계 |
| product-marketing | (글로벌) | 제품 마케팅 컨텍스트 문서 |

## 새 PC / 처음 설치하는 방법

스킬은 PC별로 설치하므로, Git pull 후 아래 명령으로 필요한 스킬을 직접 설치합니다.

```bash
npx skills add shadcn/ui -g -y                       # shadcn 컴포넌트 (전역)
npx skills add pbakaus/impeccable -g -y              # 디자인 전반 (전역)
npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill -g -y   # UI/UX 인텔리전스 (전역)
npx skills list -g                                   # 설치 확인
```

## 스킬 추가/제거/업데이트

```bash
npx skills add <repo> -g -y            # 전역 설치 (예: npx skills add shadcn/ui -g -y)
npx skills update -g                   # 전역 스킬 최신화
npx skills remove <이름> -g -y          # 전역 스킬 제거
npx skills list -g                     # 전역 목록 확인
```

⚠️ 스킬을 설치/제거했을 때는 `/SKILLS.md`의 목록도 함께 갱신하십시오. ⚠️ 전역 설치 시 `-g` 플래그 필수 — 잊으면 프로젝트 로컬에 설치됩니다.

## 참고

- 실제 파일: `.agents/skills/<이름>/` (opencode가 스캔)
- `.claude/skills/`는 Claude Code 호환용 **심링크** (중복 아님, Git 추적 대상 아님)
- `skills-lock.json`: package-lock.json 역할 — 스킬 출처·경로·해시 기록. Git 추적 대상 아님.
- opencode는 **세션 시작 시** 스킬 목록을 로드함 — 새 스킬 설치는 새 세션을 열어야 반영됨
