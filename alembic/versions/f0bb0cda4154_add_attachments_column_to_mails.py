"""add attachments column to mails

Revision ID: f0bb0cda4154
Revises: 29fae98abdcc
Create Date: 2026-08-03 00:12:09.265253

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0bb0cda4154'
down_revision: Union[str, Sequence[str], None] = '29fae98abdcc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("mails", sa.Column("attachments", sa.String(length=1000), nullable=False, server_default=""))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("mails", "attachments")
