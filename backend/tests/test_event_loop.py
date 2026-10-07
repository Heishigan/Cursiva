import socket
import threading
import time

import httpx
import uvicorn

from tests.conftest import set_credits


class _SlowGraph:
    def stream(self, state, config=None):
        time.sleep(2.0)  # stands in for a blocking GPT-4o call
        yield {"tailor": {"revision_count": 1, "tailored_cv": {}}}
        yield {"reviewer": {"review_feedback": "PASS"}}
        yield {"cover_letter": {"cover_letter_parts": {}}}


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def test_generation_does_not_block_other_requests(app_module, monkeypatch):
    app_module.app.dependency_overrides[app_module.get_current_user_id] = lambda: "user_A"
    monkeypatch.setattr(app_module, "tailor_app", _SlowGraph())
    set_credits("user_A", 5)
    port = _free_port()
    server = uvicorn.Server(uvicorn.Config(app_module.app, host="127.0.0.1", port=port, log_level="critical"))
    threading.Thread(target=server.run, daemon=True).start()
    for _ in range(50):
        if server.started:
            break
        time.sleep(0.1)
    body = {"job_description": "jd", "generic_cv_raw": "{}", "company_name": "c", "role_name": "r",
            "strategy_plan": "s", "thread_id": "t"}
    t = threading.Thread(target=lambda: httpx.post(f"http://127.0.0.1:{port}/api/tailor", json=body, timeout=30).read())
    try:
        t.start()
        time.sleep(0.5)
        t0 = time.time()
        assert httpx.get(f"http://127.0.0.1:{port}/", timeout=30).status_code == 200
        assert time.time() - t0 < 0.5, "event loop was blocked by the generation"
        t.join()
    finally:
        server.should_exit = True
