"""user_profiles.cv_template: the CV and cover letter design chosen in Settings

NULL means the default (classic), so existing users keep what they had.

Revision ID: e1f2a3b4c5d6
Revises: d9e4f5a6b7c8
Create Date: 2026-10-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d9e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("user_profiles")}
    if "cv_template" not in cols:
        op.add_column("user_profiles", sa.Column("cv_template", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_profiles", "cv_template")
