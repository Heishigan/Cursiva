import inspect
"""Round 1 prompt changes (approved): guard that they stay in place."""
import core.agent as A
from core.models import CoverLetterOutput, CVData
from tests.fakes import Recorder


def _render(monkeypatch):
    rec = Recorder()
    monkeypatch.setattr(A, "get_llm_cl_out", rec.factory(lambda pv: CoverLetterOutput(
        salutation="s", hook="h", match="m", curiosity="c", fit="f", sign_off="o")))
    monkeypatch.setattr(A, "get_llm_json", rec.factory(lambda pv: CVData(reasoning="r", professional_summary="p", sections=[])))
    state = {"api_key": "x", "user_id": "", "job_description": "JD", "generic_cv_raw": "{}",
             "tailored_cv": {"professional_summary": "p"}, "generate_cover_letter": True}
    A.cover_letter_node(state)
    cl = rec.last
    A.tailor_node(state)
    return cl, rec.last


def test_cover_letter_round1(monkeypatch):
    cl, _ = _render(monkeypatch)
    assert "Write the WHOLE letter in that language" in cl
    assert "Match the language of the Job Description" not in cl
    assert "Include exactly one honest limitation" not in cl
    assert "If there is no such gap, do not invent one." in cl
    assert "Anchor this paragraph in at least one concrete result" in cl
    assert '"no small feat,"' in cl
    assert "Total 180-220 words" not in cl and "160-240 words in total" in cl


def test_tailor_round1(monkeypatch):
    _, cv = _render(monkeypatch)
    assert "Go through the JD's key requirements one by one" in cv
    assert '"AI agents" for "AI-agenter"' in cv


def test_cover_letter_round2_swedish_bans(monkeypatch):
    cl, _ = _render(monkeypatch)
    assert '"ser fram emot"' in cl and "equivalents in the letter's language" in cl


# --- instructions are instructions, not facts ---
def test_tailor_treats_user_text_as_instructions_not_facts():
    src = inspect.getsource(A.tailor_node)
    assert "They are NOT candidate facts: the Generic CV is the only source of facts." in src
    assert "do NOT add it" in src
    assert "strictly factual candidate data" not in src


def test_cover_letter_treats_user_text_as_instructions_not_facts():
    src = inspect.getsource(A.cover_letter_node)
    assert "They are NOT candidate facts: the CV is the only source of facts." in src
    assert "strictly factual candidate data" not in src
    assert "never claim anything that is not in the CV" in src


def test_reviewer_source_is_generic_cv_only():
    assert "SOURCE (the only ground truth): the Generic CV." in A.REVIEWER_SYSTEM
    assert "Supplemental" not in A.REVIEWER_SYSTEM
