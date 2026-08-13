#!/bin/bash
# ShipGraph full pipeline: fetch -> normalize -> load -> summary. Detached runner.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
export GITHUB_TOKEN="${GITHUB_TOKEN:?set GITHUB_TOKEN}"
export PYTHONUNBUFFERED=1
LOG=data/raw/crawl.log

{
  echo "=== pipeline start $(date) ==="
  .venv/bin/python scripts/acquire/fetch.py --github --pr-commits 2>&1 || { echo "FETCH FAILED"; exit 1; }
  .venv/bin/python scripts/acquire/fetch.py --statuspages 2>&1 || echo "statuspages issues (non-fatal)"
  .venv/bin/python scripts/acquire/normalize.py 2>&1 || { echo "NORMALIZE FAILED"; exit 1; }
  .venv/bin/python scripts/load.py 2>&1 || { echo "LOAD FAILED"; exit 1; }
  echo "=== pipeline DONE $(date) ==="
} > "$LOG" 2>&1