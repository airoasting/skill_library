#!/usr/bin/env python3
"""skills.json → index.html 의 <script id="skills-data"> 블록 자동 동기화.

단일 소스: skills.json
로컬(file://)에서도 데이터가 바로 보이도록 인라인 백업 제공.
커밋 직전 .githooks/pre-commit 이 호출.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
JSON = ROOT / "skills.json"


def main() -> int:
    if not HTML.exists() or not JSON.exists():
        print("sync-inline: index.html 또는 skills.json 을 찾을 수 없습니다.", file=sys.stderr)
        return 1

    html = HTML.read_text(encoding="utf-8")
    skills = JSON.read_text(encoding="utf-8").strip()

    new_block = (
        '<script type="application/json" id="skills-data">\n'
        f"{skills}\n"
        "</script>"
    )

    pattern = re.compile(
        r'<script[^>]*id="skills-data"[^>]*>.*?</script>',
        re.DOTALL,
    )

    if pattern.search(html):
        new_html = pattern.sub(lambda _m: new_block, html, count=1)
    else:
        # </body> 직전에 삽입
        new_html = re.sub(r'(\s*)</body>', r'\n' + new_block + r'\1</body>', html, count=1)

    if new_html == html:
        return 0

    HTML.write_text(new_html, encoding="utf-8")
    # 스테이징 (pre-commit 에서 호출될 때)
    try:
        subprocess.run(["git", "add", str(HTML)], cwd=ROOT, check=False)
    except Exception:
        pass
    print("sync-inline: index.html 인라인 skills-data 동기화 완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
