"""Deterministic CV checks: plain Python, no LLM.

Two kinds:
* autofix_cv: mechanical formatting the model keeps getting wrong (em dashes,
  markdown bold). These are fixed in place instead of failing the run and
  burning a retry.
* find_issues: problems that need a rewrite: banned phrases the tailor
  *introduced*, numbers/metrics absent from every source, and items dropped
  from sections that must be preserved.

Each check only flags what the tailor added. Anything already present in the
user's own CV or supplemental context is allowed, so the reviewer can't fail
a run for text the user wrote.
"""
from __future__ import annotations

import copy
import json
import re
from dataclasses import dataclass

EM_DASH_RE = re.compile(r"\s*(?:—|(?<!-)---(?!-))\s*")
MARKDOWN_BOLD_RE = re.compile(r"(\*\*|__)(.+?)\1", re.S)
STRAY_MARKDOWN_RE = re.compile(r"\*\*|__")

SUMMARY_BANNED = ["passionate about", "dedicated to", "proven track record"]
BULLET_BANNED = ["successfully", "effectively", "expertly", "robust", "seamlessly",
                 "cutting-edge", "cutting edge", "leveraged", "leveraging", "various", "comprehensive"]

_NUMBER_WORDS = {w: str(i) for i, w in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
    "sixteen seventeen eighteen nineteen twenty".split())}
_NUM_RE = re.compile(r"(?<![\w.])(\d+(?:[.,]\d+)*)(\s?(?:%|x|k|m|\+))?", re.I)

# Sections where every item must be kept (rule 5 in the tailor prompt).
_PRESERVE_TYPES = {"work_experience", "education"}


@dataclass
class Issue:
    code: str
    message: str

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"


def _walk_strings(obj, fn):
    if isinstance(obj, str):
        return fn(obj)
    if isinstance(obj, list):
        return [_walk_strings(v, fn) for v in obj]
    if isinstance(obj, dict):
        return {k: (v if k == "reasoning" else _walk_strings(v, fn)) for k, v in obj.items()}
    return obj


def _fix_text(s: str) -> str:
    s = MARKDOWN_BOLD_RE.sub(r"\2", s)
    s = STRAY_MARKDOWN_RE.sub("", s)
    s = EM_DASH_RE.sub(", ", s)
    s = re.sub(r",\s*,", ",", s)
    s = re.sub(r"^\s*,\s*", "", s)
    return s


def autofix_cv(cv: dict) -> tuple[dict, list[str]]:
    """Return a copy of the CV with mechanical formatting fixed, plus a log."""
    before = json.dumps(cv, ensure_ascii=False)
    fixed = _walk_strings(copy.deepcopy(cv), _fix_text)
    log = []
    if "—" in before or "---" in before:
        log.append("replaced em dashes")
    if "**" in before or "__" in before:
        log.append("removed markdown bold")
    return fixed, log


def cv_text(cv: dict) -> str:
    """All human-visible text of a CV (excludes the model's 'reasoning')."""
    parts = []
    _walk_strings({k: v for k, v in (cv or {}).items() if k != "reasoning"}, lambda s: parts.append(s) or s)
    return "\n".join(parts)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower())


def _numbers(text: str) -> set[str]:
    out = set()
    for m in _NUM_RE.finditer(text):
        n = m.group(1).replace(",", "")
        out.add(n)
    return out


def _source_numbers(text: str) -> set[str]:
    nums = _numbers(text)
    for w in re.findall(r"[a-z]+", text.lower()):
        if w in _NUMBER_WORDS:
            nums.add(_NUMBER_WORDS[w])
    return nums


def _phrase_in(phrase: str, text: str) -> bool:
    return re.search(r"\b" + re.escape(phrase) + r"\b", text) is not None


def find_issues(tailored: dict, generic_cv_raw: str, supplemental: str = "") -> list[Issue]:
    issues: list[Issue] = []
    source = _norm(cv_text(_safe_json(generic_cv_raw)) + "\n" + (generic_cv_raw or "") + "\n" + (supplemental or ""))
    summary = _norm(tailored.get("professional_summary", ""))

    for p in SUMMARY_BANNED:
        if _phrase_in(p, summary) and not _phrase_in(p, source):
            issues.append(Issue("banned_phrase", f'Professional summary uses the banned phrase "{p}". Rewrite that sentence without it.'))

    bullets = _norm("\n".join(b for sec in tailored.get("sections", []) or []
                              for item in sec.get("items", []) or [] for b in item.get("bullets", []) or []))
    for p in BULLET_BANNED:
        if _phrase_in(p, bullets) and not _phrase_in(p, source):
            issues.append(Issue("banned_phrase", f'A bullet uses the banned intensifier "{p}". Remove it or replace it with a concrete verb.'))

    new_numbers = sorted(_numbers(cv_text(tailored)) - _source_numbers(source), key=lambda x: (len(x), x))
    if new_numbers:
        issues.append(Issue("unsupported_number",
                            "These numbers or metrics don't appear in the candidate's CV or supplemental context and must be "
                            f"removed or corrected to the exact source value: {', '.join(new_numbers)}"))

    issues.extend(_dropped_items(tailored, _safe_json(generic_cv_raw)))
    return issues


def _dropped_items(tailored: dict, generic: dict) -> list[Issue]:
    out = []
    t_secs = {_norm(s.get("title", "")): s for s in tailored.get("sections", []) or []}
    for g in generic.get("sections", []) or []:
        if g.get("type") not in _PRESERVE_TYPES:
            continue
        t = t_secs.get(_norm(g.get("title", "")))
        g_items = g.get("items", []) or []
        if t is None:
            out.append(Issue("missing_section", f'The section "{g.get("title")}" from the original CV is missing. Include it with all its items.'))
            continue
        t_titles = {_norm(i.get("title", "")) for i in t.get("items", []) or []}
        missing = [i.get("title", "") for i in g_items if _norm(i.get("title", "")) not in t_titles]
        if missing:
            out.append(Issue("missing_items", f'Section "{g.get("title")}" is missing these original items (keep every item and its title unchanged): {"; ".join(missing)}'))
    return out


def _safe_json(raw: str) -> dict:
    try:
        d = json.loads(raw) if raw else {}
        return d if isinstance(d, dict) else {}
    except (TypeError, ValueError):
        return {}


def quote_in_cv(quote: str, cv: dict) -> bool:
    """True if a reviewer's quoted snippet really occurs in the CV text.

    Used to discard reviewer complaints about text that isn't there, a common
    cause of an LLM reviewer failing every attempt.
    """
    q = _norm(quote).strip(" .\"'")
    return len(q) >= 3 and q in _norm(cv_text(cv))
