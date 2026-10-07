import pytest

import core.agent as A
from core.models import CoverLetterOutput, CVData
from tests.fakes import Recorder

TRICKY = ['{"a": 1}', "a lone } brace", "{company_name}", "{{double}}", "plain text"]


@pytest.fixture()
def rec(monkeypatch):
    r = Recorder()
    monkeypatch.setattr(A, "get_llm_cl_out", r.factory(lambda pv: CoverLetterOutput(
        salutation="s", hook="h", match="m", curiosity="c", fit="f", sign_off="o")))
    monkeypatch.setattr(A, "get_llm_json", r.factory(lambda pv: CVData(
        reasoning="r", professional_summary="p", sections=[])))
    return r


def _state(**kw):
    s = {"api_key": "x", "user_id": "", "job_description": "JD", "generic_cv_raw": "{}",
         "tailored_cv": {"professional_summary": "p"}, "generate_cover_letter": True}
    s.update(kw)
    return s


@pytest.mark.parametrize("text", TRICKY)
@pytest.mark.parametrize("field", ["user_strategy_answers", "user_feedback", "role_philosophy", "sharpest_project_insight"])
def test_cover_letter_survives_braces_in_user_text(rec, field, text):
    A.cover_letter_node(_state(**{field: text}))
    assert text in rec.last  # passed through verbatim, not interpreted


@pytest.mark.parametrize("text", TRICKY)
def test_cover_letter_survives_braces_in_lessons(rec, monkeypatch, text):
    monkeypatch.setattr(A, "get_lessons", lambda *a, **k: [text])
    A.cover_letter_node(_state(user_id="u"))
    assert text in rec.last


def test_user_text_not_in_system_message(rec):
    A.cover_letter_node(_state(user_strategy_answers="SECRET_MARKER"))
    system_part = rec.last.split("Human:", 1)[0]
    assert "SECRET_MARKER" not in system_part


@pytest.mark.parametrize("text", TRICKY)
def test_tailor_survives_braces(rec, text):
    A.tailor_node(_state(user_strategy_answers=text, user_feedback=text))
