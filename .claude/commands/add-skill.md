---
description: GitHub 주소와 카테고리를 받아 skills.json에 새 카드 추가
argument-hint: <github-url> [category-id]
allowed-tools: Bash(gh:*), Bash(date:*), WebFetch, Read, Edit
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

## 1. 저장소 분석

- 1차: `gh repo view <owner>/<repo> --json name,description,stargazerCount,owner,primaryLanguage,repositoryTopics,url`.
- 2차(README): `gh api repos/<owner>/<repo>/readme -H "Accept: application/vnd.github.raw"`.
- `gh` 실패(미설치·미인증·rate limit·private·404) 시 **폴백**:
  - WebFetch로 `https://github.com/<owner>/<repo>` 페이지에서 description·stars·primary language·topics 추출.
  - README는 WebFetch로 `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md` (없으면 `master` 브랜치) 시도.
  - 둘 다 실패하면 무엇이 막혔는지 사용자에게 알리고 중단.
- **중복 검사**: `skills.json`의 기존 항목에 대해 `repo` **그리고** `name` 둘 다 대조. 하나라도 충돌하면 중단하고 어떤 카드와 겹치는지 알려.

## 2. 카테고리 검증

- 근거: README 본문, repo description, topics, primaryLanguage, `skills.json`의 `categories[].desc`(각 카테고리 정의).
- 카테고리 정의와 저장소 성격을 매칭해 최적 id를 판단.
- 사용자가 준 id와 **일치** → 3단계로.
- **불일치** → 중단하고 "원래 제안: `X` / 더 적합해 보임: `Y` — 이유 2~3줄" 형식으로 역제안. 사용자가 `X` 강행 vs `Y` 수용을 선택한 뒤에만 3단계 진행.

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

## 4. 보고

- 총 개수 변화를 알려줘: `N → N+1` (카테고리별/전체 집계는 [app.js:75-94](app.js:75)에서 자동 수행되므로 수동 수정 불필요).
- 추가된 카드를 한 줄로 요약: `[<category>] <name> — <owner>/<repo> · ★<stars>`.
