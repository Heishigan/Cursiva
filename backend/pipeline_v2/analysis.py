"""Step 1: one analysis call at intake, then code decides the fit label,
eligibility, the letter language and whether a letter is wanted."""
from __future__ import annotations

import json

from . import llm
from .ids import label_cv, label_lines, render_cv, render_lines
from .schemas import Analysis

HARD = {"language", "location", "work_authorization"}
FIT_LABELS = ("Strong", "Good", "Stretch", "Unlikely")


def analyse(job_description: str, cv: dict, notes: str, api_key: str, config=None) -> Analysis:
    lcv = label_cv(cv)
    user = "\n\n".join([
        llm.tag("job_ad", render_lines(label_lines(job_description, "A"))),
        llm.tag("cv", render_cv(lcv)),
        llm.tag("notes", notes),
        llm.tag("today", llm.today()),
    ])
    res = llm.call(Analysis, "analysis", user, api_key, temperature=0.1, config=config)
    return clean(res, lcv, label_lines(job_description, "A"))


def clean(a: Analysis, lcv, ad_lines: dict) -> Analysis:
    """Drop IDs the model invented, so nothing downstream cites a ghost."""
    known = set(lcv.items) | set(lcv.bullets) | {"S", "L"}
    for r in a.requirements:
        r.evidence = [e for e in r.evidence if e in known]
        if r.ad_line not in ad_lines:
            r.ad_line = ""
        if r.status != "missing" and not r.evidence:
            r.status = "missing"
            r.note = (r.note + " (no CV entry cited)").strip()
    for ang in a.angles:
        ang.evidence = [e for e in ang.evidence if e in known]
    return a


def musts(a: Analysis):
    m = [r for r in a.requirements if r.kind == "must"]
    return m or list(a.requirements)


def fit(a: Analysis) -> dict:
    """The fit label, computed from the must-have requirements. Requirements in
    the "other" group (availability, start date, willingness, culture) are the
    candidate's to decide, not qualifications a CV can show: they stay on the
    Strategy screen but don't count towards the label."""
    m = [r for r in musts(a) if r.category != "other"] or musts(a)
    if not m:
        return {"label": "", "met": 0, "total": 0, "hard_gaps": [], "gaps": []}
    hard_gaps = [r.text for r in m if r.category in HARD and r.status == "missing"]
    gaps = [r.text for r in m if r.status == "missing"]
    met = sum(1 for r in m if r.status == "met")
    score = sum(1.0 if r.status == "met" else 0.5 if r.status == "partial" else 0.0 for r in m) / len(m)
    if hard_gaps:
        label = "Unlikely"
    elif score >= 0.999:
        label = "Strong"
    elif score >= 0.75:
        label = "Good"
    else:
        label = "Stretch"
    return {"label": label, "met": met, "total": len(m), "hard_gaps": hard_gaps, "gaps": gaps}


def letter_language(a: Analysis) -> str:
    if a.ad_language == "sv":
        return "sv"
    if any("swed" in r.language.lower() or "svensk" in r.language.lower() for r in a.required_languages):
        return "sv"
    return "en"


def letter_default(a: Analysis) -> bool:
    return a.application.cover_letter != "not_wanted"


def derived(a: Analysis) -> dict:
    f = fit(a)
    return {"fit": f, "letter_language": letter_language(a), "write_letter_default": letter_default(a)}


def fit_sentence(f: dict) -> str:
    if not f["total"]:
        return "No clear requirements found in the ad."
    s = f"{f['met']} of {f['total']} must-haves clearly met."
    if f["hard_gaps"]:
        s += " Not met: " + "; ".join(f["hard_gaps"]) + "."
    elif f["gaps"]:
        s += " Missing: " + "; ".join(f["gaps"][:4]) + ("." if len(f["gaps"]) <= 4 else ", and more.")
    return s


def to_legacy(a: Analysis) -> tuple[dict, dict]:
    """The metadata and strategy shapes the site already reads, plus the new
    `analysis` object for the updated screens."""
    d = derived(a)
    f = d["fit"]
    metadata = {
        "company_name": a.company.strip(),
        "role_name": a.role.strip(),
        "company_location": a.location.strip(),
        "job_summary": a.summary,
        "key_requirements": [r.text for r in musts(a)][:8],
        "eligibility_passed": not f["hard_gaps"],
        "eligibility_reason": ("Not met: " + "; ".join(f["hard_gaps"])) if f["hard_gaps"] else "",
        "is_valid_job_description": a.is_job_ad,
    }
    label = f"{f['label']} fit" if f["label"] else ""
    strategy = {
        "fit_assessment": f"{label}. {fit_sentence(f)}" if label else fit_sentence(f),
        "fit_label": label,
        "strategy_plan": "",
        "role_philosophy": "",
        "sharpest_project_insight": "",
        "strategic_options": [f"{g.title}: {g.rationale}" for g in a.angles],
        "analysis": {**json.loads(a.model_dump_json()), **d},
    }
    return metadata, strategy
