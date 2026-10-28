"""Initial migration

Revision ID: 6bcde8126f01
Revises: 
Create Date: 2026-07-19 11:55:51.543479

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6bcde8126f01'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# The tables below were first created by Base.metadata.create_all() in
# main.py, so this revision was generated empty. It is filled in so that an
# empty database (CI, a new machine) can be built from migrations alone.
# Databases that already ran this revision, such as production, never run it
# again, so this change does not touch them. The schema is the one the next
# revision (62ddd5fe166f) expects: models.py as of July 2026, including the
# BYOK column that revision drops and without the table it creates.


def upgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())

    if "user_profiles" not in existing:
        op.create_table(
            "user_profiles",
            sa.Column("clerk_id", sa.String(), nullable=False),
            sa.Column("cv_data_json", sa.Text(), nullable=True),
            sa.Column("credits", sa.Integer(), nullable=True),
            sa.Column("encrypted_api_key", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("clerk_id"),
        )
        op.create_index("ix_user_profiles_clerk_id", "user_profiles", ["clerk_id"])

    if "user_lessons" not in existing:
        op.create_table(
            "user_lessons",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("clerk_id", sa.String(), nullable=True),
            sa.Column("lesson", sa.Text(), nullable=False),
            sa.Column("scope", sa.JSON(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_user_lessons_id", "user_lessons", ["id"])
        op.create_index("ix_user_lessons_clerk_id", "user_lessons", ["clerk_id"])

    if "job_applications" not in existing:
        op.create_table(
            "job_applications",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("clerk_id", sa.String(), nullable=True),
            sa.Column("company_name", sa.String(), nullable=True),
            sa.Column("role_name", sa.String(), nullable=True),
            sa.Column("job_description", sa.Text(), nullable=True),
            sa.Column("cv_data_json", sa.Text(), nullable=True),
            sa.Column("cl_data_json", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_job_applications_id", "job_applications", ["id"])
        op.create_index("ix_job_applications_clerk_id", "job_applications", ["clerk_id"])


def downgrade() -> None:
    op.drop_table("job_applications")
    op.drop_table("user_lessons")
    op.drop_table("user_profiles")
