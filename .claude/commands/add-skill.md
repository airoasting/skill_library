---
description: GitHub 주소와 카테고리를 받아 skills.json에 새 카드 추가
argument-hint: <github-url> [category-id] [--fb <url>] [--li <url>] [--x <url>]
allowed-tools: Bash(gh:*), Bash(date:*), Bash(python3:*), WebFetch, Read, Edit, Grep
---

사용자가 제공한 인자: `$ARGUMENTS`

## 0. 인자 파싱 & 정규화

- 첫 토큰 = GitHub 주소, 두 번째 토큰 = 카테고리 id.
- **주소 정규화**: 다음 변형을 모두 `owner/repo` 형태로 환원.
  - `https://github.com/o/r`, `http://…`, 끝의 `/`, `.git`, `/tree/<branch>/...`, `/blob/...`, `/pull/...` 등 경로 꼬리는 버려.
  - 이미 `o/r` 형태면 그대로 사용.
- **카테고리 id 목록은 런타임에 읽어**: `skills.json`의 `categories[].id`를 그대로 신뢰 (여기 하드코딩하지 말 것).
- **누락 처리**:
  - 주소가 없거나 파싱 실패 → 중단하고 사용자에게 주소 재요청.
  - 카테고리가 비어 있으면 1·2단계를 먼저 돌려 후보를 **제안**만 하고, 사용자 확인 후 3단계로 진행.
- **저자 소셜 옵션 파싱**: 인자 중 `--fb <url>`, `--li <url>`, `--x <url>` 또는 자연어로 "페북: …, 링크드인: …, X: …" 형태가 있으면 값을 추출해 기억. 일부만 있어도 OK (없는 건 그냥 비움).

## 0.5. 중복 검사 (최우선 게이트)

네트워크를 타기 전에 먼저 로컬에서 확인해 시간을 아껴.

- `skills.json`의 `skills[]`를 읽어 `repo` 필드를 모두 대조.
- 대소문자 무시(`lower()`)로 `<owner>/<repo>` 정확 일치 여부 확인.
- **일치하는 항목이 하나라도 있으면** 즉시 중단하고 아래 형식으로 알린 뒤 종료:

  ```
  ⚠️ 이미 등록된 저장소입니다.
  - repo: <owner>/<repo>
  - 기존 카드: [<category>] <name> (added_at: <date>)
  추가하지 않고 종료합니다.
  ```

- 중복이 없을 때만 1단계로 진행.

## 1. 저장소 분석

- 1차: `gh repo view <owner>/<repo> --json name,description,stargazerCount,owner,primaryLanguage,repositoryTopics,url`.
- 2차(README): `gh api repos/<owner>/<repo>/readme -H "Accept: application/vnd.github.raw"`.
- `gh` 실패(미설치·미인증·rate limit·private·404) 시 **폴백**:
  - WebFetch로 `https://github.com/<owner>/<repo>` 페이지에서 description·stars·primary language·topics 추출.
  - README는 WebFetch로 `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md` (없으면 `master` 브랜치) 시도.
  - 둘 다 실패하면 무엇이 막혔는지 사용자에게 알리고 중단.
- **2차 중복 검사(이름 충돌)**: 0.5의 `repo` 대조를 통과했어도, `name` 필드(repo 메타에서 생성한 Title Case)가 기존 카드와 동일하면 중단하고 어떤 카드와 겹치는지 알려.

## 2. 카테고리 검증

- 근거: README 본문, repo description, topics, primaryLanguage, `skills.json`의 `categories[].desc`(각 카테고리 정의).
- 카테고리 정의와 저장소 성격을 매칭해 최적 id를 판단.
- 사용자가 준 id와 **일치** → 3단계로.
- **불일치** → 중단하고 "원래 제안: `X` / 더 적합해 보임: `Y` — 이유 2~3줄" 형식으로 역제안. 사용자가 `X` 강행 vs `Y` 수용을 선택한 뒤에만 3단계 진행.

## 2.5. 저자 소셜 처리 (authors 맵)

저자의 페북·링크드인·X 주소는 **카드가 아니라 `skills.json`의 최상위 `authors` 맵**에 저자 id 단위로 저장돼. 같은 저자의 다른 카드에도 자동으로 버튼이 붙어.

```json
"authors": {
  "hollobit": {
    "facebook": "https://…",
    "linkedin": "https://…",
    "x": "https://…"
  }
}
```

처리 순서:

1. `owner`(= author id)가 이미 `authors`에 있는지 확인.
2. **있음** → 아무 것도 하지 않고 3단계로 (기존 기억 그대로 사용).
   - 단, 사용자가 이번에 준 `--fb/--li/--x`(또는 자연어)가 있고 기존 값과 **다르면** 사용자에게 "덮어쓸까?" 확인한 뒤 반영.
