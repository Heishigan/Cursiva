"""add cv_embedding_json

Revision ID: a5349cd4b39d
Revises: 62ddd5fe166f
Create Date: 2026-07-28 10:35:13.567734

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5349cd4b39d'
down_revision: Union[str, None] = '62ddd5fe166f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.engine.name == 'postgresql':
        op.execute("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cv_embedding_json TEXT;")
        op.execute("""
            CREATE TABLE IF NOT EXISTS saved_jobs (
                id VARCHAR NOT NULL,
                clerk_id VARCHAR,
                url VARCHAR,
                company_name VARCHAR,
                role_name VARCHAR,
                job_description TEXT,
                embedding_json TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE,
                PRIMARY KEY (id)
            );
        """)
        op.execute("CREATE INDEX IF NOT EXISTS ix_saved_jobs_clerk_id ON saved_jobs (clerk_id);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_saved_jobs_id ON saved_jobs (id);")


def downgrade() -> None:
    pass
