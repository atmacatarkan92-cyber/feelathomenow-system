import { expect, test } from "@playwright/test";
import { e2eCredentialsConfigured, loginAsAdmin } from "./utils";

/**
 * KPI sanity: values exposed from the same profit summary as the UI (tenancy-based
 * revenue / unit_costs costs / profit). Aligns with KPI_SEMANTICS.md implementation path.
 */
test.describe("KPI sanity (dashboard profit cards)", () => {
  test.skip(!e2eCredentialsConfigured(), "E2E credentials not configured");

  test("revenue, costs, profit are non-negative and profit matches revenue − costs", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");

    const summary = page.getByTestId("kpi-profit-summary");
    await expect(summary).toBeVisible({ timeout: 45_000 });

    const revenue = Number(await summary.getAttribute("data-revenue"));
    const costs = Number(await summary.getAttribute("data-costs"));
    const profit = Number(await summary.getAttribute("data-profit"));

    expect(Number.isFinite(revenue)).toBeTruthy();
    expect(Number.isFinite(costs)).toBeTruthy();
    expect(Number.isFinite(profit)).toBeTruthy();

    expect(revenue).toBeGreaterThanOrEqual(0);
    expect(costs).toBeGreaterThanOrEqual(0);

    const expected = revenue - costs;
    const tol = 0.05;
    expect(Math.abs(profit - expected)).toBeLessThanOrEqual(tol);
  });
});
