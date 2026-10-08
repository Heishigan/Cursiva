import json


def test_missing_embeddings_give_null_score(client, db):
    from models import SavedJob, UserProfile
    db.add(UserProfile(clerk_id="user_A", credits=0))
    db.add(SavedJob(id="j1", clerk_id="user_A", job_description="jd"))
    db.commit()
    (job,) = client.get("/api/jobs/matches").json()["data"]
    assert job["match_score"] is None


def test_real_similarity_score(client, db):
    from models import SavedJob, UserProfile
    db.add(UserProfile(clerk_id="user_A", credits=0, cv_embedding_json=json.dumps([1.0, 0.0])))
    db.add(SavedJob(id="j1", clerk_id="user_A", job_description="jd", embedding_json=json.dumps([1.0, 0.0])))
    db.commit()
    (job,) = client.get("/api/jobs/matches").json()["data"]
    assert job["match_score"] == 100
