"""Shared fixtures for the ShipGraph test suite.

Adds the repo root to sys.path so tests can import scripts/acquire/schema.py
(the single source of truth for label/relationship constants).
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

if REPO_ROOT.as_posix() not in sys.path:
    sys.path.insert(0, REPO_ROOT.as_posix())