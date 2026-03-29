"""RLS: listings, listing_images, listing_amenities, inquiries, password_reset_tokens.

Revision ID: 045_rls_listings_inquiries_password_reset
Revises: 044_rls_tokens_credentials

- listings / children: tenant isolation via unit.organization_id; published rows also
  readable without org GUC (public marketing API).
- inquiries: organization_id column + backfill; policies for org admin, anonymous intake,
  and trusted app.current_inquiry_id (background email task).
- password_reset_tokens: EXISTS(users org match) OR app.current_password_reset_token_hash
  (mirrors refresh_tokens); FORCE ROW LEVEL SECURITY.

Fail-closed when app.current_organization_id is unset except documented public/trusted paths.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "045_rls_listings_inquiries_password_reset"
down_revision: Union[str, None] = "044_rls_tokens_credentials"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # --- inquiries.organization_id (denormalized tenant boundary + RLS) ---
    conn.execute(
        text(
            """
            ALTER TABLE inquiries
            ADD COLUMN IF NOT EXISTS organization_id VARCHAR
            """
        )
    )
    conn.execute(
        text(
            """
            UPDATE inquiries i
            SET organization_id = u.organization_id
            FROM listings l
            INNER JOIN unit u ON u.id = l.unit_id
            WHERE i.apartment_id = l.id
              AND i.organization_id IS NULL
            """
        )
    )
    conn.execute(
        text(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'inquiries_organization_id_fkey'
              ) THEN
                ALTER TABLE inquiries
                ADD CONSTRAINT inquiries_organization_id_fkey
                FOREIGN KEY (organization_id) REFERENCES organization(id);
              END IF;
            END
            $$;
            """
        )
    )
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_inquiries_organization_id ON inquiries (organization_id)"
        )
    )

    # --- listings ---
    conn.execute(text("DROP POLICY IF EXISTS listings_org_or_published ON listings"))
    conn.execute(text("ALTER TABLE listings ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE listings FORCE ROW LEVEL SECURITY"))
    conn.execute(
        text(
            """
            CREATE POLICY listings_org_or_published ON listings FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM unit u
                    WHERE u.id = listings.unit_id
                    AND u.organization_id::text = current_setting('app.current_organization_id', true)
                )
                OR (
                    listings.is_published = true
                    AND EXISTS (SELECT 1 FROM unit u WHERE u.id = listings.unit_id)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM unit u
                    WHERE u.id = listings.unit_id
                    AND u.organization_id::text = current_setting('app.current_organization_id', true)
                )
            )
            """
        )
    )

    # --- listing_images ---
    conn.execute(text("DROP POLICY IF EXISTS listing_images_org_or_published ON listing_images"))
    conn.execute(text("ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE listing_images FORCE ROW LEVEL SECURITY"))
    conn.execute(
        text(
            """
            CREATE POLICY listing_images_org_or_published ON listing_images FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM listings l
                    INNER JOIN unit u ON u.id = l.unit_id
                    WHERE l.id = listing_images.listing_id
                    AND (
                        u.organization_id::text = current_setting('app.current_organization_id', true)
                        OR (l.is_published = true)
                    )
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM listings l
                    INNER JOIN unit u ON u.id = l.unit_id
                    WHERE l.id = listing_images.listing_id
                    AND u.organization_id::text = current_setting('app.current_organization_id', true)
                )
            )
            """
        )
    )

    # --- listing_amenities ---
    conn.execute(text("DROP POLICY IF EXISTS listing_amenities_org_or_published ON listing_amenities"))
    conn.execute(text("ALTER TABLE listing_amenities ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE listing_amenities FORCE ROW LEVEL SECURITY"))
    conn.execute(
        text(
            """
            CREATE POLICY listing_amenities_org_or_published ON listing_amenities FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM listings l
                    INNER JOIN unit u ON u.id = l.unit_id
                    WHERE l.id = listing_amenities.listing_id
                    AND (
                        u.organization_id::text = current_setting('app.current_organization_id', true)
                        OR (l.is_published = true)
                    )
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM listings l
                    INNER JOIN unit u ON u.id = l.unit_id
                    WHERE l.id = listing_amenities.listing_id
                    AND u.organization_id::text = current_setting('app.current_organization_id', true)
                )
            )
            """
        )
    )

    # --- inquiries ---
    conn.execute(text("DROP POLICY IF EXISTS inquiries_access ON inquiries"))
    conn.execute(text("ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE inquiries FORCE ROW LEVEL SECURITY"))
    conn.execute(
        text(
            """
            CREATE POLICY inquiries_access ON inquiries FOR ALL
            USING (
                (
                    inquiries.organization_id IS NOT NULL
                    AND inquiries.organization_id::text = current_setting('app.current_organization_id', true)
                )
                OR (
                    inquiries.organization_id IS NULL
                    AND inquiries.apartment_id IS NULL
                    AND NULLIF(current_setting('app.current_organization_id', true), '') IS NULL
                )
                OR (
                    NULLIF(current_setting('app.current_inquiry_id', true), '') IS NOT NULL
                    AND inquiries.id::text = current_setting('app.current_inquiry_id', true)
                )
            )
            WITH CHECK (
                (
                    inquiries.apartment_id IS NULL
                    AND inquiries.organization_id IS NULL
                )
                OR (
                    inquiries.organization_id IS NOT NULL
                    AND inquiries.apartment_id IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM listings l
                        INNER JOIN unit u ON u.id = l.unit_id
                        WHERE l.id = inquiries.apartment_id
                        AND u.organization_id::text = inquiries.organization_id::text
                    )
                )
            )
            """
        )
    )

    # --- password_reset_tokens ---
    conn.execute(text("DROP POLICY IF EXISTS org_isolation_password_reset_tokens ON password_reset_tokens"))
    conn.execute(text("ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY"))
    conn.execute(
        text(
            """
            CREATE POLICY org_isolation_password_reset_tokens ON password_reset_tokens FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = password_reset_tokens.user_id
                    AND u.organization_id::text = current_setting('app.current_organization_id', true)
                )
                OR (
                    password_reset_tokens.token_hash IS NOT NULL
                    AND password_reset_tokens.token_hash = current_setting('app.current_password_reset_token_hash', true)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = password_reset_tokens.user_id
                    AND u.organization_id::text = current_setting('app.current_organization_id', true)
                )
                OR (
                    password_reset_tokens.token_hash IS NOT NULL
                    AND password_reset_tokens.token_hash = current_setting('app.current_password_reset_token_hash', true)
                )
            )
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        text("DROP POLICY IF EXISTS org_isolation_password_reset_tokens ON password_reset_tokens")
    )
    conn.execute(text("ALTER TABLE password_reset_tokens NO FORCE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE password_reset_tokens DISABLE ROW LEVEL SECURITY"))

    conn.execute(text("DROP POLICY IF EXISTS inquiries_access ON inquiries"))
    conn.execute(text("ALTER TABLE inquiries NO FORCE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE inquiries DISABLE ROW LEVEL SECURITY"))

    conn.execute(text("DROP POLICY IF EXISTS listing_amenities_org_or_published ON listing_amenities"))
    conn.execute(text("ALTER TABLE listing_amenities NO FORCE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE listing_amenities DISABLE ROW LEVEL SECURITY"))

    conn.execute(text("DROP POLICY IF EXISTS listing_images_org_or_published ON listing_images"))
    conn.execute(text("ALTER TABLE listing_images NO FORCE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE listing_images DISABLE ROW LEVEL SECURITY"))

    conn.execute(text("DROP POLICY IF EXISTS listings_org_or_published ON listings"))
    conn.execute(text("ALTER TABLE listings NO FORCE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE listings DISABLE ROW LEVEL SECURITY"))

    conn.execute(text("DROP INDEX IF EXISTS ix_inquiries_organization_id"))
    conn.execute(text("ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_organization_id_fkey"))
    op.drop_column("inquiries", "organization_id")
