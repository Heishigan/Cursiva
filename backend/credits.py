"""Credit accounting for paid generations.

A run is charged and recorded in one transaction. Every non-success outcome
(exception, failed review, client disconnect, stuck run) goes through
``refund_run``, which is atomic and idempotent: the guarded UPDATE on
``generation_runs.refunded`` lets at most one caller credit the user back.
"""
import datetime
import json
import logging
import uuid

from sqlalchemy import text

from database import SessionLocal

logger = logging.getLogger(__name__)

STALE_RUN_MINUTES = 15


class InsufficientCredits(Exception):
    pass


def _now():
    return datetime.datetime.utcnow()


def charge_for_run(user_id: str) -> str:
    """Atomically take one credit and open a run. Raises InsufficientCredits."""
    run_id = str(uuid.uuid4())
    with SessionLocal() as db:
        res = db.execute(
            text("UPDATE user_profiles SET credits = credits - 1 WHERE clerk_id = :uid AND credits >= 1"),
            {"uid": user_id},
        )
        if res.rowcount != 1:
            db.rollback()
            raise InsufficientCredits()
        db.execute(
            text("INSERT INTO generation_runs (id, clerk_id, status, refunded, created_at) "
                 "VALUES (:id, :uid, 'running', :f, :now)"),
            {"id": run_id, "uid": user_id, "f": False, "now": _now()},
        )
        db.commit()
    return run_id


def _metrics_params(metrics: dict | None) -> dict:
    m = metrics or {}
    reasons = m.get("failure_reasons")
    return {
        "rc": m.get("revision_count"),
        "cap": m.get("cap_hit"),
        "fr": json.dumps(reasons) if reasons is not None else None,
        "pt": m.get("prompt_tokens"),
        "ct": m.get("completion_tokens"),
        "cost": m.get("cost_usd"),
    }


_METRICS_SET = ("revision_count = COALESCE(:rc, revision_count), cap_hit = COALESCE(:cap, cap_hit), "
                "failure_reasons_json = COALESCE(:fr, failure_reasons_json), "
                "prompt_tokens = COALESCE(:pt, prompt_tokens), completion_tokens = COALESCE(:ct, completion_tokens), "
                "cost_usd = COALESCE(:cost, cost_usd)")


def mark_success(run_id: str, metrics: dict | None = None) -> bool:
    """Close a running run as success. Returns False if it was already closed."""
    with SessionLocal() as db:
        res = db.execute(
            text(f"UPDATE generation_runs SET status = 'success', finished_at = :now, {_METRICS_SET} "
                 "WHERE id = :id AND status = 'running' AND refunded = :f"),
            {"id": run_id, "now": _now(), "f": False, **_metrics_params(metrics)},
        )
        db.commit()
        return res.rowcount == 1


def refund_run(run_id: str, status: str, error: str | None = None, metrics: dict | None = None) -> bool:
    """Close a run as failed and give the credit back, at most once.

    Returns True if this call performed the refund. Never raises: a refund
    failure is logged loudly and the stale-run sweep retries it later.
    """
    try:
        with SessionLocal() as db:
            res = db.execute(
                text(f"UPDATE generation_runs SET status = :st, refunded = :t, finished_at = :now, "
                     f"error = COALESCE(:err, error), {_METRICS_SET} "
                     "WHERE id = :id AND refunded = :f AND status <> 'success'"),
                {"id": run_id, "st": status, "t": True, "f": False, "now": _now(),
                 "err": (error or None) and error[:2000], **_metrics_params(metrics)},
            )
            if res.rowcount != 1:
                db.rollback()
                return False
            owner = db.execute(text("SELECT clerk_id FROM generation_runs WHERE id = :id"), {"id": run_id}).scalar()
            db.execute(text("UPDATE user_profiles SET credits = credits + 1 WHERE clerk_id = :uid"), {"uid": owner})
            db.commit()
            logger.info("Refunded run %s (%s)", run_id, status)
            return True
    except Exception:
        logger.exception("REFUND FAILED for run %s; the stale-run sweep will retry", run_id)
        return False


def sweep_stale_runs(max_age_minutes: int = STALE_RUN_MINUTES) -> int:
    """Refund runs stuck in 'running' (e.g. the instance died mid-stream)."""
    cutoff = _now() - datetime.timedelta(minutes=max_age_minutes)
    try:
        with SessionLocal() as db:
            ids = [r[0] for r in db.execute(
                text("SELECT id FROM generation_runs WHERE status = 'running' AND refunded = :f AND created_at < :cut"),
                {"f": False, "cut": cutoff},
            )]
    except Exception:
        logger.exception("Stale-run sweep failed")
        return 0
    return sum(refund_run(i, "abandoned", "no outcome recorded within time limit") for i in ids)
