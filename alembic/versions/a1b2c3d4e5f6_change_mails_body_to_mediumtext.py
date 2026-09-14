"""change mails body to mediumtext

Revision ID: a1b2c3d4e5f6
Revises: 802fbaf2f09f
Create Date: 2026-08-03 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '802fbaf2f09f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column("mails", "body", existing_type=sa.Text(), type_=sa.Text(length=16777215), existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("mails", "body", existing_type=sa.Text(length=16777215), type_=sa.Text(), existing_nullable=True)
