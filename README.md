# Skill Library

<a href="https://airoasting.github.io/skill_library/"><img src="asset/og-image.png" alt="AI Roasting · Skill Library — 비즈니스 리더를 위해 엄선한 AI 스킬" width="100%"></a>

비개발자 비즈니스 리더를 위해 큐레이션한 Claude 스킬·플러그인·MCP 카탈로그입니다. 현재 **149개 카드 · 13개 카테고리 · 26개 에디터픽**이 등록되어 있고, 모든 데이터는 단일 파일 `skills.json`에서 관리합니다.

🌐 라이브 사이트: <https://airoasting.github.io/skill_library/>

## 무엇이 들어 있나

- **3개 메타 카테고리**로 묶인 13개 세부 카테고리
  - 🏗 **AI 에이전트팀 구축** — 하네스/에이전트 설계, AI와 일 잘하는 법, 토큰 절약, 외부 연동·MCP, 한국 특화
  - 📈 **비즈니스 성장** — 그로스·마케팅, 투자·금융, GEO·AEO
  - 🎯 **실행력 제고** — 리서치·인사이트, 디자인, 글쓰기, 법무·컴플라이언스, 커리어·이직
- 카드별 정보: `repo`, `author`, `stars`, `desc`(한국어 2문장), `tags`, `lang`, `added_at`, `editors_pick`
- `meta_categories[]`·`categories[]` 정의에는 "이 카테고리는 어떤 일을 위한 것인가"가 한 줄로 들어 있어, 자연어로 골라 쓰기 좋습니다.

## 두 개의 슬래시 커맨드

이 저장소를 Claude Code에서 열면 두 커맨드가 자동으로 잡힙니다. 라이브러리는 한쪽으로 **카드를 모으고**(`/add-skill`), 다른 쪽으로 **카드를 꺼내 쓰는**(`/find-skill`) 구조로 설계됐습니다.

### `/find-skill` — 라이브러리에서 스킬 찾기

> 등록된 카드 중에서 사용자의 상황에 가장 잘 맞는 것을 골라주는 추천 커맨드.

**언제 쓰나.** "지금 이 일에 어떤 스킬을 깔아야 하지?"가 막막할 때. 카테고리를 직접 둘러보지 않아도, 하고 싶은 일을 한 줄로 던지면 카탈로그 안에서 가장 가까운 카드 N개를 골라줍니다.

**사용 예시**

```
/find-skill 한국어로 쓴 보고서 초안에서 AI 티 좀 빼고 싶어
/find-skill 이번 분기 실적 발표 자료 만드는 데 도움 받을 도구
/find-skill --cat finance 종목 리서치 자동화
/find-skill --pick 처음 깔면 가장 임팩트 큰 스킬 3개
```

**옵션**

| 옵션 | 설명 |
|---|---|
| `--n <int>` | 추천 개수 (기본 3, 최대 8) |
| `--cat <category-id>` | 특정 카테고리로 한정 |
| `--meta build\|growth\|execution` | 메타 카테고리로 한정 |
| `--pick` | `editors_pick: true`인 카드만 |

**무엇을 보고 고르나.** 사용자의 자연어 질의에서 작업 의도와 제약(한국어, 비개발자, 도메인 등)을 분리한 뒤, 각 카드의 의도 적합도·카테고리 정의·제약 충족·신뢰 보정을 합산해 상위 N개를 뽑습니다. 결과가 한 카테고리에 몰리면 같은 카테고리 최대 2개로 제한해 다양성을 확보합니다.

**무엇을 안 하나.** 이 커맨드는 **라이브러리 안의 카드만** 봅니다. 외부 도구나 신규 후보를 추천하지 않아요. 라이브러리에 없는 분야면 "여긴 없어요"라고 솔직히 답하고 `/add-skill`로 안내합니다. 점수·내부 룰을 출력에 노출하지 않고, 결과만 한국어 카드 형식으로 보여줍니다.

자세한 동작 규칙은 [.claude/commands/find-skill.md](.claude/commands/find-skill.md) 참고.

### `/add-skill` — 라이브러리에 카드 추가

> GitHub 주소를 받아 `skills.json`과 `index.html` 인라인 블록에 새 카드를 안전하게 등록하는 커맨드.

**언제 쓰나.** 새로 발견한 스킬·플러그인·MCP를 카탈로그에 올리고 싶을 때. 단순히 JSON에 줄을 추가하는 게 아니라, 비즈니스 리더 라이브러리라는 정체성에 맞는지 여러 게이트를 통과시켜 큐레이션 품질을 지킵니다.

**사용 예시**

```
/add-skill https://github.com/owner/repo workflow
/add-skill owner/repo finance --pick
/add-skill https://github.com/owner/repo --fb https://facebook.com/.. --li https://linkedin.com/in/..
```

저자의 페이스북/링크드인/X 주소(`--fb` `--li` `--x`)를 같이 넘기면, 카드가 아니라 `skills.json` 최상위 `authors` 맵에 저자 단위로 저장돼 같은 저자의 다른 카드에도 자동으로 소셜 버튼이 붙습니다.

