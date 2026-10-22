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


def test_user_instructions_are_not_facts_for_the_reviewer(judge):
    # The note box and feedback are instructions only; the Generic CV is the only source of facts.
    A.reviewer_node(_state(tailored(), user_strategy_answers="I also used Kubernetes at Acme."))
    assert "I also used Kubernetes at Acme." not in judge.last


def test_number_only_in_instructions_is_flagged(judge):
    cv = tailored(professional_summary="ML engineer who shipped 12 models.")
    out = A.reviewer_node(_state(cv, user_strategy_answers="Mention that I have shipped 12 models"))
    assert "unsupported_number" in out["review_feedback"]


def test_ungrounded_llm_issue_is_ignored(judge):
    judge.box["result"] = ReviewResult(passed=False, issues=[ReviewIssue(quote="Kubernetes expert", problem="invented")])
    assert A.reviewer_node(_state(tailored()))["review_feedback"] == "PASS"


def test_grounded_llm_issue_fails(judge):
    cv = tailored()
    cv["sections"][0]["items"][1]["bullets"][0] = "Wrote tests and led the QA team."
    judge.box["result"] = ReviewResult(passed=False, issues=[ReviewIssue(quote="led the QA team", problem="exaggerated")])
    fb = A.reviewer_node(_state(cv))["review_feedback"]
    assert fb != "PASS" and "led the QA team" in fb


def test_reviewer_prompt_has_no_style_rules(judge):
    A.reviewer_node(_state(tailored()))
    assert "ignore them completely" in judge.last


def test_issue_on_users_own_wording_is_ignored(judge):
    # Regression for the Thule run: the judge flagged the user's original bullet as fabricated.
    own = "Cut inference latency by 40% with batching."
    judge.box["result"] = ReviewResult(passed=False, issues=[ReviewIssue(quote=own, problem="not supported")])
    assert A.reviewer_node(_state(tailored()))["review_feedback"] == "PASS"


def test_simplified_own_bullet_is_ignored(judge):
    cv = tailored()
    cv["sections"][0]["items"][0]["bullets"][0] = "Cut inference latency by 40% using batching."
    judge.box["result"] = ReviewResult(passed=False, issues=[ReviewIssue(quote="Cut inference latency by 40% using batching", problem="omits detail")])
    assert A.reviewer_node(_state(cv))["review_feedback"] == "PASS"


def test_new_claim_still_fails(judge):
    cv = tailored()
    cv["sections"][0]["items"][0]["bullets"][0] = "Led a team of engineers building Kubernetes clusters."
    judge.box["result"] = ReviewResult(passed=False, issues=[ReviewIssue(quote="Led a team of engineers building Kubernetes clusters", problem="invented")])
    assert A.reviewer_node(_state(cv))["review_feedback"] != "PASS"


def test_reviewer_prompt_allows_simplification(judge):
    A.reviewer_node(_state(tailored()))
    assert "Losing nuance is NOT fabrication." in judge.last
