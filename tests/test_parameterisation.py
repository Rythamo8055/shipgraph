"""Hard rule 1: NO string-concatenated Cypher anywhere in app code.

Scans all *.py under scripts/ and tests/, plus any *.py at the repo root,
and all *.ts/*.tsx under lib/ and app/ (api routes + page files).

Python (AST-based):
  - any f-string (JoinedStr) whose static fragment contains a
    MATCH / MERGE / RETURN keyword => violation, UNLESS every interpolated
    expression is a reference to a constant from scripts/acquire/schema.py
    (label / rel-type constants - permitted by CONTRACT hard rule 1)
  - any `%`-formatting of a string literal containing those keywords,
    unless every placeholder is satisfied by schema constants
    (named placeholders `%(CONST)s`, or positional args that are direct
    references to schema constants / static string literals)

TypeScript (regex scan):
  - any template literal that contains a Cypher keyword AND a ${...}
    interpolation => violation, UNLESS every interpolation refers to an
    exported constant in lib/schema.ts (e.g. `${RELS.DEPLOYED}`,
    `${PATH_WHITELIST.join('|')}`).

Violations are reported as file:line so they can be triaged per agent.
"""

import ast
import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]

CYPHER_KW = re.compile(r"\b(MATCH|MERGE|RETURN)\b")
TS_TEXT = re.compile(r"\b(MATCH|MERGE|RETURN)\b")
TEMPLATE_SCANNER = re.compile(r"`((?:[^`\\]|\\.)*)`")
TS_INTERP = re.compile(r"\$\{([^}]*)\}")

# %-format conversion: named (CONV_RE handles %(name)s) or positional.
CONV_RE = re.compile(r"%(?:\(([A-Za-z_][A-Za-z0-9_]*)\))?"
                     r"[#0\-+ ]*\d*(?:\.\d+)?[hlL]?[diouxXeEfFgGcrsa]")

PY_SCAN_ROOTS = [REPO_ROOT / "scripts", REPO_ROOT / "tests"]
TS_SCAN_ROOTS = [REPO_ROOT / "lib", REPO_ROOT / "app"]

EXCLUDED_DIR_PARTS = {".venv", "node_modules", ".next", ".git", "__pycache__",
                      ".pytest_cache"}


