import base64
import datetime
import json

from svix.webhooks import Webhook

SECRET = "whsec_" + base64.b64encode(b"0123456789abcdef0123456789abcdef").decode()


def _send(client, payload, monkeypatch):
    monkeypatch.setenv("CLERK_WEBHOOK_SECRET", SECRET)
    body = json.dumps(payload)
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    sig = Webhook(SECRET).sign("msg_1", now, body)
    return client.post("/api/clerk/webhook", content=body, headers={
        "svix-id": "msg_1", "svix-timestamp": str(int(now.timestamp())), "svix-signature": sig})


def test_user_deleted_removes_all_personal_rows(client, db, monkeypatch):
    from models import JobApplication, SavedJob, UserLesson, UserProfile, UsedTrialEmail
    db.add_all([UserProfile(clerk_id="user_D", credits=1),
                UserLesson(clerk_id="user_D", lesson="l", scope=["CV"]),
                JobApplication(id="a1", clerk_id="user_D"),
                SavedJob(id="s1", clerk_id="user_D", job_description="jd"),
                SavedJob(id="s2", clerk_id="user_OTHER", job_description="jd"),
                UsedTrialEmail(email_hash="h")])
    db.commit()
    assert _send(client, {"type": "user.deleted", "data": {"id": "user_D"}}, monkeypatch).status_code == 200
    db.expire_all()
    for model in (UserProfile, UserLesson, JobApplication, SavedJob):
        assert db.query(model).filter(model.clerk_id == "user_D").count() == 0
    assert db.query(SavedJob).filter(SavedJob.clerk_id == "user_OTHER").count() == 1
    assert db.query(UsedTrialEmail).count() == 1  # kept on purpose: blocks trial re-use


def test_bad_signature_rejected(client, monkeypatch):
    monkeypatch.setenv("CLERK_WEBHOOK_SECRET", SECRET)
    r = client.post("/api/clerk/webhook", content="{}", headers={"svix-id": "m", "svix-timestamp": "1", "svix-signature": "v1,bad"})
    assert r.status_code == 400
