import { test, expect } from "@playwright/test";
test("live resources absorb damage, persist independently and resolve timed conditions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-runtime");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await expect(
    page.getByText("Captured ability", { exact: true }),
  ).toBeVisible();
  const first = page
    .locator("button[aria-pressed]")
    .filter({ hasText: "Runtime mage #1" });
  const second = page
    .locator("button[aria-pressed]")
    .filter({ hasText: "Runtime mage #2" });
  await first.click();
  await page.getByLabel("Temporary hit points", { exact: true }).fill("5");
  await page.getByLabel("Concentration", { exact: true }).fill("Bless");
  await page.getByLabel("Damage or healing amount").fill("7");
  await page.getByRole("button", { name: "Damage", exact: true }).click();
  await expect(
    page.getByLabel("Current hit points", { exact: true }),
  ).toHaveValue("18");
  await expect(
    page.getByLabel("Temporary hit points", { exact: true }),
  ).toHaveValue("0");
  await page
    .getByRole("button", { name: "Undo HP change", exact: true })
    .click();
  await expect(
    page.getByLabel("Temporary hit points", { exact: true }),
  ).toHaveValue("5");
  await page
    .getByRole("button", { name: "Use Level 1 spell slots", exact: true })
    .click();
  await second.click();
  await expect(
    page.getByLabel("Level 1 spell slots remaining", { exact: true }),
  ).toHaveValue("2");
  await expect(
    page.getByLabel("Temporary hit points", { exact: true }),
  ).toHaveValue("0");
  await first.click();
  await page
    .getByRole("button", { name: "Add legendary actions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use Legendary actions", exact: true })
    .click();
  await page
    .getByLabel("Death save failures", { exact: true })
    .selectOption("2");
  await page.getByLabel("Condition name", { exact: true }).fill("Held");
  await page.getByLabel("Condition duration", { exact: true }).fill("1");
  await page
    .getByLabel("Condition timing", { exact: true })
    .selectOption("end-turn");
  const conditions = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Status conditions",
      exact: true,
    }),
  });
  await conditions.getByLabel("Requires save", { exact: true }).check();
  await conditions.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Combat: Saved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await first.click();
  await expect(
    page.getByLabel("Level 1 spell slots remaining", { exact: true }),
  ).toHaveValue("1");
  await expect(
    page.getByLabel("Death save failures", { exact: true }),
  ).toHaveValue("2");
  await page.getByRole("button", { name: "Next turn", exact: true }).click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await first.click();
  await expect(
    page.getByText("Saving throw due. Resolve manually.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save succeeded: clear Held", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Clear Held", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next turn", exact: true }).click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Legendary actions remaining", { exact: true }),
  ).toHaveValue("3");
  await expect(
    page.getByLabel("Level 1 spell slots remaining", { exact: true }),
  ).toHaveValue("1");
});
