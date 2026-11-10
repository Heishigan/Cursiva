"""Bad input is refused with a clear 4xx instead of being stored or crashing."""
import json

APP = {"company_name": "Example AB", "role_name": "Engineer", "job_description": "A job.",
       "cv_data_json": "{}", "cl_data_json": "{}"}


def test_profile_cv_must_be_a_json_object(client):
    assert client.post("/api/user/profile", json={"cv_data_json": "not json"}).status_code == 422
    assert client.post("/api/user/profile", json={"cv_data_json": "[1, 2]"}).status_code == 422
    # The profile still loads afterwards: nothing unreadable was stored.
    assert client.get("/api/user/profile").status_code == 200


def test_profile_cv_can_still_be_saved_and_cleared(client, monkeypatch):
    cv = json.dumps({"professional_summary": "x", "sections": []})
    assert client.post("/api/user/profile", json={"cv_data_json": cv}).status_code == 200
    assert client.get("/api/user/profile").json()["data"]["cv_data"]["professional_summary"] == "x"
    assert client.post("/api/user/profile", json={"cv_data_json": ""}).status_code == 200
    assert client.get("/api/user/profile").json()["data"]["has_baseline"] is False


def test_oversized_application_is_refused(client):
    assert client.post("/api/applications", json={**APP, "job_description": "x" * 50_001}).status_code == 422
    assert client.post("/api/applications", json={**APP, "company_name": "x" * 301}).status_code == 422
    assert client.post("/api/applications", json=APP).status_code == 200


def test_a_bad_application_date_is_a_422_not_a_crash(client):
    app_id = client.post("/api/applications", json=APP).json()["id"]
    assert client.put(f"/api/applications/{app_id}", json={"created_at": "yesterday"}).status_code == 422
    assert client.put(f"/api/applications/{app_id}", json={"created_at": "2026-11-01T10:00:00Z"}).status_code == 200


def test_letter_paragraphs_must_be_text(client):
    body = {"personal_info": {"name": "A"}, "company_name": "Example AB", "cover_letter_paragraphs": [{"a": 1}]}
    assert client.post("/api/compile_cl", json=body).status_code == 422
