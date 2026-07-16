import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

if os.environ.get("ENV") == "production":
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    DATABASE_URL = db_url or "sqlite:///./cursiva.db"
else:
    DATABASE_URL = "sqlite:///./cursiva.db"

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
