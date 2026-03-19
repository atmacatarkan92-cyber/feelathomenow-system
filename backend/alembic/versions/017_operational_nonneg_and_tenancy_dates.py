"""Operational CHECK constraints: non-negative money/counts and tenancy date order.

Revision ID: 017_operational_nonneg
Revises: 016_org_scoping_hardening
Create Date: 2026-03-14

Adds high-confidence CHECK constraints only:
  - unit.rooms >= 0
  - room.price >= 0
  - listings: price_chf_month, bedrooms, bathrooms, size_sqm >= 0
  - unit_costs.amount_chf >= 0
  - tenancies: move_out_date IS NULL OR move_out_date > move_in_date
  - tenancies: rent and deposit columns >= 0 (column names: monthly_rent/rent_chf, deposit_amount/deposit_chf)

Data safety:
  - Negative or invalid numeric values: migration FAILS with count + sample rows + diagnostic SQL (no UPDATEs).
  - Invalid move_out <= move_in: same (fail fast, no silent repair).

Downgrade drops constraints in reverse order.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "017_operational_nonneg"
down_revision: Union[str, None] = "016_org_scoping_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _constraint_exists(conn, table: str, constraint: str) -> bool:
    result = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public' AND table_name = :t AND constraint_name = :c
            LIMIT 1
            """
        ),
        {"t": table, "c": constraint},
    )
    return result.fetchone() is not None


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :t AND column_name = :c
            LIMIT 1
            """
        ),
        {"t": table, "c": column},
    )
    return result.fetchone() is not None


def _tenancy_rent_column(conn) -> str | None:
    for col in ("monthly_rent", "rent_chf"):
        if _column_exists(conn, "tenancies", col):
            return col
    return None


def _tenancy_deposit_column(conn) -> str | None:
    for col in ("deposit_amount", "deposit_chf"):
        if _column_exists(conn, "tenancies", col):
            return col
    return None


def _fail_if_violations(
    conn,
    *,
    label: str,
    count_sql: str,
    sample_sql: str,
    diagnostic_sql: str,
    fix_hint: str,
) -> None:
    """Raise RuntimeError if count > 0; include up to 10 sample rows for manual repair."""
    n = conn.execute(text(count_sql)).scalar()
    cnt = int(n) if n is not None else 0
    if cnt <= 0:
        return
    rows = conn.execute(text(sample_sql)).fetchall()
    sample_lines = "\n".join(f"  {tuple(r)}" for r in rows[:10]) if rows else "  (no rows returned by sample query)"
    raise RuntimeError(
        f"Migration 017 blocked - {label}: {cnt} row(s) violate the upcoming CHECK constraint.\n"
        f"Sample (up to 10):\n{sample_lines}\n"
        f"Full diagnostic (run in psql):\n  {diagnostic_sql}\n"
        f"Fix manually, then re-run: alembic upgrade head\n"
        f"Hint: {fix_hint}"
    )


def upgrade() -> None:
    conn = op.get_bind()

    # --- unit.rooms >= 0 ---
    if not _constraint_exists(conn, "unit", "ck_unit_rooms_nonnegative"):
        _fail_if_violations(
            conn,
            label="unit.rooms must be >= 0",
            count_sql="SELECT COUNT(*) FROM unit WHERE rooms < 0",
            sample_sql="SELECT id, title, rooms FROM unit WHERE rooms < 0 LIMIT 10",
            diagnostic_sql="SELECT id, title, address, city, rooms FROM unit WHERE rooms < 0 ORDER BY id;",
            fix_hint="Set rooms to a non-negative integer (or delete invalid test rows).",
        )
        op.create_check_constraint(
            "ck_unit_rooms_nonnegative",
            "unit",
            "rooms >= 0",
        )

    # --- room.price >= 0 ---
    if not _constraint_exists(conn, "room", "ck_room_price_nonnegative"):
        _fail_if_violations(
            conn,
            label="room.price must be >= 0",
            count_sql="SELECT COUNT(*) FROM room WHERE price < 0",
            sample_sql="SELECT id, unit_id, name, price FROM room WHERE price < 0 LIMIT 10",
            diagnostic_sql="SELECT id, unit_id, name, price, floor, is_active FROM room WHERE price < 0 ORDER BY id;",
            fix_hint="Set price to a non-negative integer (CHF).",
        )
        op.create_check_constraint(
            "ck_room_price_nonnegative",
            "room",
            "price >= 0",
        )

    # --- listings non-negative metrics ---
    if not _constraint_exists(conn, "listings", "ck_listings_nonneg_metrics"):
        _fail_if_violations(
            conn,
            label="listings metrics (price_chf_month, bedrooms, bathrooms, size_sqm) must be >= 0",
            count_sql="""
                SELECT COUNT(*) FROM listings
                WHERE price_chf_month < 0 OR bedrooms < 0 OR bathrooms < 0 OR size_sqm < 0
            """,
            sample_sql="""
                SELECT id, slug, price_chf_month, bedrooms, bathrooms, size_sqm FROM listings
                WHERE price_chf_month < 0 OR bedrooms < 0 OR bathrooms < 0 OR size_sqm < 0
                LIMIT 10
            """,
            diagnostic_sql="""
