import json

import pytest

import core.agent as A
from core.models import ReviewIssue, ReviewResult
from tests.fakes import Recorder
from tests.test_checks import RAW, tailored


def _state(cv, **kw):
    s = {"api_key": "x", "generic_cv_raw": RAW, "tailored_cv": cv}
    s.update(kw)
    return s


@pytest.fixture()
def judge(monkeypatch):
    rec = Recorder()
    box = {"result": ReviewResult(passed=True)}
    monkeypatch.setattr(A, "get_llm_review", rec.factory(lambda pv: box["result"]))
    rec.box = box
    return rec


def test_formatting_is_autofixed_not_failed(judge):
    cv = tailored(professional_summary="ML engineer — with **4** years of experience.")
    out = A.reviewer_node(_state(cv))
    assert out["review_feedback"] == "PASS"
    assert "—" not in out["tailored_cv"]["professional_summary"]
    assert "**" not in out["tailored_cv"]["professional_summary"]


def test_deterministic_failure_skips_llm(judge):
    cv = tailored(professional_summary="ML engineer with 9 years of experience.")
    out = A.reviewer_node(_state(cv))
    assert "unsupported_number" in out["review_feedback"]
    assert judge.prompts == []


def test_reviewer_sees_supplemental_context(judge):
    A.reviewer_node(_state(tailored(), user_strategy_answers="I also used Kubernetes at Acme."))
    assert "I also used Kubernetes at Acme." in judge.last


def test_ungrounded_llm_issue_is_ignored(judge):
    judge.box["result"] = ReviewResult(passed=False, issues=[ReviewIssue(quote="Kubernetes expert", problem="invented")])
    assert A.reviewer_node(_state(tailored()))["review_feedback"] == "PASS"


def test_grounded_llm_issue_fails(judge):
    judge.box["result"] = ReviewResult(passed=False, issues=[ReviewIssue(quote="Wrote tests", problem="exaggerated")])
    fb = A.reviewer_node(_state(tailored()))["review_feedback"]
    assert fb != "PASS" and "Wrote tests" in fb


def test_reviewer_prompt_has_no_style_rules(judge):
    A.reviewer_node(_state(tailored()))
    assert "ignore them completely" in judge.last
