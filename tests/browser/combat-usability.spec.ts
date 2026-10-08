import { test, expect } from "@playwright/test";

test("combat HP controls preserve edits, show save state and confirm encounter actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page
    .getByRole("button", { name: "Add combatants", exact: true })
    .click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("tab", { name: "Single-use", exact: true }).click();
  await picker.getByLabel("Single-use name").fill("New NPC");
  await picker
    .getByRole("button", { name: "Add single-use combatant", exact: true })
    .click();
  const hp = page.getByLabel("Current hit points", { exact: true });
  await expect(hp).toHaveValue("10");
  const amount = page.getByLabel("Damage or healing amount");
  await amount.fill("4");
  await page.getByRole("button", { name: "Damage", exact: true }).click();
  await expect(hp).toHaveValue("6");
  await expect(
    page.getByRole("status", { name: "Combat: Unsaved changes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Undo HP change", exact: true })
    .click();
  await expect(hp).toHaveValue("10");
  await amount.fill("99");
  await page.getByRole("button", { name: "Damage", exact: true }).click();
  await expect(hp).toHaveValue("0");
  await page.getByRole("button", { name: "Heal", exact: true }).click();
  await expect(hp).toHaveValue("10");
  await amount.fill("-2");
  await expect(
    page.getByRole("button", { name: "Damage", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Combat: Saved", exact: true }),
  ).toBeVisible();
  const controls = page.getByLabel("Combat turn controls");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(
    controls.getByRole("button", { name: "Next turn", exact: true }),
  ).toBeInViewport();
  await page
    .getByRole("button", { name: "Encounter actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Clear combat", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Clear combat?", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(hp).toHaveValue("10");
  await page
    .getByRole("button", { name: "Encounter actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Clear combat", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByText("Add a combatant to begin.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(hp).toHaveValue("10");
});
