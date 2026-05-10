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

## 카드 둘러보기

가장 빠른 방법은 라이브 사이트입니다. 카테고리 칩 → 카드 → 원 저장소로 바로 이동할 수 있어요.

🌐 <https://airoasting.github.io/skill_library/>

URL 파라미터로 바로 들어갈 수도 있습니다.

| URL | 결과 |
|---|---|
| `?cat=workflow` | "AI와 일 잘하는 법" 카테고리만 |
| `?cat=korea` | "한국 특화 스킬·MCP"만 |
| `?cat=pick` | 에디터픽 26개만 |
| `?cat=lab` | AI Roasting Lab 실험 카드만 |

## `/find-skill` — 자연어로 스킬 찾기

라이브러리를 Claude Code에서 클론해 열면 자동으로 잡히는 슬래시 커맨드입니다. 카테고리를 일일이 훑지 않아도, 지금 하고 싶은 일을 한 줄로 던지면 카탈로그 안에서 가장 잘 맞는 카드 N개를 골라줍니다.

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

**무엇을 보고 고르나.** 자연어 질의에서 작업 의도와 제약(한국어, 비개발자, 도메인 등)을 분리한 뒤, 각 카드의 의도 적합도·카테고리 정의·제약 충족·신뢰 보정을 합산해 상위 N개를 뽑습니다. 결과가 한 카테고리에 몰리면 같은 카테고리 최대 2개로 제한해 다양성을 확보합니다.

**무엇을 안 하나.** 이 커맨드는 **라이브러리 안의 카드만** 봅니다. 외부 도구나 신규 후보를 절대 추천하지 않아요. 라이브러리에 없는 분야면 "여긴 없어요"라고 솔직히 답합니다. 점수·내부 룰은 출력에 노출하지 않고 결과만 한국어 카드 형식으로 보여줍니다.

자세한 동작 규칙: [.claude/commands/find-skill.md](.claude/commands/find-skill.md)

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

## 카드를 제안하고 싶다면

추천 후보가 있으면 [Issue](https://github.com/airoasting/skill_library/issues/new)를 열어 GitHub 주소·카테고리 후보·한 줄 추천 사유를 남겨주세요. 큐레이터가 직접 검토 후 라이브러리에 반영합니다.

<details>
<summary>운영자용 메모</summary>

카드 추가는 큐레이터가 `/add-skill` 슬래시 커맨드로 진행합니다. 중복 검사·카테고리 검증·비즈니스 리더 적합성·에디터픽 평가·인라인 블록 동기화까지 게이트로 묶여 있어 큐레이션 일관성을 유지하기 위한 도구입니다. 절차·게이트 정의는 [.claude/commands/add-skill.md](.claude/commands/add-skill.md) 참고. 별·포크 수 갱신은 `python3 scripts/sync-stars.py`로 동기화합니다.

</details>

## 라이선스

스킬 카드의 메타데이터는 라이브러리 운영을 위한 큐레이션입니다. 각 스킬의 코드와 라이선스는 원 저장소를 따릅니다.
