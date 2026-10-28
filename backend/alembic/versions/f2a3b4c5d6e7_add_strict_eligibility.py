"""user_profiles.strict_eligibility: record the column in the migration history

The column was added to models.py in July 2026 without a migration, so
existing databases (production) already have it and this revision does
nothing there. It only adds the column to a database built from migrations
alone, such as the empty one CI builds.

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-10-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("user_profiles")}
    if "strict_eligibility" not in cols:
        op.add_column("user_profiles", sa.Column("strict_eligibility", sa.Boolean(), nullable=True))


def downgrade() -> None:
    # Deliberately empty: on existing databases the column predates this
    # revision, so dropping it here would lose data that was never ours to add.
    pass
