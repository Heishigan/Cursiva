from sqlalchemy import Column, String, Text, Integer, JSON, Boolean, Float
from database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"

    clerk_id = Column(String, primary_key=True, index=True)
    cv_data_json = Column(Text, nullable=True)
    credits = Column(Integer, default=1)
    strict_eligibility = Column(Boolean, default=True)
    cv_embedding_json = Column(Text, nullable=True)

class UsedTrialEmail(Base):
    __tablename__ = "used_trial_emails"

    email_hash = Column(String, primary_key=True, index=True)  # sha256 of email, no PII stored

class UserLesson(Base):
    __tablename__ = "user_lessons"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    clerk_id = Column(String, index=True)
    lesson = Column(Text, nullable=False)
    scope = Column(JSON, nullable=False)

import datetime
from sqlalchemy import DateTime

class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(String, primary_key=True, index=True)
    clerk_id = Column(String, index=True)
    company_name = Column(String)
    role_name = Column(String)
    job_description = Column(Text)
    cv_data_json = Column(Text)
    cl_data_json = Column(Text)
    status = Column(String, default="Applied")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SavedJob(Base):
    __tablename__ = "saved_jobs"

    id = Column(String, primary_key=True, index=True)
    clerk_id = Column(String, index=True)
    url = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    role_name = Column(String, nullable=True)
    job_description = Column(Text, nullable=True)
    embedding_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class GenerationRun(Base):
    """One paid /api/tailor run. Ties the credit charge to its outcome so a
    failed run can be refunded exactly once, and records per-run metrics."""
    __tablename__ = "generation_runs"

    id = Column(String, primary_key=True, index=True)
    clerk_id = Column(String, index=True, nullable=False)
    # running | success | failed_review | error | abandoned
    status = Column(String, nullable=False, default="running", index=True)
    refunded = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    finished_at = Column(DateTime, nullable=True)
    revision_count = Column(Integer, nullable=True)
    cap_hit = Column(Boolean, nullable=True)
    failure_reasons_json = Column(Text, nullable=True)  # list of reviewer feedback per failed attempt
    error = Column(Text, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    cost_usd = Column(Float, nullable=True)


class StripeEvent(Base):
    """Processed Stripe webhook events (idempotency)."""
    __tablename__ = "stripe_events"

    event_id = Column(String, primary_key=True)
    checkout_session_id = Column(String, nullable=True, unique=True)
    processed_at = Column(DateTime, default=datetime.datetime.utcnow)
