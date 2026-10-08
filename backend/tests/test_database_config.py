import pytest

from database import _resolve_database_url


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)


def test_production_without_database_url_fails_closed(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    with pytest.raises(RuntimeError):
        _resolve_database_url()


def test_production_rejects_sqlite(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./x.db")
    with pytest.raises(RuntimeError):
        _resolve_database_url()


def test_postgres_scheme_normalised(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@h/db")
    assert _resolve_database_url().startswith("postgresql://")


def test_dev_defaults_to_local_sqlite():
    assert _resolve_database_url() == "sqlite:///./cursiva.db"
