"""
Profit calculation: revenue (from tenancies) minus monthly costs per unit/month.

Costs = fixed monthly unit fields (landlord rent, utilities, cleaning) plus
sum of unit_costs rows for the unit.
"""

from typing import Dict, Any

from sqlmodel import select

from db.models import Unit, UnitCost
from app.services.revenue_forecast import calculate_monthly_revenue


def _fixed_monthly_unit_costs_chf(unit: Unit | None) -> float:
    """Sum landlord_rent_monthly_chf + utilities_monthly_chf + cleaning_cost_monthly_chf; null as 0."""
    if unit is None:
        return 0.0
    lr = getattr(unit, "landlord_rent_monthly_chf", None)
    ut = getattr(unit, "utilities_monthly_chf", None)
    cl = getattr(unit, "cleaning_cost_monthly_chf", None)
    return float(lr or 0) + float(ut or 0) + float(cl or 0)


def calculate_unit_profit(session, unit_id: str, year: int, month: int) -> Dict[str, Any]:
    """
    For the given unit and month, compute revenue (from tenancies), total monthly costs
    (fixed unit fields + unit_costs rows), and profit = revenue - costs.
    unit_costs rows are summed as monthly amounts (no period filter).
    """
    rev = calculate_monthly_revenue(session, unit_id, year, month)
    revenue = rev["expected_revenue"]

    unit = session.get(Unit, unit_id)
    fixed = _fixed_monthly_unit_costs_chf(unit)

    cost_rows = session.exec(
        select(UnitCost).where(UnitCost.unit_id == unit_id)
    ).all()
    extra = sum(float(c.amount_chf or 0) for c in cost_rows)
    costs = fixed + extra
    profit = round(revenue - costs, 2)

    return {
        "unit_id": unit_id,
        "year": year,
        "month": month,
        "revenue": round(revenue, 2),
        "costs": round(costs, 2),
        "profit": profit,
    }
