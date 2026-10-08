import { test, expect } from "@playwright/test";

test("sidebar collapses to accessible icons, remembers the preference and keeps mobile navigation expanded", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  const sidebar = page.getByRole("complementary", { name: "Workspace menu" });
  const main = page.getByRole("main");
  const fullWidth = await sidebar.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  await sidebar
    .getByRole("button", { name: "Collapse menu", exact: true })
    .click();
  await expect(
    sidebar.getByRole("button", { name: "Expand menu", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  const narrowWidth = await sidebar.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  expect(narrowWidth).toBeLessThan(fullWidth);
  expect(
    await main.evaluate((element) => element.getBoundingClientRect().left),
  ).toBe(narrowWidth);
  const combat = sidebar.getByRole("button", { name: "Combat", exact: true });
  await expect(combat).toHaveAttribute("title", "Combat");
  await expect(combat.locator("span")).toBeHidden();
  await combat.click();
  await expect(combat).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(
    sidebar.getByRole("button", { name: "Expand menu", exact: true }),
  ).toBeVisible();
  await sidebar
    .getByRole("button", { name: "Choose campaign", exact: true })
    .click();
  await expect(page.getByLabel("Campaign", { exact: true })).toBeVisible();
  await sidebar
    .getByRole("button", { name: "Collapse menu", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(combat.locator("span")).toBeVisible();
  await expect(page.getByLabel("Campaign", { exact: true })).toBeVisible();
  await combat.click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await sidebar
    .getByRole("button", { name: "Expand menu", exact: true })
    .click();
  await expect(combat.locator("span")).toBeVisible();
});
