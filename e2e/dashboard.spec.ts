import { expect, test } from "@playwright/test";
import { e2eCredentialsConfigured, loginAsAdmin } from "./utils";

test.describe("Admin dashboard", () => {
  test.skip(!e2eCredentialsConfigured(), "E2E credentials not configured");

  test("overview dashboard renders with KPI section", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await expect(page.getByTestId("admin-dashboard-page")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Live KPI", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Unternehmensübersicht", { exact: false })).toBeVisible();
  });
});
