"""Structured error logs: one JSON line with severity, and never user text.

The fake CV text below deliberately avoids words like "CV" or "candidate":
real CV text doesn't announce itself, so redaction by keyword can't work.
"""
import io
import json
import logging

import pytest

import credits
import error_logging
from tests.conftest import set_credits

CV_SNIPPET = "Anna Lindqvist, Senior Backend Developer at Spotify, Stockholm 2019-2024"


@pytest.fixture()
def json_log():
    """Capture what the root logger writes, through the production formatter."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(error_logging.CloudLoggingJsonFormatter())
    root = logging.getLogger()
    root.addHandler(handler)

    def records():
        return [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]

    records.raw = stream.getvalue
    yield records
    root.removeHandler(handler)


def test_refund_failure_is_one_structured_error_without_user_text(app_module, monkeypatch, json_log):
    set_credits("user_A", 1)
    run_id = credits.charge_for_run("user_A")

    def boom():
        raise RuntimeError(f"database down while saving {CV_SNIPPET}")

    monkeypatch.setattr(credits, "SessionLocal", boom)
    assert credits.refund_run(run_id, "error", error=f"pipeline error: {CV_SNIPPET}") is False

    errors = [r for r in json_log() if "REFUND FAILED" in r["message"]]
    assert len(errors) == 1
    rec = errors[0]
    assert rec["severity"] == "ERROR"
    assert rec["exception_type"] == "RuntimeError"
    assert "credits.py" in rec["stack_trace"] and "RuntimeError" in rec["stack_trace"]
    assert "Spotify" not in json_log.raw() and "Lindqvist" not in json_log.raw()


def test_unhandled_500_is_one_structured_error_without_user_text(app_module, json_log):
    from fastapi.testclient import TestClient

    @app_module.app.get("/test-500-sync")
    def boom_sync():  # sync endpoints run in a worker thread
        raise ValueError(f"could not parse '{CV_SNIPPET}'")

    @app_module.app.get("/test-500-async")
    async def boom_async():
        raise KeyError(CV_SNIPPET)

    try:
        # raise_server_exceptions=True: the middleware must handle the error
        # itself rather than re-raise it to the server (which would print an
        # unstructured traceback including the message).
        with TestClient(app_module.app, raise_server_exceptions=True) as c:
            for path, exc_type in (("/test-500-sync", "ValueError"), ("/test-500-async", "KeyError")):
                r = c.get(path)
                assert r.status_code == 500
                assert r.json() == {"detail": "Internal Server Error"}
                errors = [x for x in json_log() if x["severity"] == "ERROR" and path in x["message"]]
                assert len(errors) == 1
                assert errors[0]["exception_type"] == exc_type
                assert "test_error_logging.py" in errors[0]["stack_trace"]
    finally:
        app_module.app.router.routes[:] = [
            rt for rt in app_module.app.router.routes if getattr(rt, "path", "") not in ("/test-500-sync", "/test-500-async")
        ]
    assert "Spotify" not in json_log.raw() and "Lindqvist" not in json_log.raw()


def test_http_errors_are_not_logged_as_server_errors(client, json_log):
    r = client.post("/internal/sweep-stale-runs")  # 404 when CRON_SECRET is unset
    assert r.status_code in (401, 404)
    assert not [x for x in json_log() if x["severity"] == "ERROR"]


def test_chained_exceptions_keep_types_and_drop_every_message(json_log):
    log = logging.getLogger("tests.chain")
    try:
        try:
            raise ValueError(CV_SNIPPET)
        except ValueError as inner:
            raise RuntimeError(f"wrapped: {CV_SNIPPET}") from inner
    except RuntimeError:
        log.exception("Tailor run %s failed", "run-1")

    rec = json_log()[-1]
    assert rec["severity"] == "ERROR" and rec["message"] == "Tailor run run-1 failed"
    assert "ValueError" in rec["stack_trace"] and "RuntimeError" in rec["stack_trace"]
    assert "Spotify" not in json_log.raw()


def test_exception_passed_as_argument_is_logged_as_its_type(json_log):
    try:
        raise ValueError(CV_SNIPPET)
    except ValueError as e:
        logging.getLogger("tests.args").warning("PDF parse error for user %s: %s", "user_A", e)

    rec = json_log()[-1]
    assert rec == {"severity": "WARNING", "message": "PDF parse error for user user_A: ValueError", "logger": "tests.args"}


def test_info_logs_are_json_with_their_severity(json_log):
    logging.getLogger("tests.info").info("Refunded run %s (%s)", "run-1", "error")
    assert json_log()[-1] == {"severity": "INFO", "message": "Refunded run run-1 (error)", "logger": "tests.info"}
