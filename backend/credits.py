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
from sqlalchemy.exc import IntegrityError

from database import SessionLocal

logger = logging.getLogger(__name__)

STALE_RUN_MINUTES = 15
FREE_REDOS_PER_APPLICATION = 1  # enforced by a unique index; raising it needs a schema change
REDO_WINDOW_HOURS = 24


class InsufficientCredits(Exception):
    pass


def _now():
    return datetime.datetime.utcnow()


def charge_for_run(user_id: str, jd_hash: str | None = None, parent_run_id: str | None = None) -> str:
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
            text("INSERT INTO generation_runs (id, clerk_id, status, refunded, created_at, free, jd_hash, parent_run_id) "
                 "VALUES (:id, :uid, 'running', :f, :now, :f, :jd, :parent)"),
            {"id": run_id, "uid": user_id, "f": False, "now": _now(), "jd": jd_hash, "parent": parent_run_id},
        )
        db.commit()
    return run_id


def resolve_redo_root(user_id: str, redo_of: str | None, jd_hash: str) -> str | None:
    """The original paid run a redo belongs to, or None if the redo isn't valid.

    Valid means: the user's own run (or a redo of it), successful, for the same
    job ad, and started within the redo window.
    """
    if not redo_of:
        return None
    with SessionLocal() as db:
        row = db.execute(text("SELECT id, clerk_id, parent_run_id FROM generation_runs WHERE id = :id"),
                         {"id": redo_of}).first()
        if not row or row.clerk_id != user_id:
            return None
        root_id = row.parent_run_id or row.id
        root = db.execute(text("SELECT clerk_id, status, jd_hash, created_at FROM generation_runs WHERE id = :id"),
                          {"id": root_id}).first()
    if not root or root.clerk_id != user_id or root.status != "success" or not root.jd_hash or root.jd_hash != jd_hash:
        return None
    created = root.created_at
    if isinstance(created, str):
        created = datetime.datetime.fromisoformat(created)
    if created < _now() - datetime.timedelta(hours=REDO_WINDOW_HOURS):
        return None
    return root_id


def free_redo_available(root_id: str | None) -> bool:
    if not root_id:
        return False
    with SessionLocal() as db:
        used = db.execute(
            text("SELECT COUNT(*) FROM generation_runs WHERE parent_run_id = :root AND free = :t AND refunded = :f"),
            {"root": root_id, "t": True, "f": False},
        ).scalar()
    return (used or 0) < FREE_REDOS_PER_APPLICATION


def open_free_redo(user_id: str, root_id: str, jd_hash: str) -> str | None:
    """Open a free redo run for an application, or None if its free redo is used."""
    if not free_redo_available(root_id):
        return None
    run_id = str(uuid.uuid4())
    try:
        with SessionLocal() as db:
            db.execute(
                text("INSERT INTO generation_runs (id, clerk_id, status, refunded, created_at, free, jd_hash, parent_run_id) "
                     "VALUES (:id, :uid, 'running', :f, :now, :t, :jd, :root)"),
                {"id": run_id, "uid": user_id, "f": False, "t": True, "now": _now(), "jd": jd_hash, "root": root_id},
            )
            db.commit()
    except IntegrityError:
        return None  # another request took the free redo first
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
            run = db.execute(text("SELECT clerk_id, free FROM generation_runs WHERE id = :id"), {"id": run_id}).first()
            # A free redo took no credit, so none is given back; closing it as
            # refunded makes the free redo available again.
            if not run.free:
                db.execute(text("UPDATE user_profiles SET credits = credits + 1 WHERE clerk_id = :uid"), {"uid": run.clerk_id})
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
