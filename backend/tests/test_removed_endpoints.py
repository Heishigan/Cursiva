import importlib.util


def test_openai_key_oracle_removed(client):
    # /api/status used to validate any X-API-Key against OpenAI without auth.
    client.app.dependency_overrides.clear()
    r = client.get("/api/status", headers={"x-api-key": "sk-guess"})
    assert r.status_code in (404, 405)


def test_hardcoded_fernet_module_removed():
    assert importlib.util.find_spec("security") is None
