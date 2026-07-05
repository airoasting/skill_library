# CLAUDE.md — 스킬 라이브러리

이 폴더에서 AI가 카드를 다룰 때 따라야 하는 규칙이다. 상위 폴더의 전역 `CLAUDE.md`와 함께 읽되, 이 프로젝트 고유 규칙은 이 파일을 우선한다.

## 150개 룰

카드 총량은 **150개로 고정**한다.

- 새 카드를 추가하면 반드시 기존 카드 하나를 제거해 총량을 150으로 되돌린다. 추가만 하고 끝내지 않는다.
- 총량을 늘리거나 줄이는 변경은 사용자가 명시적으로 요청할 때만 한다. 기본값은 150 유지.

### 제거 기준

1. **자체 카드는 보호한다.** `airoasting/*` 저장소(내가 만든 스킬)는 별점이 낮아도 제거 후보에서 뺀다.
2. 남은 서드파티 카드 중 **별점(stars) 최하위부터** 제거한다. 별점이 같으면 fork 수가 낮은 쪽을 뺀다.
3. 어떤 카드를 지울지 애매하면 상위 후보 2개를 제시하고 사용자에게 확인받는다.

## 파일 동기화 규칙

웹 번들은 `docs/` 폴더에 있다(GitHub Pages `/docs` 서빙). 카드 데이터는 두 곳에 이중으로 존재한다. 한쪽만 고치면 `file://` 프리뷰가 어긋난다.

- `docs/skills.json` — 정본.
- `docs/index.html`의 `<script type="application/json" id="skills-data">` 인라인 블록 — `file://` 폴백용. `docs/skills.json`과 항상 동일하게 유지한다.

카드를 추가·제거·수정할 때 **두 곳을 함께** 바꾼다.

## 검증

변경 후 아래를 통과해야 마무리한다.

```bash
python3 - <<'PY'
import re, json, pathlib
j = json.load(open('docs/skills.json'))
html = pathlib.Path('docs/index.html').read_text()
inline = json.loads(re.search(r'id="skills-data">(.*?)</script>', html, re.DOTALL).group(1))
assert len(j['skills']) == len(inline['skills']), f"mismatch: json={len(j['skills'])} inline={len(inline['skills'])}"
assert len(j['skills']) == 150, f"total must be 150, got {len(j['skills'])}"
print("OK:", len(j['skills']))
PY
```

- `skills.json` JSON 유효성, 인라인 블록 유효성, 두 배열 길이 일치, 총량 150을 모두 확인한다.

## 관련 스킬

- `add-skill` — GitHub 주소를 받아 카드를 추가한다. 중복 검사, 카테고리 검증, 비즈니스 리더 적합성 게이트, 에디터픽 3축 평가, 두 파일 동기화까지 이 스킬이 처리한다.
- 카드를 추가할 때는 이 스킬을 먼저 쓰고, 추가 후 위 150개 룰에 따라 하나를 제거한다.
