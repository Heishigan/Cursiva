import json

import core.agent as A


def _results(r):
    return [json.loads(c[6:]) for c in r.text.split("\n\n") if c.startswith("data: ") and '"result"' in c]


def test_setup_llm_failure_is_reported_not_passed(client, app_module, monkeypatch):
    def boom(_k):
        raise RuntimeError("openai down")
    monkeypatch.setattr(A, "get_llm_setup", boom)
    r = client.post("/api/intake", json={"job_description": "jd", "generic_cv_raw": "{}"})
    (res,) = _results(r)
    assert res["status"] == "error" and res["reason"]


def test_strategist_failure_is_reported(client, app_module, monkeypatch):
    monkeypatch.setattr(app_module, "setup_node", lambda s: {"company_name": "", "role_name": "", "eligibility_passed": True})
    monkeypatch.setattr(app_module, "strategist_node", lambda s: (_ for _ in ()).throw(RuntimeError("x")))
    (res,) = _results(client.post("/api/intake", json={"job_description": "jd", "generic_cv_raw": "{}"}))
    assert res["status"] == "error"


def test_llm_has_timeout():
    llm = A.get_llm("sk-test")
    assert llm.request_timeout == A.LLM_TIMEOUT_S and llm.max_retries == A.LLM_MAX_RETRIES
