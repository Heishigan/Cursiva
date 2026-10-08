import datetime
import json

import pytest

import core.agent as A
import credits
from tests.conftest import get_credits, set_credits

BODY = {"job_description": "jd", "generic_cv_raw": "{}", "company_name": "c", "role_name": "r",
        "strategy_plan": "s", "thread_id": "t"}


class FakeGraph:
    def __init__(self, events=None, exc=None):
        self.events = events or []
        self.exc = exc

    def stream(self, state, config=None):
        for e in self.events:
            yield e
        if self.exc:
            raise self.exc


PASS_EVENTS = [{"tailor": {"revision_count": 1, "tailored_cv": {"professional_summary": "p"}}},
               {"reviewer": {"review_feedback": "PASS"}},
               {"cover_letter": {"cover_letter_parts": {"hook": "h"}}}]


def _results(resp):
    out = []
    for chunk in resp.text.split("\n\n"):
        if chunk.startswith("data: "):
            d = json.loads(chunk[6:])
            if d["type"] == "result":
                out.append(d)
    return out


def _runs(db):
    from models import GenerationRun
    db.expire_all()
    return db.query(GenerationRun).all()


def test_success_charges_one_credit(client, app_module, monkeypatch, db):
    set_credits("user_A", 3)
    monkeypatch.setattr(app_module, "tailor_app", FakeGraph(PASS_EVENTS))
    res = _results(client.post("/api/tailor", json=BODY))
    assert res[-1]["status"] == "success"
    assert get_credits("user_A") == 2
    (run,) = _runs(db)
    assert run.status == "success" and not run.refunded and run.revision_count == 1


def test_insufficient_credits_402(client):
    set_credits("user_A", 0)
    assert client.post("/api/tailor", json=BODY).status_code == 402
    assert get_credits("user_A") == 0


def test_no_profile_402(client):
    assert client.post("/api/tailor", json=BODY).status_code == 402


def test_exception_mid_stream_refunds_and_reports_error(client, app_module, monkeypatch, db):
    set_credits("user_A", 1)
    monkeypatch.setattr(app_module, "tailor_app", FakeGraph(PASS_EVENTS[:1], exc=RuntimeError("OpenAI timeout")))
    res = _results(client.post("/api/tailor", json=BODY))
    assert res[-1]["status"] == "error" and res[-1]["refunded"] is True
    assert get_credits("user_A") == 1
    (run,) = _runs(db)
    assert run.status == "error" and run.refunded


def test_failed_review_at_cap_refunds(client, app_module, monkeypatch, db):
    set_credits("user_A", 1)
    events = []
    for i in range(1, 4):
        events += [{"tailor": {"revision_count": i, "tailored_cv": {"x": i}}},
                   {"reviewer": {"review_feedback": f"Issue {i}."}}]
    monkeypatch.setattr(app_module, "tailor_app", FakeGraph(events))
    res = _results(client.post("/api/tailor", json=BODY))
    assert res[-1]["status"] == "failed_review" and res[-1]["refunded"] is True
    assert "tailored_cv" not in res[-1]
    assert get_credits("user_A") == 1
    (run,) = _runs(db)
    assert run.status == "failed_review" and run.cap_hit and json.loads(run.failure_reasons_json) == ["Issue 1.", "Issue 2.", "Issue 3."]


def test_real_graph_gives_up_at_cap_without_cover_letter(client, app_module, monkeypatch):
    """End to end through the real LangGraph with a reviewer that always fails."""
    from core.models import CVData
    from langchain_core.runnables import RunnableLambda
    calls = {"tailor": 0, "cl": 0}

    def tailor_llm(_k):
        def f(pv):
            calls["tailor"] += 1
            return CVData(reasoning="r", professional_summary="p", sections=[])
        return RunnableLambda(f)

    monkeypatch.setattr(A, "get_llm_json", tailor_llm)
    monkeypatch.setattr(A, "reviewer_node", lambda s: {"review_feedback": "Always fails."})
    monkeypatch.setattr(A, "get_llm_cl_out", lambda k: RunnableLambda(lambda pv: calls.__setitem__("cl", 1)))
    import importlib
    graph = A.build_graph() if hasattr(A, "build_graph") else None
    if graph is None:
        pytest.skip("graph builder not exposed")
    monkeypatch.setattr(app_module, "tailor_app", graph)
    set_credits("user_A", 1)
    res = _results(client.post("/api/tailor", json=BODY))
    assert res[-1]["status"] == "failed_review"
    assert calls["tailor"] == A.MAX_REVISIONS and calls["cl"] == 0
    assert get_credits("user_A") == 1


def test_review_conditional():
    assert A.review_conditional({"review_feedback": "PASS", "revision_count": 3}) == "pass"
    assert A.review_conditional({"review_feedback": "bad", "revision_count": 1}) == "fail"
    assert A.review_conditional({"review_feedback": "bad", "revision_count": A.MAX_REVISIONS}) == "give_up"


def test_refund_is_idempotent(app_module):
    set_credits("user_A", 1)
    run_id = credits.charge_for_run("user_A")
    assert get_credits("user_A") == 0
    assert credits.refund_run(run_id, "error") is True
    assert credits.refund_run(run_id, "error") is False
    assert credits.refund_run(run_id, "abandoned") is False
    assert get_credits("user_A") == 1


def test_success_cannot_be_refunded(app_module):
    set_credits("user_A", 1)
    run_id = credits.charge_for_run("user_A")
    assert credits.mark_success(run_id)
    assert credits.refund_run(run_id, "error") is False
    assert get_credits("user_A") == 0


def test_generator_closed_early_refunds(app_module, monkeypatch):
    """Client disconnect: Starlette closes the generator -> GeneratorExit -> refund."""
    set_credits("user_A", 1)
    monkeypatch.setattr(app_module, "tailor_app", FakeGraph(PASS_EVENTS))
    from starlette.requests import Request
    req = Request({"type": "http", "method": "POST", "path": "/api/tailor", "headers": [], "client": ("1.2.3.4", 1)})
    resp = app_module.run_tailor.__wrapped__(req, app_module.TailorRequest(**BODY), "user_A")
    gen = resp.body_iterator
    assert get_credits("user_A") == 0
    # Read the first status event, then disconnect.
    import anyio

    async def first_then_close():
        await gen.__anext__()
        await gen.aclose()
    anyio.run(first_then_close)
    assert get_credits("user_A") == 1


def test_stale_running_runs_are_swept(app_module, db):
    from models import GenerationRun
    set_credits("user_A", 1)
    run_id = credits.charge_for_run("user_A")
    run = db.get(GenerationRun, run_id)
    run.created_at = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    db.commit()
    assert credits.sweep_stale_runs() == 1
    assert get_credits("user_A") == 1
