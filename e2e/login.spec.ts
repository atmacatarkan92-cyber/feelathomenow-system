import { expect, test } from "@playwright/test";
import { e2eCredentialsConfigured } from "./utils";

test.describe("Admin login", () => {
  test.skip(
    !e2eCredentialsConfigured(),
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (see e2e/README in repo root notes)",
  );

  test("user can log in and reach a protected admin route", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: /Admin Anmeldung/i })).toBeVisible();
    await expect(page.getByTestId("admin-login-form")).toBeVisible();

    await page
      .getByTestId("admin-login-form")
      .locator('input[type="email"]')
      .fill(process.env.E2E_ADMIN_EMAIL!);
    await page
      .getByTestId("admin-login-form")
      .locator('input[type="password"]')
      .fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByTestId("admin-login-form").locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/admin\//, { timeout: 30_000 });
    await expect(page.getByTestId("admin-login-form")).not.toBeVisible();
    await expect(page).not.toHaveURL(/\/admin\/login/);
  });
});
