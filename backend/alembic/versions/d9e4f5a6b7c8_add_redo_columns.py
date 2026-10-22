"""generation_runs: redo bookkeeping (parent_run_id, free, jd_hash)

One feedback redo per application is free. A redo run points at the
original paid run; the partial unique index allows one live free redo each.

Revision ID: d9e4f5a6b7c8
Revises: c8d2e3f4a5b6
Create Date: 2026-10-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d9e4f5a6b7c8"
down_revision: Union[str, None] = "c8d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEX = "uq_generation_runs_one_free_redo"


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("generation_runs")}
    if "parent_run_id" not in cols:
        op.add_column("generation_runs", sa.Column("parent_run_id", sa.String(), nullable=True))
        op.create_index("ix_generation_runs_parent_run_id", "generation_runs", ["parent_run_id"])
    if "free" not in cols:
        op.add_column("generation_runs", sa.Column("free", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "jd_hash" not in cols:
        op.add_column("generation_runs", sa.Column("jd_hash", sa.String(), nullable=True))
    if INDEX not in {i["name"] for i in insp.get_indexes("generation_runs")}:
        op.create_index(INDEX, "generation_runs", ["parent_run_id"], unique=True,
                        postgresql_where=sa.text("free = true AND refunded = false"),
                        sqlite_where=sa.text("free = 1 AND refunded = 0"))


def downgrade() -> None:
    op.drop_index(INDEX, table_name="generation_runs")
    op.drop_index("ix_generation_runs_parent_run_id", table_name="generation_runs")
    op.drop_column("generation_runs", "jd_hash")
    op.drop_column("generation_runs", "free")
    op.drop_column("generation_runs", "parent_run_id")
