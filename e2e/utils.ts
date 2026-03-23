import { expect, type Page } from "@playwright/test";

export function e2eCredentialsConfigured(): boolean {
  return !!(
    process.env.E2E_ADMIN_EMAIL?.trim() &&
    process.env.E2E_ADMIN_PASSWORD?.trim()
  );
}

/**
 * Logs in via /admin/login; lands on /admin/listings (app default after auth).
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  const email = process.env.E2E_ADMIN_EMAIL!;
  const password = process.env.E2E_ADMIN_PASSWORD!;
  await page.goto("/admin/login");
  await expect(page.getByTestId("admin-login-form")).toBeVisible();
  await page
    .getByTestId("admin-login-form")
    .locator('input[type="email"]')
    .fill(email);
  await page
    .getByTestId("admin-login-form")
    .locator('input[type="password"]')
    .fill(password);
  await page.getByTestId("admin-login-form").locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin\//, { timeout: 30_000 });
  await expect(page.getByTestId("admin-login-form")).not.toBeVisible({
    timeout: 5_000,
  });
}
