#!/usr/bin/env python3
"""GitHub repo의 stars/forks 수를 가져와 skills.json 을 갱신하고
sync-inline.py 로 index.html 까지 동기화한다.

인증 우선순위:
  1) gh CLI 로그인 (gh auth status) → 5,000 req/hr
  2) 환경변수 GITHUB_TOKEN / GH_TOKEN  → 5,000 req/hr
  3) 무인증 공개 API                    → 60 req/hr (스킬 141개라 제한 가능)
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "docs" / "skills.json"
INDEX_PATH = ROOT / "docs" / "index.html"
SYNC_INLINE = ROOT / "scripts" / "sync-inline.py"

GREEN = "\033[32m"
RED = "\033[31m"
YEL = "\033[33m"
DIM = "\033[2m"
BOLD = "\033[1m"
END = "\033[0m"


def has_gh_auth() -> bool:
    if not shutil.which("gh"):
        return False
    r = subprocess.run(["gh", "auth", "status"], capture_output=True)
    return r.returncode == 0


def fetch_via_gh(repo: str) -> dict | None:
    r = subprocess.run(
        [
            "gh", "api", f"repos/{repo}",
            "--jq", "{stars: .stargazers_count, forks: .forks_count}",
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return None


def fetch_via_http(repo: str, token: str | None) -> dict | None:
    url = f"https://api.github.com/repos/{repo}"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "skill-library-sync",
        },
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        return {
            "stars": data.get("stargazers_count"),
            "forks": data.get("forks_count"),
        }
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            raise RuntimeError("rate-limited") from e
        return None
    except Exception:
        return None


def get_rate_limit(token: str | None) -> tuple[int, int, int] | None:
    """(remaining, limit, reset_epoch) 또는 None."""
    req = urllib.request.Request(
        "https://api.github.com/rate_limit",
        headers={"Accept": "application/vnd.github+json", "User-Agent": "skill-library-sync"},
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            d = json.loads(resp.read())["rate"]
        return d["remaining"], d["limit"], d["reset"]
    except Exception:
        return None


def git_commit_push(updated: int) -> int:
    """skills.json + index.html 만 커밋하고 origin 현재 브랜치로 push.
    git 이 없거나 원격 push 가 실패해도 sync 자체는 성공으로 본다."""
    if not shutil.which("git"):
        print(f"{YEL}⚠ git 이 없어 커밋·푸시를 건너뜁니다.{END}")
        return 0

    def run(args: list[str]) -> subprocess.CompletedProcess:
        return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True)

    # 두 데이터 파일만 스테이징 (다른 변경은 건드리지 않음)
    run(["add", str(JSON_PATH), str(INDEX_PATH)])

    # 스테이징된 변경이 없으면 조용히 종료
    if run(["diff", "--cached", "--quiet"]).returncode == 0:
        print(f"{DIM}커밋할 변경 없음 — push 생략.{END}")
        return 0

    msg = f"star/fork 동기화: {updated}개 카드 갱신"
    c = run(["commit", "-m", msg])
    if c.returncode != 0:
        print(f"{RED}✗ git commit 실패{END}\n{c.stderr.strip()}")
        return 1
    print(f"{GREEN}✓{END} 커밋 완료: {msg}")

    branch = run(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip() or "main"
    p = run(["push", "origin", branch])
    if p.returncode != 0:
        print(f"{RED}✗ git push 실패{END} (커밋은 로컬에 남아 있습니다)\n{p.stderr.strip()}")
        return 1
    print(f"{GREEN}✓{END} origin/{branch} 에 push 완료")
    return 0


def main() -> int:
    if not JSON_PATH.exists():
        print(f"{RED}skills.json 을 찾을 수 없습니다: {JSON_PATH}{END}", file=sys.stderr)
        return 1

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    skills = data.get("skills", [])
    targets = [(i, s["repo"]) for i, s in enumerate(skills) if s.get("repo")]

    if not targets:
        print("repo 가 등록된 스킬이 없습니다.")
        return 0

    use_gh = has_gh_auth()
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")

    if use_gh:
        mode = f"{GREEN}gh CLI{END} (5,000 req/hr)"
        workers = 8
        fetch = lambda repo: fetch_via_gh(repo)
    elif token:
        mode = f"{GREEN}GITHUB_TOKEN{END} (5,000 req/hr)"
        workers = 8
        fetch = lambda repo: fetch_via_http(repo, token)
    else:
        mode = f"{YEL}unauth{END} (60 req/hr — 부족하면 `gh auth login` 권장)"
        workers = 3
        fetch = lambda repo: fetch_via_http(repo, None)

    started = time.time()
    print(f"{BOLD}AI ROASTING · Skill Library{END}  star/fork 동기화")
    print(f"  · 인증     : {mode}")
    print(f"  · 대상     : {len(targets)}개 repo")
    print(f"  · 워커     : {workers}")

    # 사전 rate-limit 체크 (gh CLI 모드는 자체 처리하므로 스킵)
    if not use_gh:
        rl = get_rate_limit(token)
        if rl is not None:
            remaining, limit, reset_epoch = rl
            reset_in = max(0, int(reset_epoch - time.time()) // 60)
            color = GREEN if remaining >= len(targets) else (YEL if remaining > 0 else RED)
            print(f"  · API 한도 : {color}{remaining}/{limit}{END} 남음 (리셋까지 약 {reset_in}분)")
            if remaining == 0:
                print()
                print(f"{RED}✗ rate limit 소진 — 약 {reset_in}분 뒤 다시 실행하거나 `gh auth login` 후 재시도하세요.{END}")
                return 0  # exit 0 so launcher closes silently
            if remaining < len(targets):
                short = len(targets) - remaining
                print(f"  · {YEL}참고: {short}개는 이번에 갱신되지 않고 다음 차수까지 묵혀집니다.{END}")
    print()

    updated = 0
    unchanged = 0
    failed: list[str] = []
    rate_limited = False

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(fetch, repo): (i, repo) for i, repo in targets}
        for fut in as_completed(futures):
            i, repo = futures[fut]
            try:
                result = fut.result()
            except RuntimeError as exc:
                if str(exc) == "rate-limited":
                    rate_limited = True
                    failed.append(repo)
                    continue
                failed.append(repo)
                continue

            if not result or result.get("stars") is None:
                failed.append(repo)
                print(f"  {RED}✗{END} {repo}  {DIM}(불러오기 실패){END}")
                continue

            old_stars = skills[i].get("stars")
            old_forks = skills[i].get("forks")
            new_stars = result["stars"]
            new_forks = result["forks"]

            if old_stars == new_stars and old_forks == new_forks:
                unchanged += 1
                print(f"  {DIM}·{END} {repo}  ★{new_stars:,} ⑂{new_forks:,}  {DIM}변동 없음{END}")
            else:
                ds = (new_stars or 0) - (old_stars or 0)
                df = (new_forks or 0) - (old_forks or 0)
                ds_s = f"{GREEN}+{ds}{END}" if ds > 0 else (f"{RED}{ds}{END}" if ds < 0 else "0")
                df_s = f"{GREEN}+{df}{END}" if df > 0 else (f"{RED}{df}{END}" if df < 0 else "0")
                skills[i]["stars"] = new_stars
                skills[i]["forks"] = new_forks
                updated += 1
                print(f"  {GREEN}✓{END} {repo}  ★{new_stars:,} ({ds_s}) ⑂{new_forks:,} ({df_s})")

    elapsed = time.time() - started
    print()
    print(f"{BOLD}완료{END}: 갱신 {GREEN}{updated}{END} / 변동없음 {unchanged} / 실패 {RED}{len(failed)}{END}  ({elapsed:.1f}s)")

    if rate_limited:
        print(f"{YEL}⚠ GitHub API rate limit 도달. `gh auth login` 후 다시 실행하세요.{END}")

    if updated == 0:
        print("변경사항 없음 — skills.json 저장 생략.")
        # rate-limit 으로 실패한 경우는 정상 흐름이므로 0 으로 종료 (런처가 조용히 닫히도록)
        return 0

    JSON_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"{GREEN}✓{END} skills.json 저장")

    r = subprocess.run([sys.executable, str(SYNC_INLINE)])
    if r.returncode == 0:
        print(f"{GREEN}✓{END} index.html 인라인 데이터 동기화 완료")
    else:
        print(f"{RED}✗ index.html 동기화 실패 — 커밋·푸시를 건너뜁니다.{END}")
        return r.returncode

    print()
    return git_commit_push(updated)


if __name__ == "__main__":
    sys.exit(main())
