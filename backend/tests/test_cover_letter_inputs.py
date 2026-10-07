import json

import core.agent as A
from core.models import CoverLetterOutput, CVData
from tests.fakes import Recorder


def test_strategist_insights_reach_cover_letter_prompt(client, app_module, monkeypatch):
    from tests.conftest import set_credits
    rec = Recorder()
    monkeypatch.setattr(A, "get_llm_json", Recorder().factory(lambda pv: CVData(reasoning="r", professional_summary="p", sections=[])))
    monkeypatch.setattr(A, "reviewer_node", lambda s: {"review_feedback": "PASS"})
    monkeypatch.setattr(A, "get_llm_cl_out", rec.factory(lambda pv: CoverLetterOutput(
        salutation="s", hook="h", match="m", curiosity="c", fit="f", sign_off="o")))
    monkeypatch.setattr(app_module, "tailor_app", A.build_graph())
    set_credits("user_A", 1)
    body = {"job_description": "jd", "generic_cv_raw": "{}", "company_name": "c", "role_name": "r",
            "strategy_plan": "s", "role_philosophy": "PHILOSOPHY_X", "sharpest_project_insight": "INSIGHT_Y"}
    r = client.post("/api/tailor", json=body)
    assert '"status": "success"' in r.text
    assert "PHILOSOPHY_X" in rec.last and "INSIGHT_Y" in rec.last
    assert "philosophy ()" not in rec.last
