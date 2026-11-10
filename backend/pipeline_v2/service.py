"""How the v2 pipeline plugs into /api/intake and /api/tailor.

Same events and result fields as v1, so the site keeps working; new fields
(`analysis`, `review`) are extra and only read by the updated screens."""
from __future__ import annotations

import json
import logging
import os

import progress
from .schemas import letter_paragraphs
from .analysis import analyse, to_legacy
from .generate import app as generate_app, ensure_analysis

logger = logging.getLogger(__name__)


def _counts(final_state: dict) -> dict:
    """What happened in a run, as numbers only (no user text), for the logs."""
    edits = final_state.get("cv_edits") or {}
    cv = final_state.get("cv_report") or {}
    letter = final_state.get("letter") or {}
    lr = final_state.get("letter_report") or {}
    return {
        "edits_proposed": len(edits.get("edits") or []),
        "edits_applied": len(cv.get("edits_applied") or []),
        "edits_dropped": len(cv.get("edits_dropped") or []),
        "summary_sentences_dropped": cv.get("summary_sentences_dropped", 0),
        "letter_paragraphs_written": len(letter_paragraphs(letter)),
        "letter_sentences_written": sum(len(p) for _, p in letter_paragraphs(letter)),
        "letter_sentences_final": len(lr.get("sentences") or []),
        "letter_repaired": len(lr.get("repaired") or []),
        "letter_flags": len(lr.get("flags") or []),
        "letter_words": lr.get("words"),
    }


def enabled() -> bool:
    """Pipeline v2 is the pipeline. PIPELINE_VERSION=1 is an emergency fallback
    to the old one, kept only until v2 has run in production for a while."""
    return os.environ.get("PIPELINE_VERSION", "2").strip() != "1"


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _profile(generic_cv_raw: str) -> dict:
    try:
        cv = json.loads(generic_cv_raw or "{}")
    except (TypeError, ValueError):
        cv = {}
    return cv if isinstance(cv, dict) else {}


def intake_events(req, user_id: str, strict_eligibility: bool, find_duplicate):
    """`find_duplicate(company, role)` -> bool, supplied by main.py."""
    yield _sse({"type": "status", "message": "Reading the job ad and your CV..."})
    yield progress.stage("reader", "working", "Reading the job ad")
    try:
        a = analyse(req.job_description, _profile(req.generic_cv_raw), "", os.environ.get("OPENAI_API_KEY"))
    except Exception:
        logger.exception("v2 analysis failed for user %s", user_id)
        yield _sse({"type": "result", "status": "error",
                    "reason": "We couldn't analyse this job description right now. Please try again in a minute."})
        return
    metadata, strategy = to_legacy(a)
    reqs = metadata["key_requirements"]
    yield progress.stage("reader", "done", f"{len(a.requirements)} requirements found", requirements=reqs,
                         company=metadata["company_name"], role=metadata["role_name"])
    if not a.is_job_ad and not req.override_eligibility:
        yield _sse({"type": "result", "status": "ineligible",
                    "reason": "This text doesn't look like a job ad. Check what you pasted, or proceed anyway."})
        return
    company, role = metadata["company_name"], metadata["role_name"]
    if company and role and not req.override_eligibility and find_duplicate(company, role):
        yield _sse({"type": "result", "status": "ineligible",
                    "reason": f"Duplicate detected! You have already started an application for {role} at {company}."})
        return
    if not metadata["eligibility_passed"] and not req.override_eligibility and strict_eligibility:
        yield _sse({"type": "result", "status": "ineligible", "reason": metadata["eligibility_reason"]})
        return
    yield progress.stage("strategist", "working", "Matching your experience to the role")
    label = strategy["fit_label"]
    angles = len(strategy["strategic_options"])
    yield progress.stage("strategist", "done", " · ".join(x for x in (label, f"{angles} angles proposed") if x),
                         fit=label, angles=angles)
    yield _sse({"type": "result", "status": "success", "metadata": metadata, "strategy": strategy})


