"""Tenancies: replace unit_id exclusion with room_id — no overlapping date ranges per room.

Revision ID: 060_room_excl
Revises: 059_tenancy_participants

Drops tenancies_unit_daterange_excl (026) and adds tenancies_room_daterange_excl with the same
half-open daterange [move_in, COALESCE(move_out + 1 day, infinity)) as 026.

Requires btree_gist for EXCLUDE (room_id WITH =) combined with (daterange WITH &&).
"""

import re
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "060_room_excl"
down_revision: Union[str, None] = "059_tenancy_participants"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_CONSTRAINT_NAME = "tenancies_unit_daterange_excl"
NEW_CONSTRAINT_NAME = "tenancies_room_daterange_excl"


def _normalize_constraint_def(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _expected_room_exclusion_definition_sql(move_out_col_sql: str) -> str:
    return (
        f"EXCLUDE USING gist (room_id WITH =, daterange(move_in_date, "
        f"COALESCE({move_out_col_sql} + 1, 'infinity'::date), '[)') WITH &&)"
    )


def _expected_unit_exclusion_definition_sql(move_out_col_sql: str) -> str:
    """Matches migration 026 for downgrade restore."""
    return (
        f"EXCLUDE USING gist (unit_id WITH =, daterange(move_in_date, "
        f"COALESCE({move_out_col_sql} + 1, 'infinity'::date), '[)') WITH &&)"
    )


def _resolve_move_out_column_sql(conn) -> str:
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
        "060: table tenancies has neither column 'move_out_date' nor legacy 'move_out_date date'."
    )


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))

    move_out_col_sql = _resolve_move_out_column_sql(conn)

    conn.execute(text(f'ALTER TABLE tenancies DROP CONSTRAINT IF EXISTS "{OLD_CONSTRAINT_NAME}"'))

    overlap_pairs_room = conn.execute(
        text(
            f"""
            WITH bounds AS (
              SELECT
                id,
                room_id,
                daterange(
                  move_in_date,
                  COALESCE({move_out_col_sql} + 1, 'infinity'::date),
                  '[)'
                ) AS dr
              FROM tenancies
            )
            SELECT COUNT(*)::bigint FROM bounds b1
            INNER JOIN bounds b2
              ON b1.room_id IS NOT DISTINCT FROM b2.room_id AND b1.id < b2.id
            WHERE b1.dr && b2.dr
            """
        )
    ).scalar()
    if overlap_pairs_room and int(overlap_pairs_room) > 0:
        raise RuntimeError(
            "060: overlapping tenancy rows exist for the same room_id "
            "(overlapping move_in_date/move_out_date ranges). Resolve before re-running."
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
        {"cname": NEW_CONSTRAINT_NAME},
    ).one_or_none()

    expected_norm = _normalize_constraint_def(
        _expected_room_exclusion_definition_sql(move_out_col_sql)
    )

    if row is not None:
        existing_def, contype = row[0], row[1]
        if contype != "x":
            raise RuntimeError(
                f"060: constraint {NEW_CONSTRAINT_NAME!r} exists but is not EXCLUDE (contype={contype!r})."
            )
        if existing_def is None:
            raise RuntimeError(f"060: constraint {NEW_CONSTRAINT_NAME!r} exists but definition is NULL.")
        actual_norm = _normalize_constraint_def(existing_def)
        if actual_norm != expected_norm:
            raise RuntimeError(
                f"060: {NEW_CONSTRAINT_NAME!r} definition mismatch. "
                f"pg_get_constraintdef: {existing_def!r}. "
                f"Expected (normalized): {expected_norm!r}. Actual: {actual_norm!r}."
            )
        return

    conn.execute(
        text(
            f"""
            ALTER TABLE tenancies
            ADD CONSTRAINT {NEW_CONSTRAINT_NAME}
            EXCLUDE USING gist (
              room_id WITH =,
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

    conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))

    move_out_col_sql = _resolve_move_out_column_sql(conn)

    conn.execute(text(f'ALTER TABLE tenancies DROP CONSTRAINT IF EXISTS "{NEW_CONSTRAINT_NAME}"'))

    overlap_pairs_unit = conn.execute(
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
    if overlap_pairs_unit and int(overlap_pairs_unit) > 0:
        raise RuntimeError(
            "060 downgrade: overlapping tenancy rows exist for the same unit_id; "
            "cannot restore unit-level exclusion (e.g. parallel room lets). Fix data or avoid downgrade."
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
        {"cname": OLD_CONSTRAINT_NAME},
    ).one_or_none()

    expected_norm = _normalize_constraint_def(
        _expected_unit_exclusion_definition_sql(move_out_col_sql)
    )

    if row is not None:
        existing_def, contype = row[0], row[1]
        if contype != "x":
            raise RuntimeError(
                f"060 downgrade: {OLD_CONSTRAINT_NAME!r} exists but is not EXCLUDE (contype={contype!r})."
            )
        actual_norm = _normalize_constraint_def(existing_def)
        if actual_norm != expected_norm:
            raise RuntimeError(
                f"060 downgrade: {OLD_CONSTRAINT_NAME!r} definition mismatch. "
                f"Expected: {expected_norm!r}. Actual: {actual_norm!r}."
            )
        return

    conn.execute(
        text(
            f"""
            ALTER TABLE tenancies
            ADD CONSTRAINT {OLD_CONSTRAINT_NAME}
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