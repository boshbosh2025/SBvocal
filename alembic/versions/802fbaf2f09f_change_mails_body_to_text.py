"""change mails body to text

Revision ID: 802fbaf2f09f
Revises: f0bb0cda4154
Create Date: 2026-08-03 00:20:16.096427

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '802fbaf2f09f'
down_revision: Union[str, Sequence[str], None] = 'f0bb0cda4154'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column("mails", "body", existing_type=sa.String(length=1000), type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("mails", "body", existing_type=sa.Text(), type_=sa.String(length=1000), existing_nullable=True)
