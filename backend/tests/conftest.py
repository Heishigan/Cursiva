"""Shared fixtures. No network, no real LLM, no production config.

Each test session runs in a fresh temp directory with its own SQLite file,
and LLM-calling functions are replaced with fakes by the tests that need them.
"""
import os
import sys
import tempfile

import pytest

_TMP = tempfile.mkdtemp(prefix="cursiva-tests-")
os.chdir(_TMP)
os.environ.pop("ENV", None)
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-real")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test_local")
os.environ.setdefault("CLERK_ISSUER", "https://clerk.test.invalid")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture()
def app_module():
    import main
    from database import Base, engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    main.app.dependency_overrides.clear()
    try:
        main.limiter.reset()
    except Exception:
        pass
    yield main
    main.app.dependency_overrides.clear()


@pytest.fixture()
def client(app_module):
    from fastapi.testclient import TestClient
    app_module.app.dependency_overrides[app_module.get_current_user_id] = lambda: "user_A"
    with TestClient(app_module.app) as c:
        yield c


@pytest.fixture()
def db():
    from database import SessionLocal
    s = SessionLocal()
    yield s
    s.close()


def set_credits(user_id: str, credits: int):
    from database import SessionLocal
    from models import UserProfile
    s = SessionLocal()
    s.merge(UserProfile(clerk_id=user_id, credits=credits))
    s.commit()
    s.close()


def get_credits(user_id: str) -> int:
    from database import SessionLocal
    from models import UserProfile
    s = SessionLocal()
    p = s.get(UserProfile, user_id)
    s.close()
    return None if p is None else p.credits
