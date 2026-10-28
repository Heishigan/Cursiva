import datetime
from fastapi.testclient import TestClient
import credits
from tests.conftest import get_credits, set_credits


def test_sweep_stale_runs_unset_secret_returns_404(app_module, monkeypatch):
    monkeypatch.delenv("CRON_SECRET", raising=False)
    with TestClient(app_module.app) as c:
        r = c.post("/internal/sweep-stale-runs", headers={"X-Cron-Secret": "any-secret"})
        assert r.status_code == 404


def test_sweep_stale_runs_empty_secret_returns_404(app_module, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "   ")
    with TestClient(app_module.app) as c:
        r = c.post("/internal/sweep-stale-runs", headers={"X-Cron-Secret": "any-secret"})
        assert r.status_code == 404


def test_sweep_stale_runs_missing_header_returns_401(app_module, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "correct-secret-123")
    with TestClient(app_module.app) as c:
        r = c.post("/internal/sweep-stale-runs")
        assert r.status_code == 401


def test_sweep_stale_runs_wrong_secret_returns_401(app_module, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "correct-secret-123")
    with TestClient(app_module.app) as c:
        r = c.post("/internal/sweep-stale-runs", headers={"X-Cron-Secret": "wrong-secret"})
        assert r.status_code == 401


def test_sweep_stale_runs_success_refunds_stuck_run(app_module, monkeypatch, db):
    from models import GenerationRun

    secret = "correct-secret-123"
    monkeypatch.setenv("CRON_SECRET", secret)

    set_credits("user_A", 1)
    run_id = credits.charge_for_run("user_A")
    assert get_credits("user_A") == 0

    # Age the run past the stale threshold (15 minutes)
    run = db.get(GenerationRun, run_id)
    run.created_at = datetime.datetime.utcnow() - datetime.timedelta(minutes=30)
    db.commit()

    with TestClient(app_module.app) as c:
        r = c.post("/internal/sweep-stale-runs", headers={"X-Cron-Secret": secret})
        assert r.status_code == 200
        assert r.json() == {"swept": 1}

    # Verify run was refunded and credit restored
    db.expire_all()
    run = db.get(GenerationRun, run_id)
    assert run.status == "abandoned"
    assert run.refunded is True
    assert get_credits("user_A") == 1


def test_sweep_stale_runs_non_ascii_secret_returns_401(app_module, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "correct-secret-123")
    with TestClient(app_module.app) as c:
        r = c.post("/internal/sweep-stale-runs", headers={"X-Cron-Secret": "h\u00e4mligt".encode("latin-1")})
        assert r.status_code == 401


def test_sweep_stale_runs_leaves_recent_runs_alone(app_module, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "correct-secret-123")
    set_credits("user_A", 1)
    credits.charge_for_run("user_A")
    with TestClient(app_module.app) as c:
        r = c.post("/internal/sweep-stale-runs", headers={"X-Cron-Secret": "correct-secret-123"})
        assert r.json() == {"swept": 0}
    assert get_credits("user_A") == 0
