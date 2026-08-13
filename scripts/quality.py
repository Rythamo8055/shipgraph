#!/usr/bin/env python3
"""ShipGraph quality gate - Agent D.

Runs the full adversarial test suite (tests/) file-by-file and prints a
per-suite pass/skip/fail summary table. Exits non-zero on any failure or
error.

Usage:
    .venv/bin/python scripts/quality.py                # summary table
    .venv/bin/python scripts/quality.py --audit        # also run scripts/audit_model.py

Exit codes:
    0  everything passed
    1  at least one test failed or errored
    2  internal error (pytest crashed, audit subprocess crashed)
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PYTHON = REPO_ROOT / ".venv" / "bin" / "python"
TESTS_DIR = REPO_ROOT / "tests"


def _run_pytest_file(path: Path, verbose: bool) -> subprocess.CompletedProcess:
    args = [str(PYTHON), "-m", "pytest", str(path), "-q", "--tb=line"]
    if verbose:
        args.insert(3, "-v")
    return subprocess.run(args, cwd=str(REPO_ROOT), capture_output=True, text=True)


def _parse_summary(proc) -> dict:
    """Extract passed/skipped/failed/errors from pytest's summary line."""
    tail = proc.stdout.strip().splitlines()[-8:]
    out = {"passed": 0, "skipped": 0, "failed": 0, "errors": 0}
    for line in tail:
        m = re.search(r"=+ (\d+) passed.*?=+", line)
        if not m:
            continue
        out["passed"] = int(m.group(1))
        out["skipped"] = int(re.search(r"(\d+) skipped", line).group(1)) \
            if re.search(r"(\d+) skipped", line) else 0
        out["failed"] = int(re.search(r"(\d+) failed", line).group(1)) \
            if re.search(r"(\d+) failed", line) else 0
        out["errors"] = int(re.search(r"(\d+) error", line).group(1)) \
            if re.search(r"(\d+) error", line) else 0
        break
    return out


def _run_audit() -> int:
    proc = subprocess.run([str(PYTHON), str(REPO_ROOT / "scripts" / "audit_model.py")],
                          cwd=str(REPO_ROOT), capture_output=True, text=True)
    print("== audit_model ==")
    print(proc.stdout.strip())
    if proc.stderr.strip():
        print(proc.stderr.strip())
    return proc.returncode


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--verbose", action="store_true", help="pytest -v output")
    ap.add_argument("--audit", action="store_true",
                    help="also run scripts/audit_model.py")
    args = ap.parse_args()

    suites = sorted(TESTS_DIR.glob("test_*.py"))
    assert suites, "no test suites found under %s" % TESTS_DIR

    rows = []
    failed_tests = []
    crashed = False
    for path in suites:
        proc = _run_pytest_file(path, args.verbose)
        if args.verbose:
            print(proc.stdout)
        row = _parse_summary(proc)
        rows.append((path.name, row))
        if proc.returncode not in (0, 1):
            crashed = True
            print("pytest crashed on %s:\n%s\n%s" % (
                path.name, proc.stdout[-3000:], proc.stderr[-3000:]))
            continue
        for line in proc.stdout.splitlines():
            if re.search(r"\bFAILED\b|\bERROR\b", line):
                failed_tests.append(line.strip())

    print("== ShipGraph quality gate ==")
    print("%-28s %6s %8s %7s %7s" % ("suite", "passed", "skipped", "failed",
                                     "errors"))
    t = {"passed": 0, "skipped": 0, "failed": 0, "errors": 0}
    for name, row in rows:
        for k in t:
            t[k] += row[k]
        print("%-28s %6d %8d %7d %7d" % (name, row["passed"], row["skipped"],
                                         row["failed"], row["errors"]))
    print("-" * 58)
    print("%-28s %6d %8d %7d %7d" % ("TOTAL", t["passed"], t["skipped"],
                                     t["failed"], t["errors"]))
    if failed_tests:
        print("failed tests:")
        for line in failed_tests:
            print("  %s" % line)

    rc = 1 if (t["failed"] or t["errors"] or crashed) else 0
    print("GATE: %s" % ("RED" if rc else "GREEN"))

    if args.audit:
        audit_rc = _run_audit()
        if audit_rc:
            print("audit_model: RED")
            rc = max(rc, 1)
    return rc


if __name__ == "__main__":
    sys.exit(main())