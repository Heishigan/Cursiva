"""add stripe_events (webhook idempotency)

Revision ID: c8d2e3f4a5b6
Revises: b7c1d2e3f4a5
Create Date: 2026-10-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8d2e3f4a5b6"
down_revision: Union[str, None] = "b7c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("stripe_events"):
        return
    op.create_table(
        "stripe_events",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("checkout_session_id", sa.String(), nullable=True, unique=True),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("stripe_events")
