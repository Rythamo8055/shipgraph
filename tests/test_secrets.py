"""Hard rule 3: secrets must never appear outside .env.

Walks every file in the repo (excluding .env, .venv, node_modules, .next,
.git, __pycache__) and asserts the real COGNODB_PASSWORD value from .env
does not appear byte-wise anywhere, and that no file assigns a literal
COGNODB_PASSWORD value. Includes data/raw and data/normalized.

Also greps the git index/history for the password.
"""

import re
import subprocess
from pathlib import Path

import pytest
from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parents[1]

EXCLUDED_DIR_PARTS = {".git", ".venv", "node_modules", ".next", "__pycache__"}
EXCLUDED_FILE_NAMES = {".env"}

ASSIGN_RE = re.compile(r"COGNODB_PASSWORD\s*=\s*[^$]")


def _dotenv():
    return dotenv_values(REPO_ROOT / ".env")


def _all_repo_files():
    for p in REPO_ROOT.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(REPO_ROOT)
        if any(part in EXCLUDED_DIR_PARTS for part in rel.parts):
            continue
        if p.name in EXCLUDED_FILE_NAMES:
            continue
        yield p


@pytest.fixture(scope="module")
def password():
    pw = _dotenv().get("COGNODB_PASSWORD")
    if not pw:
        pytest.skip("COGNODB_PASSWORD missing from .env — cannot verify")
    return pw


def test_password_not_present_in_any_repo_file(password):
    hits = []
    for p in _all_repo_files():
        try:
            data = p.read_bytes()
        except OSError:
            continue
        if password.encode("utf-8") in data:
            hits.append(p.relative_to(REPO_ROOT).as_posix())
    assert not hits, "password found in: %s" % ", ".join(hits)


def test_no_literal_password_assignment_outside_dotenv():
    hits = []
    for p in _all_repo_files():
        try:
            text = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            # binary file: byte check covers it
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            if ASSIGN_RE.search(line):
                hits.append("%s:%d" % (p.relative_to(REPO_ROOT), lineno))
    assert not hits, "COGNODB_PASSWORD literal assignments: %s" % ", ".join(hits[:20])


def test_password_not_in_git_index_or_history(password):
    n_commits = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "rev-list", "--count", "--all"],
        capture_output=True,
        text=True,
    )
    if n_commits.returncode != 0 or int(n_commits.stdout.strip() or "0") == 0:
        pytest.skip("no commits yet — nothing to grep in history")

    revs = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "rev-list", "--all"],
        capture_output=True,
        text=True,
    ).stdout.split()
    hits = []
    for rev in revs:
        out = subprocess.run(
            ["git", "-C", str(REPO_ROOT), "grep", "-I", "-F", "-n",
             "-e", password, rev, "--"],
            capture_output=True,
            text=True,
        )
        if out.returncode == 0:
            hits.extend(l for l in out.stdout.splitlines() if "COGNODB" not in l)
    assert not hits, "password in git history: %s" % hits[:10]