**내장 게이트**

- **0.5 중복 검사** — 같은 `repo`가 이미 있으면 네트워크 호출 없이 즉시 중단.
- **1 저장소 분석** — `gh` CLI 또는 WebFetch로 description·stars·primary language·topics·README를 수집해 카드 본문 작성에 사용.
- **2 카테고리 검증** — README/topics를 카테고리 정의와 매칭해 더 적합한 id가 있으면 역제안. 사용자 확인 후 진행.
- **2.7 비즈니스 리더 적합성** — 개발자 워크플로우(CI/CD, PR 자동화 등) 전용 도구는 차단되거나 사용자 확인 후에만 추가. 별 수가 높다고 자동 통과시키지 않습니다.
- **2.9 에디터픽 평가** — 효용성·대표성·신뢰성 3축 5점 평가에서 평균 4.0+ 후보만 사용자 승인 후 `editors_pick: true`. PICK 인플레이션을 방지합니다.
- **3.5 인라인 블록 동기화** — `skills.json` 변경분을 `index.html`의 `<script id="skills-data">` 블록과 카운트가 정확히 일치하도록 갱신. file:// 직접 열기에서도 데이터가 보이는 폴백을 유지합니다.

**카드 형식**

```jsonc
{
  "category": "<검증된 카테고리 id>",
  "name": "<repo name을 Title Case로>",
  "repo": "<owner>/<repo>",
  "author": "<owner>",
  "stars": <number>,
  "added_at": "<YYYY-MM-DD>",
  "desc": "<한국어 정확히 2문장, 100~160자>",
  "tags": ["#tag1", "#tag2", "#tag3"]
}
```

자세한 절차·게이트 정의는 [.claude/commands/add-skill.md](.claude/commands/add-skill.md) 참고.

## 데이터 구조

```jsonc
{
  "authors": {
    "<owner>": { "facebook": "...", "linkedin": "...", "x": "..." }
  },
  "meta_categories": [
    { "id": "build", "name": "AI 에이전트팀 구축", "emoji": "🏗", "desc": "..." }
  ],
  "categories": [
    { "id": "workflow", "meta": "build", "name": "AI와 일 잘하는 법",
      "emoji": "🚀", "desc": "..." }
  ],
  "skills": [
    {
      "category": "workflow",
      "name": "Superpowers",
      "repo": "obra/superpowers",
      "author": "Jesse Vincent",
      "stars": 184535,
      "forks": 16395,
      "desc": "이 스킬은 ... 입니다. ... 때문에 ...에 적합합니다.",
      "tags": ["#workflow-engine", "#tdd", "#brainstorming"],
      "lang": "Shell",
      "added_at": "2025-10-09",
      "editors_pick": true
    }
  ]
}
```

`skills.json`이 단일 진실 공급원이지만, 정적 호스팅(`file://` 직접 열기) 환경을 위해 `index.html` 안에 동일 JSON이 인라인으로 박혀 있습니다. 두 곳을 같이 갱신해야 합니다 ([app.js:50](app.js:50) 폴백 로직 참고).

## 프로젝트 레이아웃

```
.
├── index.html          # 카탈로그 페이지 (인라인 skills-data 포함)
├── app.js              # 검색·필터·URL 라우팅
├── skills.json         # 데이터 단일 소스
├── asset/              # OG 이미지·아이콘
├── scripts/
│   ├── sync-stars.py   # GitHub 별·포크 수 동기화
│   └── sync-inline.py  # skills.json → index.html 인라인 블록
└── .claude/commands/
    ├── add-skill.md    # 카드 추가 커맨드
    └── find-skill.md   # 카드 추천 커맨드
```

## 로컬에서 보기

별도 빌드 단계가 없습니다.

```bash
# 가장 간단: file://로 직접 열기 (인라인 폴백 사용)
open index.html

# 또는 정적 서버
python3 -m http.server 8000
# → http://localhost:8000
```

URL에 `?cat=<category-id>` 파라미터를 넣으면 카테고리가 바로 적용됩니다. 특수값으로 `all`(전체), `pick`(에디터픽), `lab`(실험 카드)이 있어요.

## 별·포크 동기화

GitHub stars/forks는 주기적으로 다음 스크립트로 갱신합니다.

```bash
python3 scripts/sync-stars.py
```

`gh` CLI가 인증되어 있어야 하고, 변경분은 `skills.json`과 `index.html` 인라인 블록에 모두 반영됩니다.

## 카드를 제안하고 싶다면

1. README의 위 게이트(특히 2.7 비즈니스 리더 적합성)를 한 번 읽어 주세요.
2. Issue에 GitHub 주소와 추천 카테고리, 한 줄 추천 사유를 남기거나
3. 직접 PR을 보낼 거면 `/add-skill <github-url> <category-id>`로 만든 변경분을 그대로 올려주세요.

## 라이선스

스킬 카드의 메타데이터는 라이브러리 운영을 위한 큐레이션입니다. 각 스킬의 코드와 라이선스는 원 저장소를 따릅니다.
