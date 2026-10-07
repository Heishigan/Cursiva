import json

import usage
from tests.conftest import set_credits
from tests.test_credits import BODY, PASS_EVENTS


def test_usage_to_metrics_prices_known_models():
    m = usage.usage_to_metrics({"gpt-4o-2024-08-06": {"input_tokens": 1_000_000, "output_tokens": 100_000},
                                "gpt-4o-mini": {"input_tokens": 1_000_000, "output_tokens": 0}})
    assert m == {"prompt_tokens": 2_000_000, "completion_tokens": 100_000, "cost_usd": round(2.5 + 1.0 + 0.15, 6)}


def test_unknown_model_cost_is_null():
    assert usage.usage_to_metrics({"mystery": {"input_tokens": 5, "output_tokens": 5}})["cost_usd"] is None


def test_price_override(monkeypatch):
    monkeypatch.setenv("LLM_PRICES", "gpt-4o:1:1")
    assert usage.usage_to_metrics({"gpt-4o": {"input_tokens": 1_000_000, "output_tokens": 0}})["cost_usd"] == 1.0


def test_run_records_tokens_from_callback(client, app_module, monkeypatch, db):
    class Graph:
        def stream(self, state, config=None):
            cb = config["callbacks"][0]
            cb.usage_metadata = {"gpt-4o": {"input_tokens": 1000, "output_tokens": 200}}
            yield from PASS_EVENTS
    monkeypatch.setattr(app_module, "tailor_app", Graph())
    set_credits("user_A", 1)
    client.post("/api/tailor", json=BODY)
    from models import GenerationRun
    (run,) = db.query(GenerationRun).all()
    assert run.prompt_tokens == 1000 and run.completion_tokens == 200 and run.cost_usd == round(1000 / 1e6 * 2.5 + 200 / 1e6 * 10, 6)
