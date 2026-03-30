"""landlord_documents table (R2 file metadata, org-scoped).

Revision ID: 049_landlord_documents
Revises: 048_landlord_notes
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "049_landlord_documents"
down_revision: Union[str, None] = "048_landlord_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _organization_id_column_sa_type(conn) -> sa.types.TypeEngine:
    r = conn.execute(
        text(
            """
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'organization'
              AND column_name = 'id'
            """
        )
    ).scalar()
    if not r:
        return sa.String()
    dtl = str(r).lower()
    if "uuid" in dtl:
        return sa.UUID()
    return sa.String()


def upgrade() -> None:
    conn = op.get_bind()
    org_id_type = _organization_id_column_sa_type(conn)
    op.create_table(
        "landlord_documents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("organization_id", org_id_type, nullable=False),
        sa.Column("landlord_id", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("file_url", sa.String(), nullable=False, server_default=""),
        sa.Column("object_key", sa.String(length=1024), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("uploaded_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organization.id"]),
        sa.ForeignKeyConstraint(["landlord_id"], ["landlords.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
    )
    op.create_index("ix_landlord_documents_organization_id", "landlord_documents", ["organization_id"])
    op.create_index("ix_landlord_documents_landlord_id", "landlord_documents", ["landlord_id"])
    op.create_index("ix_landlord_documents_uploaded_by", "landlord_documents", ["uploaded_by"])

    conn.execute(text("ALTER TABLE landlord_documents ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("DROP POLICY IF EXISTS org_isolation_landlord_documents ON landlord_documents"))
    conn.execute(
        text(
            """
            CREATE POLICY org_isolation_landlord_documents ON landlord_documents FOR ALL
            USING (organization_id::text = current_setting('app.current_organization_id', true))
            WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true))
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DROP POLICY IF EXISTS org_isolation_landlord_documents ON landlord_documents"))
    conn.execute(text("ALTER TABLE landlord_documents DISABLE ROW LEVEL SECURITY"))

    op.drop_index("ix_landlord_documents_uploaded_by", table_name="landlord_documents")
    op.drop_index("ix_landlord_documents_landlord_id", table_name="landlord_documents")
    op.drop_index("ix_landlord_documents_organization_id", table_name="landlord_documents")
    op.drop_table("landlord_documents")