def _py_schema_constants():
    """Names of every module-level `X = "literal"` in scripts/acquire/schema.py."""
    p = REPO_ROOT / "scripts" / "acquire" / "schema.py"
    constants = set()
    if not p.exists():
        return constants
    tree = ast.parse(p.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            t = node.targets[0]
            if isinstance(t, ast.Name) and isinstance(node.value, ast.Constant) \
                    and isinstance(node.value.value, str):
                constants.add(t.id)
    return constants


def _ts_schema_constants():
    """Names of every exported const in lib/schema.ts (values are strings)."""
    p = REPO_ROOT / "lib" / "schema.ts"
    constants = set()
    if not p.exists():
        return constants
    text = p.read_text(encoding="utf-8", errors="replace")
    for m in re.finditer(r"(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\b[^=]*=", text):
        constants.add(m.group(1))
        constants.add(m.group(1).lower())
    return constants


PY_CONSTANTS = _py_schema_constants()
TS_CONSTANTS = _ts_schema_constants()


def _py_files():
    seen = set()
    for root in PY_SCAN_ROOTS:
        if not root.exists():
            continue
        for p in root.rglob("*.py"):
            if p.resolve() in seen:
                continue
            if not any(part in EXCLUDED_DIR_PARTS
                       for part in p.relative_to(REPO_ROOT).parts):
                seen.add(p.resolve())
                yield p
    for p in REPO_ROOT.glob("*.py"):
        if p.resolve() not in seen:
            seen.add(p.resolve())
            yield p


def _ts_files():
    for root in TS_SCAN_ROOTS:
        if not root.exists():
            continue
        for p in root.rglob("*.ts"):
            if not any(part in EXCLUDED_DIR_PARTS
                       for part in p.relative_to(REPO_ROOT).parts):
                yield p
        for p in root.rglob("*.tsx"):
            if not any(part in EXCLUDED_DIR_PARTS
                       for part in p.relative_to(REPO_ROOT).parts):
                yield p


def _is_const_ref(node):
    """True when an AST expression can only be a schema.py constant or a
    static string literal (compile-time value, not runtime input)."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return True
    if isinstance(node, ast.Name):
        return node.id in PY_CONSTANTS
    if isinstance(node, ast.Attribute):
        return node.attr in PY_CONSTANTS
    return False


def _scan_py_modulo(node):
    """Check a %-formatting node; return a violation reason or None when OK.

    None means: either the format has no Cypher keyword, or every
    placeholder is statically resolvable to a schema constant / literal.
    A truthy string means: the keyword-bearing format is interpolated with
    content that cannot be proven to be a schema constant.
    """
    fmt = node.left
    if not isinstance(fmt, ast.Constant) or not isinstance(fmt.value, str):
        return None
    if not CYPHER_KW.search(fmt.value):
        return None
    convs = list(CONV_RE.finditer(fmt.value))
    if not convs:
        return None  # nothing interpolated (e.g. literal %%)
    named = [c for c in convs if c.group(1)]
    if named and any(c.group(1) not in PY_CONSTANTS for c in named):
        return "named placeholder(s) not from schema.py: %s" % (
            ", ".join(c.group(1) for c in named if c.group(1) not in PY_CONSTANTS))
    positional = [c for c in convs if not c.group(1)]
    if positional:
        args = node.right
        elements = args.elts if isinstance(args, (ast.Tuple, ast.List)) else [args]
        if len(elements) != len(positional):
            return "positional args (%d) != conversions (%d)" % (
                len(elements), len(positional))
        bad = [ast.dump(e) for e in elements if not _is_const_ref(e)]
        if bad:
            return "interpolated value not a schema constant: %s" % bad[0][:80]
    return None


def scan_py_file(path):
    """Return list of (lineno, kind, snippet) violations."""
    violations = []
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.JoinedStr):
            interp = [v for v in node.values if isinstance(v, ast.FormattedValue)]
            if not interp:
                continue
            for frag in node.values:
                if isinstance(frag, ast.Constant) and isinstance(frag.value, str):
                    if CYPHER_KW.search(frag.value):
                        if all(_is_const_ref(v.value) for v in interp):
                            continue
                        violations.append(
                            (frag.lineno, "f-string", frag.value.strip()[:80]))
        elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
            reason = _scan_py_modulo(node)
            if reason is not None and isinstance(node.left, ast.Constant) \
                    and isinstance(node.left.value, str):
                violations.append(
                    (node.lineno, "%%-format (%s)" % reason,
                     node.left.value.strip()[:80]))
    return violations


def scan_ts_file(path):
    """Return list of (lineno, kind, snippet) violations."""
    violations = []
    text = path.read_text(encoding="utf-8", errors="replace")
    for m in TEMPLATE_SCANNER.finditer(text):
        body = m.group(1)
        if not TS_TEXT.search(body) or "${" not in body:
            continue
        lineno = text.count("\n", 0, m.start()) + 1
        interps = [i.strip() for i in TS_INTERP.findall(body)]
        ok = False
        if interps:
            ok = True
            for expr in interps:
                toks = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", expr)
                if not any(t in TS_CONSTANTS for t in toks):
                    ok = False
                    break
        if not ok:
            violations.append((lineno, "template-literal", body.strip()[:80]))
    return violations


def _collect_violations():
    violations = []
    for p in sorted(_py_files()):
        try:
            for lineno, kind, snip in scan_py_file(p):
                violations.append("%s:%d [%s] %s" % (
                    p.relative_to(REPO_ROOT), lineno, kind, snip))
        except SyntaxError as e:
            violations.append("%s:0 [syntax-error] %s" % (
                p.relative_to(REPO_ROOT), e))
    for p in sorted(_ts_files()):
        for lineno, kind, snip in scan_ts_file(p):
            violations.append("%s:%d [%s] %s" % (
                p.relative_to(REPO_ROOT), lineno, kind, snip))
    return violations


def test_no_parameterised_cypher_in_app_code():
    violations = _collect_violations()
    assert not violations, (
        "String-interpolated Cypher (hard rule 1) in %d place(s):\n  %s"
        % (len(violations), "\n  ".join(violations)))
