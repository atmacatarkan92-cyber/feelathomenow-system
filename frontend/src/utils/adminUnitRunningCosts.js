/**
 * Monthly unit costs from unit_costs API rows (sum of amount_chf).
 */

/** Sum of amount_chf for unit_costs rows returned by the API. */
export function getUnitCostsTotal(unitCosts) {
  if (!Array.isArray(unitCosts)) return 0;
  return unitCosts.reduce((sum, row) => {
    const n = Number(row?.amount_chf);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** Sum amounts for rows whose cost_type matches (e.g. "Miete", "Nebenkosten"). */
export function sumUnitCostsByType(unitCosts, costTypeLabel) {
  if (!Array.isArray(unitCosts) || costTypeLabel == null || costTypeLabel === "") return 0;
  const label = String(costTypeLabel);
  return unitCosts.reduce((sum, row) => {
    if (String(row?.cost_type || "") !== label) return sum;
    const n = Number(row?.amount_chf);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** Monthly share of landlord insurance deposit premium (annual / 12). */
export function landlordDepositInsuranceMonthly(unit) {
  const t = String(unit?.landlordDepositType || "").trim().toLowerCase();
  if (t !== "insurance") return 0;
  const premium = Number(unit?.landlordDepositAnnualPremium);
  if (!Number.isFinite(premium) || premium <= 0) return 0;
  return premium / 12;
}
