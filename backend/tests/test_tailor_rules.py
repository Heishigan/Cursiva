import core.agent as A
from core.models import CVData
from tests.fakes import Recorder


def test_no_owner_specific_project_rule(monkeypatch):
    rec = Recorder()
    monkeypatch.setattr(A, "get_llm_json", rec.factory(lambda pv: CVData(reasoning="r", professional_summary="p", sections=[])))
    A.tailor_node({"api_key": "x", "generic_cv_raw": "{}", "job_description": "", "strategy_plan": ""})
    p = rec.last
    assert "exactly 5 projects" not in p and "Master's Thesis" not in p
    assert "NEVER invent" in p and "—" in p