def tailor_events(req, user_id: str, usage_cb, final_state: dict, get_lessons):
    """Runs the generation graph and fills `final_state` with what main.py's
    result handling reads (tailored_cv, cover_letter_parts, review_feedback)."""
    api_key = os.environ.get("OPENAI_API_KEY")
    config = {"callbacks": [usage_cb]}
    state = {
        "api_key": api_key,
        "job_description": req.job_description,
        "profile_cv": _profile(req.generic_cv_raw),
        "analysis": req.analysis or {},
        "notes": req.user_strategy_answers or "",
        "preferences": get_lessons(user_id, ["CV", "Cover_Letter", "General"]),
        "feedback": req.user_feedback or "",
        "previous_cv": req.previous_tailored_cv if req.user_feedback else None,
        "previous_letter": req.previous_letter if req.user_feedback else None,
    }
    if not state["analysis"]:
        yield progress.stage("cv", "working", "Reading the job ad again")
    state["analysis"] = ensure_analysis(state, config)
    write_letter = req.generate_cover_letter
    if write_letter is None:
        write_letter = state["analysis"].get("write_letter_default", True)
    state["write_letter"] = bool(write_letter)
    # Show the user's own CV first; the checked changes are then played onto it.
    original = {k: v for k, v in state["profile_cv"].items() if k not in ("personal_info", "template")}
    yield progress.draft("cv", original)
    yield progress.stage("cv", "working", "Choosing what to change in your CV", revision=1)
    if state["write_letter"]:
        yield progress.stage("letter", "working", "Writing your cover letter, citing each fact")
    else:
        yield progress.stage("letter", "done", "Switched off for this job")
    seen = set()
    for update in generate_app.stream(state, config=config, stream_mode="updates"):
        for node, out in update.items():
            out = out or {}
            final_state.update(out)
            seen.add(node)
            if node == "cv":
                n = len((out.get("cv_edits") or {}).get("edits") or [])
                yield progress.stage("cv", "done", f"{n} edit{'s' if n != 1 else ''} proposed")
            elif node == "letter" and state["write_letter"]:
                yield progress.stage("letter", "working", "Draft written; waiting for the check")
            if {"cv", "letter"} <= seen and "check_started" not in seen:
                seen.add("check_started")
                yield progress.stage("checker", "working", "Checking every change against its source")
            if node == "check":
                rep = out.get("cv_report") or {}
                kept, dropped = len(rep.get("edits_applied", [])), len(rep.get("edits_dropped", []))
                fixes = len(out.get("pending_repairs") or [])
                bits = [f"{kept} edit{'s' if kept != 1 else ''} kept"]
                if dropped:
                    bits.append(f"{dropped} dropped")
                if fixes:
                    bits.append(f"{fixes} letter sentence{'s' if fixes != 1 else ''} to fix")
                yield progress.stage("checker", "retry" if fixes else "done", " · ".join(bits))
                # The checked CV, with what changed and what was dropped, so the
                # live view can play each change onto the original in turn.
                yield progress.draft("cv", {**(out.get("tailored_cv") or {}),
                                            "changes": rep.get("changes", []), "dropped": rep.get("edits_dropped", [])})
            elif node == "repair":
                flags = len((out.get("letter_report") or {}).get("flags") or [])
                summary = "Fixed the flagged sentences" if not flags else f"{flags} sentence{'s' if flags != 1 else ''} flagged for you"
                yield progress.stage("checker", "done", summary)
            elif node == "finish":
                parts = out.get("cover_letter_parts") or {}
                if parts:
                    lf = progress.letter_facts(parts)
                    yield progress.stage("letter", "done", f"{lf['paragraphs']} paragraphs · {lf['words']} words", **lf)
                    yield progress.draft("letter", parts)
    logger.info("v2_run %s", json.dumps(_counts(final_state)))
    final_state["review_feedback"] = "PASS"
    final_state["revision_count"] = 1
    final_state["review"] = {
        "cv": final_state.get("cv_report") or {},
        "letter": final_state.get("letter_report") or {},
        "letter_written": state["write_letter"],
    }