3. **없음**:
   - 사용자가 이번에 소셜 인자를 제공했다면 → 그 값들로 `authors[owner]` 신규 엔트리 생성.
   - 전혀 안 줬으면 → 그냥 넘어가 (소셜 버튼 없이 카드만 생성). 강제로 묻지는 마.
4. Edit로 `authors` 블록에 삽입할 때는 JSON 문법을 깨뜨리지 않도록, 기존 블록의 마지막 엔트리 + 닫는 `}`를 `old_string`으로 잡고 `,` + 새 엔트리를 끼우는 패턴을 사용. `authors` 블록 자체가 없는 드문 경우엔 파일 최상단 `{` 바로 뒤에 `"authors": { ... },` 형태로 삽입.

URL 정규화(선택):
- 입력이 `@hollobit`이나 `hollobit`처럼 id만 온 경우 → X는 `https://x.com/<id>`, 링크드인은 `https://www.linkedin.com/in/<id>/`, 페북은 `https://www.facebook.com/<id>`로 조립 가능. 단 사용자가 full URL을 줬으면 그대로 사용.

## 2.7. 비즈니스 리더 적합성 판단 (게이트)

이 라이브러리의 타깃 사용자는 **비개발자 비즈니스 리더**다. 카드를 추가하기 전에 해당 스킬이 그들에게 실제로 쓸모가 있는지 판단해.

### 판단 기준

**적합 신호** (한 개 이상이면 적합 쪽으로 기운다):
- HR·영업·법무·마케팅·재무·전략·기획 등 **비개발 도메인**에 직접 쓸 수 있다.
- 문서·회의록·리서치·커뮤니케이션·의사결정 보조처럼 **범용 지식 작업**을 돕는다.
- 설치·설정이 README 기준 몇 단계 이내이고, **YAML/코드 작성 없이** 쓸 수 있다.
- 이미 만들어진 프리셋·템플릿을 "골라서 쓰는" 구조다.

**부적합 신호** (한 개라도 강하게 걸리면 부적합 쪽으로 기운다):
- README의 핵심 키워드가 **PR 생성·CI/CD·테스트·배포·모니터링·코드 리뷰·git hook·병합** 등 개발 워크플로우에 한정된다.
- **코딩 에이전트 관리**(칸반, 작업 할당, 서브에이전트 오케스트레이션)가 주 용도다.
- 사용하려면 **YAML/JSON 워크플로우 작성**, **MCP 서버 직접 구성**, **조건분기·재시도** 같은 엔지니어 멘탈모델이 필요하다.
- "풀스택", "파이프라인", "런타임", "멀티 LLM 오케스트레이션" 같은 표현이 중심 가치다.
- 금융·의료·보안처럼 **도메인 전문성을 전제**하는데, 그 도메인 타깃이 비즈니스 리더가 아닌 실무자(개발자·분석가)다.

### 절차

1. 위 기준으로 **적합 / 부적합 / 애매** 중 하나로 판정.
2. **적합** → 바로 3단계로.
3. **부적합 또는 애매** → **중단하고** 사용자에게 다음 형식으로 의견을 물어:

   ```
   ⚠️ 비즈니스 리더에게 적합하지 않아 보입니다.

   대상 저장소: <owner>/<repo>
   카테고리 후보: <category>

   판정: 부적합 (또는 애매)

   이유:
   - <구체적 근거 1: README에서 인용하거나 기능을 직접 가리키며>
   - <구체적 근거 2>
   - <구체적 근거 3: 비즈니스 리더가 쓰려 할 때 어디서 막힐지>

   비슷한 카드와의 비교(선택):
   - 기존 <카드 A>는 ~한 점에서 리더에게 통했는데, 이 저장소는 그게 빠져 있음.

   그래도 추가할까요?
   1) 추가 (이유: ___)
   2) 보류
   3) 다른 카테고리로 재분류해서 추가
   ```

4. 사용자가 **1) 추가** 또는 **3) 재분류 추가**를 고른 경우에만 3단계로. **2) 보류**면 종료.
5. 사용자가 "무조건 추가"·"내가 알아서 판단함" 같은 durable 지시를 이전에 준 적이 있다면 이 게이트를 건너뛰어도 된다. 단 지시 범위가 불분명하면 한 번은 물어라.

### 판단 시 주의

- 별 수(stars)가 높다고 자동 통과시키지 마라. Archon(19k), Multica(17k)처럼 스타는 많아도 개발자 전용인 경우가 실제로 있다.
- README의 "누구를 위한 것인가(For whom)" 섹션이 있으면 그 문구를 1순위 근거로 인용해라.
- 근거를 추상적으로 쓰지 마라("개발자용 같음" ❌). **어떤 기능·어떤 용어 때문에** 비개발자가 막힐지 구체적으로 적어라.

## 3. 카드 작성

기존 카드 포맷을 **그대로** 따라. `skills.json`의 `skills` 배열 마지막 객체로 추가. 필드 순서 고정:

