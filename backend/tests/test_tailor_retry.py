import pytest

import core.agent as A
from core.models import CVData
from tests.fakes import Recorder


@pytest.fixture()
def rec(monkeypatch):
    r = Recorder()
    monkeypatch.setattr(A, "get_llm_json", r.factory(lambda pv: CVData(reasoning="r", professional_summary="p", sections=[])))
    monkeypatch.setattr(A, "get_lessons", lambda *a, **k: [])
    return r


BASE = {"api_key": "x", "job_description": "JD", "generic_cv_raw": "{}", "strategy_plan": "plan"}


def test_retry_includes_reviewer_issues_and_previous_draft(rec):
    A.tailor_node({**BASE, "revision_count": 1, "review_feedback": "- [unsupported_number] remove 45",
                   "tailored_cv": {"professional_summary": "DRAFT_ONE", "reasoning": "hidden"}})
    assert "remove 45" in rec.last and "DRAFT_ONE" in rec.last and "hidden" not in rec.last


def test_first_attempt_has_no_review_section(rec):
    A.tailor_node({**BASE, "revision_count": 0})
    assert "QUALITY REVIEW FAILED" not in rec.last


def test_user_feedback_applies_to_previous_draft(rec):
    A.tailor_node({**BASE, "revision_count": 0, "user_feedback": "shorter summary",
                   "tailored_cv": {"professional_summary": "SHOWN_DRAFT"}})
    assert "SHOWN_DRAFT" in rec.last and "QUALITY REVIEW FAILED" not in rec.last


def test_revision_count_increments(rec):
    assert A.tailor_node({**BASE, "revision_count": 2})["revision_count"] == 3


def test_feedback_request_seeds_previous_draft(client, app_module, monkeypatch, rec):
    from tests.conftest import set_credits
    monkeypatch.setattr(A, "reviewer_node", lambda s: {"review_feedback": "PASS"})
    monkeypatch.setattr(A, "cover_letter_node", lambda s: {"cover_letter_parts": {}})
    monkeypatch.setattr(app_module, "tailor_app", A.build_graph())
    set_credits("user_A", 1)
    body = {"job_description": "jd", "generic_cv_raw": "{}", "strategy_plan": "s", "user_feedback": "shorter",
            "previous_tailored_cv": {"professional_summary": "THE_DRAFT_I_SAW"}}
    client.post("/api/tailor", json=body)
    assert "THE_DRAFT_I_SAW" in rec.prompts[0]
