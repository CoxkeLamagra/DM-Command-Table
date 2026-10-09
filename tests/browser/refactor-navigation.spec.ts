import { test, expect } from "@playwright/test";

test("workspace URLs survive reload and browser navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  const menu = page.getByRole("complementary", { name: "Workspace menu" });
  await menu.getByRole("button", { name: "Combat", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/combat$/);
  const combatUrl = page.url();
  await menu.getByRole("button", { name: "Sessions", exact: true }).click();
  await expect(page).toHaveURL(/\/sessions$/);
  await page.goBack();
  await expect(page).toHaveURL(combatUrl);
  await expect(
    menu.getByRole("button", { name: "Combat", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(page).toHaveURL(combatUrl);
  await expect(
    menu.getByRole("button", { name: "Combat", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