SELECT id, slug, price_chf_month, bedrooms, bathrooms, size_sqm FROM listings
WHERE price_chf_month < 0 OR bedrooms < 0 OR bathrooms < 0 OR size_sqm < 0 ORDER BY id;
            """.strip(),
            fix_hint="Correct listing numbers to valid non-negative values before re-running migration.",
        )
        op.create_check_constraint(
            "ck_listings_nonneg_metrics",
            "listings",
            "price_chf_month >= 0 AND bedrooms >= 0 AND bathrooms >= 0 AND size_sqm >= 0",
        )

    # --- unit_costs.amount_chf >= 0 ---
    if not _constraint_exists(conn, "unit_costs", "ck_unit_costs_amount_nonnegative"):
        _fail_if_violations(
            conn,
            label="unit_costs.amount_chf must be >= 0",
            count_sql="SELECT COUNT(*) FROM unit_costs WHERE amount_chf < 0",
            sample_sql="SELECT id, unit_id, cost_type, amount_chf FROM unit_costs WHERE amount_chf < 0 LIMIT 10",
            diagnostic_sql="SELECT id, unit_id, cost_type, amount_chf, created_at FROM unit_costs WHERE amount_chf < 0 ORDER BY id;",
            fix_hint="Set amount_chf to a non-negative value or remove erroneous cost rows.",
        )
        op.create_check_constraint(
            "ck_unit_costs_amount_nonnegative",
            "unit_costs",
            "amount_chf >= 0",
        )

    # --- tenancies: move_out > move_in when move_out set (no auto-fix) ---
    if _column_exists(conn, "tenancies", "move_in_date") and _column_exists(
        conn, "tenancies", "move_out_date"
    ):
        if not _constraint_exists(conn, "tenancies", "ck_tenancies_move_out_after_move_in"):
            bad = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM tenancies
                    WHERE move_out_date IS NOT NULL AND move_out_date <= move_in_date
                    """
                )
            ).scalar()
            if bad and int(bad) > 0:
                sample = conn.execute(
                    text(
                        """
                        SELECT id, tenant_id, room_id, move_in_date, move_out_date, status
                        FROM tenancies
                        WHERE move_out_date IS NOT NULL AND move_out_date <= move_in_date
                        LIMIT 10
                        """
                    )
                ).fetchall()
                sample_lines = "\n".join(f"  {tuple(r)}" for r in sample) if sample else ""
                raise RuntimeError(
                    f"Migration 017 blocked - tenancies: {bad} row(s) have move_out_date <= move_in_date.\n"
                    f"Sample (up to 10):\n{sample_lines}\n"
                    "Diagnostic:\n"
                    "  SELECT id, tenant_id, room_id, unit_id, move_in_date, move_out_date, status FROM tenancies\n"
                    "  WHERE move_out_date IS NOT NULL AND move_out_date <= move_in_date ORDER BY id;\n"
                    "Fix manually, then re-run: alembic upgrade head"
                )
            op.create_check_constraint(
                "ck_tenancies_move_out_after_move_in",
                "tenancies",
                "move_out_date IS NULL OR move_out_date > move_in_date",
            )

    # --- tenancies: rent/deposit >= 0 ---
    rent_col = _tenancy_rent_column(conn)
    dep_col = _tenancy_deposit_column(conn)
    if not _constraint_exists(conn, "tenancies", "ck_tenancies_financials_nonneg"):
        parts: list[str] = []
        if rent_col:
            _fail_if_violations(
                conn,
                label=f"tenancies.{rent_col} must be >= 0",
                count_sql=f"SELECT COUNT(*) FROM tenancies WHERE {rent_col} < 0",
                sample_sql=(
                    f"SELECT id, tenant_id, room_id, unit_id, {rent_col}, status "
                    f"FROM tenancies WHERE {rent_col} < 0 LIMIT 10"
                ),
                diagnostic_sql=(
                    f"SELECT id, tenant_id, room_id, unit_id, {rent_col}, status "
                    f"FROM tenancies WHERE {rent_col} < 0 ORDER BY id;"
                ),
                fix_hint=f"Correct {rent_col} to a non-negative value before re-running migration.",
            )
            parts.append(f"{rent_col} >= 0")
        if dep_col:
            _fail_if_violations(
                conn,
                label=f"tenancies.{dep_col} must be NULL or >= 0",
                count_sql=(
                    f"SELECT COUNT(*) FROM tenancies WHERE {dep_col} IS NOT NULL AND {dep_col} < 0"
                ),
                sample_sql=(
                    f"SELECT id, tenant_id, room_id, unit_id, {rent_col}, {dep_col}, status FROM tenancies "
                    f"WHERE {dep_col} IS NOT NULL AND {dep_col} < 0 LIMIT 10"
                    if rent_col
                    else f"SELECT id, tenant_id, room_id, unit_id, {dep_col}, status FROM tenancies "
                    f"WHERE {dep_col} IS NOT NULL AND {dep_col} < 0 LIMIT 10"
                ),
                diagnostic_sql=(
                    f"SELECT id, tenant_id, room_id, unit_id, {dep_col}, status FROM tenancies "
                    f"WHERE {dep_col} IS NOT NULL AND {dep_col} < 0 ORDER BY id;"
                ),
                fix_hint=f"Correct {dep_col} to NULL or a non-negative amount.",
            )
            parts.append(f"({dep_col} IS NULL OR {dep_col} >= 0)")
        if parts:
            op.create_check_constraint(
                "ck_tenancies_financials_nonneg",
                "tenancies",
                " AND ".join(parts),
            )


def downgrade() -> None:
    conn = op.get_bind()

    if _constraint_exists(conn, "tenancies", "ck_tenancies_financials_nonneg"):
        op.drop_constraint("ck_tenancies_financials_nonneg", "tenancies", type_="check")

    if _constraint_exists(conn, "tenancies", "ck_tenancies_move_out_after_move_in"):
        op.drop_constraint("ck_tenancies_move_out_after_move_in", "tenancies", type_="check")

    if _constraint_exists(conn, "unit_costs", "ck_unit_costs_amount_nonnegative"):
        op.drop_constraint("ck_unit_costs_amount_nonnegative", "unit_costs", type_="check")

    if _constraint_exists(conn, "listings", "ck_listings_nonneg_metrics"):
        op.drop_constraint("ck_listings_nonneg_metrics", "listings", type_="check")

    if _constraint_exists(conn, "room", "ck_room_price_nonnegative"):
        op.drop_constraint("ck_room_price_nonnegative", "room", type_="check")

    if _constraint_exists(conn, "unit", "ck_unit_rooms_nonnegative"):
        op.drop_constraint("ck_unit_rooms_nonnegative", "unit", type_="check")
