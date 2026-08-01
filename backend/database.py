import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

if os.environ.get("ENV") == "production":
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if not db_url:
        print("WARNING: DATABASE_URL must be set in production. Falling back to SQLite.")
        db_url = "sqlite:///./cursiva.db"
    DATABASE_URL = db_url
    engine = create_engine(DATABASE_URL, poolclass=NullPool) if "postgres" in DATABASE_URL else create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    DATABASE_URL = "sqlite:///./cursiva.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
