import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool


def _resolve_database_url() -> str:
    """Return the database URL.

    Production must have DATABASE_URL set: silently falling back to SQLite on
    Cloud Run's ephemeral disk would store payments and CVs in a file that is
    lost on the next instance restart. Outside production, DATABASE_URL is
    honoured if set (tests use it) and otherwise defaults to local SQLite.
    """
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if os.environ.get("ENV") == "production":
        if not db_url:
            raise RuntimeError("DATABASE_URL must be set when ENV=production")
        if db_url.startswith("sqlite"):
            raise RuntimeError("SQLite is not allowed when ENV=production")
        return db_url
    return db_url or "sqlite:///./cursiva.db"


DATABASE_URL = _resolve_database_url()
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, poolclass=NullPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
