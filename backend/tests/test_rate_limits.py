import pytest


def _as(app_module, user_id):
    from fastapi import Request

    def dep(request: Request):
        request.state.user_id = user_id
        return user_id
    app_module.app.dependency_overrides[app_module.get_current_user_id] = dep


def test_limits_are_per_user_not_per_ip(client, app_module, monkeypatch):
    monkeypatch.setattr(app_module, "extract_lesson", lambda *a, **k: None)
    _as(app_module, "user_A")
    codes = [client.post("/api/feedback", json={"user_feedback": "x"}).status_code for _ in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429
    # Same IP (TestClient), different user: own bucket.
    _as(app_module, "user_B")
    assert client.post("/api/feedback", json={"user_feedback": "x"}).status_code == 200


def test_rate_limit_key_prefers_verified_user(app_module):
    from starlette.requests import Request
    req = Request({"type": "http", "headers": [], "client": ("10.0.0.1", 1)})
    assert app_module.rate_limit_key(req) == "ip:10.0.0.1"
    req.state.user_id = "user_Z"
    assert app_module.rate_limit_key(req) == "user:user_Z"


def test_auth_dependency_sets_request_state(monkeypatch):
    import auth
    from starlette.requests import Request
    monkeypatch.setattr(auth.jwt, "decode", lambda *a, **k: {"iss": auth.TRUSTED_ISSUERS[0], "sub": "user_S"})

    class C:
        def get_signing_key_from_jwt(self, t):
            class K:
                key = None
            return K()
    monkeypatch.setitem(auth._jwks_clients, auth.TRUSTED_ISSUERS[0], C())
    req = Request({"type": "http", "headers": []})
    assert auth.get_current_user_id("Bearer x", req) == "user_S"
    assert req.state.user_id == "user_S"


@pytest.mark.parametrize("path,limit", [("/api/compile_cv", 20), ("/api/compile_cl", 20), ("/api/user/profile", 20)])
def test_previously_unlimited_endpoints_are_limited(client, app_module, path, limit):
    _as(app_module, "user_C")
    # Invalid bodies are rejected with 422 before the endpoint runs, so use the
    # limiter directly against the registered limits instead of hitting LaTeX.
    route = next(r for r in app_module.app.routes if getattr(r, "path", None) == path and "POST" in r.methods)
    limits = app_module.limiter._route_limits.get(f"{route.endpoint.__module__}.{route.endpoint.__name__}")
    assert limits, f"{path} has no rate limit"
