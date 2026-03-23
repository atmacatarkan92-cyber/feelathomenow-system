import { expect, test } from "@playwright/test";
import { e2eCredentialsConfigured, loginAsAdmin } from "./utils";

test.describe("Admin apartments", () => {
  test.skip(!e2eCredentialsConfigured(), "E2E credentials not configured");

  test("apartments page loads with table or empty state", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/apartments");
    await expect(page.getByTestId("admin-apartments-page")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: /Apartments \/ Units/i }),
    ).toBeVisible();

    const hasTable = await page.locator("table").first().isVisible().catch(() => false);
    const empty =
      (await page.getByText("Keine Daten vorhanden").count()) > 0 ||
      (await page.getByText("Keine Apartments gefunden").count()) > 0;
    const loading = await page.getByText(/^Laden/).isVisible().catch(() => false);

    expect(hasTable || empty || loading).toBeTruthy();
  });
});