```json
{
  "category": "<검증된 카테고리 id>",
  "name": "<repo name을 사람이 읽기 좋게 Title Case로>",
  "repo": "<owner>/<repo>",
  "author": "<owner>",
  "stars": <stargazerCount 숫자>,
  "added_at": "<오늘 날짜 YYYY-MM-DD, `date +%Y-%m-%d`로 획득>",
  "desc": "<한국어 2문장>",
  "tags": ["#tag1", "#tag2", "#tag3"]
}
```

### 필드 규칙
- `desc`: 한국어 **정확히 2문장**, 합쳐서 **100~160자**(공백 포함). 담백한 설명체·"~합니다" 종결. 과장·이모지·느낌표 금지.
  - 1문장: "이 스킬은/플러그인은/컬렉션은 … 입니다." (무엇인지)
  - 2문장: "… 때문에 …에 적합합니다/잘 어울립니다/좋습니다." (누구에게·왜)
- `tags`: 소문자 kebab-case, `#` 접두, **2~4개**. README 핵심 키워드에서.
- `lang`, `editors_pick`: 사용자가 명시 요청한 경우에만 추가. 기본은 **넣지 말 것**.

### Edit 적용 방식 (JSON 깨뜨리지 않기)

`Edit` 도구의 `old_string` 유일성 제약 때문에 "마지막 `}` 하나"만 잡으면 거의 실패한다. 대신 **직전 마지막 객체 전체 + 배열 종료 괄호**를 `old_string`으로 잡고, 그 뒤에 `,` + 새 객체를 끼운 결과를 `new_string`으로 둬.

예시 패턴:

```
old_string:
    {
      "category": "...",
      "name": "...마지막 기존 카드...",
      ...
      "tags": ["#a", "#b"]
    }
  ]
}

new_string:
    {
      "category": "...",
      "name": "...마지막 기존 카드...",
      ...
      "tags": ["#a", "#b"]
    },
    {
      "category": "<new>",
      ...
      "tags": ["#x", "#y"]
    }
  ]
}
```

삽입 후 반드시 다시 Read로 열어 JSON 문법(쉼표·괄호·따옴표) 확인.

## 3.5. index.html 인라인 블록 동기화 (필수)

`index.html` 내부 `<script type="application/json" id="skills-data">…</script>` 블록에도 **`skills.json`과 동일한 JSON이 인라인으로 임베드**돼 있다. `file://`로 직접 열리는 경우 페이지는 `skills.json` fetch 실패 후 이 인라인 블록을 폴백으로 읽기 때문에([app.js:50-60](app.js:50)), 두 곳을 같이 업데이트하지 않으면 로컬 `index.html` 프리뷰에 변경이 반영되지 않는다.

절차:

1. `index.html`에서 `id="skills-data"` 블록 범위를 확인 (열기 태그와 닫기 `</script>` 위치).
2. 3단계에서 `skills.json`에 삽입한 것과 **완전히 동일한 카드 객체**를 이 블록 안의 `skills` 배열 끝에도 append.
3. `skills.json`에서 썼던 Edit 패턴(직전 마지막 객체 + 배열 종료 괄호를 `old_string`으로 잡기)을 그대로 적용.
4. 2.5의 `authors` 맵 변경이 있었다면 인라인 블록 최상위 `authors`에도 동일 변경을 반영.

검증 (둘 다 통과해야 4단계로):

```bash
# skills.json 유효성
python3 -c "import json; json.load(open('skills.json'))"

# 인라인 블록 유효성 (script 태그 내부만 추출해 파싱)
python3 - <<'PY'
import re, json, pathlib
html = pathlib.Path('index.html').read_text()
m = re.search(r'<script type="application/json" id="skills-data">(.*?)</script>', html, re.DOTALL)
assert m, 'inline block not found'
json.loads(m.group(1))
print('inline OK')
PY
```

추가로 `skills.json`과 인라인 블록의 `skills` 배열 길이가 같은지도 간단히 대조:

```bash
python3 - <<'PY'
import re, json, pathlib
j = json.load(open('skills.json'))
html = pathlib.Path('index.html').read_text()
inline = json.loads(re.search(r'id="skills-data">(.*?)</script>', html, re.DOTALL).group(1))
assert len(j['skills']) == len(inline['skills']), f"mismatch: json={len(j['skills'])} inline={len(inline['skills'])}"
print('count OK:', len(j['skills']))
PY
```

불일치가 나면 어디서 누락됐는지 찾아 고친 뒤 다시 검증하고 4단계로.

## 4. 보고

- 총 개수 변화를 알려줘: `N → N+1` (카테고리별/전체 집계는 [app.js:75-94](app.js:75)에서 자동 수행되므로 수동 수정 불필요).
- 추가된 카드를 한 줄로 요약: `[<category>] <name> — <owner>/<repo> · ★<stars>`.
- `skills.json`과 `index.html` 인라인 블록 **둘 다** 업데이트됐음을 명시.
