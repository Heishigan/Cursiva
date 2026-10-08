import pytest

import trial
from tests.conftest import get_credits


@pytest.fixture()
def clerk(monkeypatch):
    """Fake Clerk Backend API: maps user_id -> (email, verified)."""
    users = {}

    def fake(user_id):
        u = users.get(user_id)
        if not u:
            return None
        email, verified = u
        return email if verified else None

    monkeypatch.setattr(trial, "fetch_verified_primary_email", fake)
    return users


def _create(client, app_module, user_id, body=None):
    app_module.app.dependency_overrides[app_module.get_current_user_id] = lambda: user_id
    return client.post("/api/user/profile", json=body or {"strict_eligibility": True})


def test_first_account_gets_trial(client, app_module, clerk):
    clerk["user_1"] = ("Alice@Example.com", True)
    assert _create(client, app_module, "user_1").status_code == 200
    assert get_credits("user_1") == 1


def test_client_supplied_email_is_ignored(client, app_module, clerk):
    """The old bypass: omit or invent the email in the body."""
    clerk["user_1"] = ("alice@example.com", True)
    clerk["user_2"] = ("alice@example.com", True)  # same verified inbox, new account
    _create(client, app_module, "user_1")
    _create(client, app_module, "user_2", {"email": "random-new@example.com"})
    assert get_credits("user_2") == 0


def test_delete_and_recreate_gets_no_second_trial(client, app_module, clerk):
    clerk["user_1"] = ("bob@example.com", True)
    _create(client, app_module, "user_1")
    # Clerk user.deleted removes the profile but keeps the email hash.
    from database import SessionLocal
    from models import UserProfile
    with SessionLocal() as s:
        s.query(UserProfile).filter_by(clerk_id="user_1").delete()
        s.commit()
    clerk["user_1b"] = ("bob@example.com", True)
    _create(client, app_module, "user_1b")
    assert get_credits("user_1b") == 0


@pytest.mark.parametrize("alias", ["b.o.b@gmail.com", "bob+cursiva@gmail.com", "BOB@googlemail.com"])
def test_gmail_aliases_count_as_one(client, app_module, clerk, alias):
    clerk["user_1"] = ("bob@gmail.com", True)
    clerk["user_2"] = (alias, True)
    _create(client, app_module, "user_1")
    _create(client, app_module, "user_2")
    assert get_credits("user_2") == 0


def test_unverified_or_lookup_failure_gets_no_trial(client, app_module, clerk):
    clerk["user_1"] = ("x@example.com", False)
    _create(client, app_module, "user_1")
    assert get_credits("user_1") == 0
    _create(client, app_module, "user_unknown")
    assert get_credits("user_unknown") == 0


def test_legacy_hash_still_blocks(client, app_module, clerk):
    import hashlib
    from database import SessionLocal
    from models import UsedTrialEmail
    with SessionLocal() as s:
        s.add(UsedTrialEmail(email_hash=hashlib.sha256(b"carol.smith+x@gmail.com").hexdigest()))
        s.commit()
    clerk["user_1"] = ("Carol.Smith+x@gmail.com", True)
    _create(client, app_module, "user_1")
    assert get_credits("user_1") == 0


def test_fetch_verified_primary_email_parses_clerk_payload(monkeypatch):
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_fake")

    class R:
        def raise_for_status(self):
            pass

        def json(self):
            return {"primary_email_address_id": "e2", "email_addresses": [
                {"id": "e1", "email_address": "old@example.com", "verification": {"status": "verified"}},
                {"id": "e2", "email_address": "main@example.com", "verification": {"status": "verified"}}]}

    monkeypatch.setattr(trial.requests, "get", lambda *a, **k: R())
    assert trial.fetch_verified_primary_email("user_1") == "main@example.com"
