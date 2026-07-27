from sqlalchemy import Column, String, Text, Integer, JSON, Boolean
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
