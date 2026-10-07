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
