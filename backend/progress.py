"""Structured progress events for the Glassbox view.

Each pipeline step reports what it is doing and, when done, plain facts
derived from its real output (counts, labels), never the model's free-form
reasoning. The old {"type": "status"} messages are still sent alongside for
older clients.
"""
import json
import re

from core import checks

AGENTS = ("reader", "strategist", "cv", "checker", "letter")
_FIT_RE = re.compile(r"\b(strong|good|moderate|weak|low|stretch)\s+fit\b", re.I)


def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def stage(agent: str, state: str, summary: str, **facts) -> str:
    assert agent in AGENTS
    return sse({"type": "stage", "agent": agent, "state": state, "summary": summary, "facts": facts})


def draft(doc: str, content: dict) -> str:
    return sse({"type": "draft", "doc": doc, "content": content})


def fit_label(strategy_plan: str) -> str:
    m = _FIT_RE.search(strategy_plan or "")
    return (m.group(1).capitalize() + " fit") if m else ""


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def cv_changes(generic_cv_raw: str, tailored: dict) -> dict:
    """How many bullets differ from the user's original CV."""
    try:
        generic = json.loads(generic_cv_raw or "{}")
    except (TypeError, ValueError):
        generic = {}
    original = {_norm(b) for sec in generic.get("sections", []) or [] for it in sec.get("items", []) or []
                for b in it.get("bullets", []) or []}
    bullets = [b for sec in (tailored or {}).get("sections", []) or [] for it in sec.get("items", []) or []
               for b in it.get("bullets", []) or []]
    changed = sum(1 for b in bullets if _norm(b) not in original)
    summary_changed = _norm((tailored or {}).get("professional_summary", "")) != _norm(generic.get("professional_summary", ""))
    return {"bullets_total": len(bullets), "bullets_changed": changed, "summary_changed": summary_changed}


def cv_summary(c: dict) -> str:
    parts = [f"{c['bullets_changed']} of {c['bullets_total']} bullets tailored"]
    if c["summary_changed"]:
        parts.append("summary rewritten")
    return " · ".join(parts)


def numbers_in(cv: dict) -> int:
    return len(checks._numbers(checks.cv_text(cv or {})))


def letter_facts(parts: dict) -> dict:
    body = [parts.get(k, "") for k in ("hook", "match", "curiosity", "fit")]
    words = sum(len((p or "").split()) for p in body)
    return {"paragraphs": sum(1 for p in body if (p or "").strip()), "words": words}
