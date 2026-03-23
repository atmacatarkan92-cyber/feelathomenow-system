"""Tenancies: exclusion constraint — no overlapping date ranges per unit_id.

Revision ID: 026_tenancies_no_overlap
Revises: 025_rls_core_tables

Half-open daterange [move_in, COALESCE(move_out + 1 day, infinity)) so adjacent bookings
(e.g. ends Apr 30, next starts May 1) do not overlap.

Requires btree_gist for EXCLUDE (unit_id WITH =) combined with (daterange WITH &&).
"""

import re
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "026_tenancies_no_overlap"
down_revision: Union[str, None] = "025_rls_core_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONSTRAINT_NAME = "tenancies_unit_daterange_excl"


def _normalize_constraint_def(s: str) -> str:
    """Collapse whitespace for comparison; preserves spaces inside quoted identifiers."""
    return re.sub(r"\s+", " ", s).strip()


def _expected_exclusion_definition_sql(move_out_col_sql: str) -> str:
    """Must match what ADD CONSTRAINT emits (pg_get_constraintdef normalizes similarly)."""
    return (
        f"EXCLUDE USING gist (unit_id WITH =, daterange(move_in_date, "
        f"COALESCE({move_out_col_sql} + 1, 'infinity'::date), '[)') WITH &&)"
    )


def _resolve_move_out_column_sql(conn) -> str:
    """Prefer canonical move_out_date; else legacy quoted column name (schema drift)."""
    if conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'tenancies'
              AND column_name = 'move_out_date'
            """
        )
    ).scalar():
        return "move_out_date"
    if conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'tenancies'
              AND column_name = 'move_out_date date'
            """
        )
    ).scalar():
        return '"move_out_date date"'
    raise RuntimeError(
        "Cannot add tenancies exclusion constraint: table tenancies has neither column "
        "'move_out_date' nor legacy column 'move_out_date date' for move-out dates."
    )


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))

    move_out_col_sql = _resolve_move_out_column_sql(conn)

    overlap_pairs = conn.execute(
        text(
            f"""
            WITH bounds AS (
              SELECT
                id,
                unit_id,
                daterange(
                  move_in_date,
                  COALESCE({move_out_col_sql} + 1, 'infinity'::date),
                  '[)'
                ) AS dr
              FROM tenancies
            )
            SELECT COUNT(*)::bigint FROM bounds b1
            INNER JOIN bounds b2
              ON b1.unit_id = b2.unit_id AND b1.id < b2.id
            WHERE b1.dr && b2.dr
            """
        )
    ).scalar()
    if overlap_pairs and int(overlap_pairs) > 0:
        raise RuntimeError(
            "Cannot add tenancies exclusion constraint: overlapping tenancy rows exist for the "
            "same unit_id (overlapping move_in_date/move_out_date ranges). Fix or remove "
            "overlapping tenancies before re-running this migration."
        )

    row = conn.execute(
        text(
            """
            SELECT pg_get_constraintdef(c.oid), c.contype
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'tenancies'
              AND c.conname = :cname
            """
        ),
        {"cname": CONSTRAINT_NAME},
    ).one_or_none()

    expected_norm = _normalize_constraint_def(
        _expected_exclusion_definition_sql(move_out_col_sql)
    )

    if row is not None:
        existing_def, contype = row[0], row[1]
        if contype != "x":
            raise RuntimeError(
                f"Constraint {CONSTRAINT_NAME!r} on tenancies exists but is not an EXCLUDE "
                f"constraint (contype={contype!r}). Remove or rename it before re-running migration 026."
            )
        if existing_def is None:
            raise RuntimeError(
                f"Constraint {CONSTRAINT_NAME!r} exists but pg_get_constraintdef returned NULL."
            )
        actual_norm = _normalize_constraint_def(existing_def)
        if actual_norm != expected_norm:
            raise RuntimeError(
                f"Constraint {CONSTRAINT_NAME!r} exists on tenancies but its definition does not "
                f"match migration 026 (expected exclusion rule for half-open daterange per unit_id). "
                f"pg_get_constraintdef: {existing_def!r}. "
                f"Expected (normalized): {expected_norm!r}. "
                f"Actual (normalized): {actual_norm!r}."
            )
        return

    conn.execute(
        text(
            f"""
            ALTER TABLE tenancies
            ADD CONSTRAINT {CONSTRAINT_NAME}
            EXCLUDE USING gist (
              unit_id WITH =,
              daterange(
                move_in_date,
                COALESCE({move_out_col_sql} + 1, 'infinity'::date),
                '[)'
              ) WITH &&
            )
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text(f"ALTER TABLE tenancies DROP CONSTRAINT IF EXISTS {CONSTRAINT_NAME}")
    )
