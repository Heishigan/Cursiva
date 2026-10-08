def test_app_imports_and_root(client):
    r = client.get("/")
    assert r.status_code == 200
