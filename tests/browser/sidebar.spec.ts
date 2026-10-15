import { test, expect } from "@playwright/test";

test("sidebar collapses to accessible icons, remembers the preference and keeps mobile navigation expanded", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("dmct-compact-layout", "false"),
  );
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  const sidebar = page.getByRole("complementary", { name: "Workspace menu" });
  const main = page.getByRole("main");
  await expect(main).toHaveAttribute("data-density", "compact");
  await expect(
    sidebar.getByRole("button", { name: /Use (compact|comfortable) layout/ }),
  ).toHaveCount(0);
  const username = sidebar.getByText("browser-test", { exact: true });
  await expect(username).toBeVisible();
  await expect(sidebar.getByText("@browser-test", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    username
      .locator("..")
      .getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  const version = sidebar.getByRole("link", {
    name: /Version .*GitHub repository/,
  });
  await expect(version).toHaveAttribute(
    "href",
    "https://github.com/CoxkeLamagra/DM-Command-Table",
  );
  await expect(version).toHaveAttribute("rel", "noopener noreferrer");
  const collapse = sidebar.getByRole("button", {
    name: "Collapse menu",
    exact: true,
  });
  await expect(collapse).toHaveText("");
  expect((await collapse.boundingBox())!.y).toBeLessThan(80);

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
  await expect(version).toBeVisible();
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
  await expect(
    page.getByRole("combobox", { name: "Campaign", exact: true }),
  ).toBeVisible();
  await sidebar
    .getByRole("button", { name: "Collapse menu", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(combat.locator("span")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Campaign", exact: true }),
  ).toBeVisible();
  await combat.click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await sidebar
    .getByRole("button", { name: "Expand menu", exact: true })
    .click();
  await expect(combat.locator("span")).toBeVisible();
});
