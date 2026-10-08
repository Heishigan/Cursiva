"""add generation_runs (credit charge/refund ledger + run metrics)

Revision ID: b7c1d2e3f4a5
Revises: a5349cd4b39d
Create Date: 2026-10-07

Idempotent: main.py still calls Base.metadata.create_all at startup, so the
table may already exist when this runs.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7c1d2e3f4a5"
down_revision: Union[str, None] = "a5349cd4b39d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("generation_runs"):
        return
    op.create_table(
        "generation_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("clerk_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="running"),
        sa.Column("refunded", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("revision_count", sa.Integer(), nullable=True),
        sa.Column("cap_hit", sa.Boolean(), nullable=True),
        sa.Column("failure_reasons_json", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("cost_usd", sa.Float(), nullable=True),
    )
    op.create_index("ix_generation_runs_id", "generation_runs", ["id"])
    op.create_index("ix_generation_runs_clerk_id", "generation_runs", ["clerk_id"])
    op.create_index("ix_generation_runs_status", "generation_runs", ["status"])
    op.create_index("ix_generation_runs_created_at", "generation_runs", ["created_at"])


def downgrade() -> None:
    op.drop_table("generation_runs")
