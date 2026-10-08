import { test, expect } from "@playwright/test";

test("campaign NPCs import into prepared encounters and combat while single-use records remain available", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page
    .getByRole("button", { name: "Players / NPC’s", exact: true })
    .click();
  await page.getByRole("button", { name: "NPC", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Campaign healer");
  await expect(dialog.getByLabel("Type", { exact: true })).toHaveValue("npc");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Player / NPC saved", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /Campaign healer/ }),
  ).toContainText("NPC");
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: /Test session/ }).click();
  await page.getByRole("button", { name: /Guard patrol/ }).click();
  await page
    .getByRole("button", { name: "Campaign players / NPCs", exact: true })
    .click();
  await dialog.getByLabel("Select Campaign healer").check();
  await dialog.getByRole("button", { name: /Add selected/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Edit details for Campaign healer",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Player", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "NPC", exact: true }),
  ).toBeVisible();
  await page
    .locator("article")
    .getByRole("button", { name: "Save session & encounters", exact: true })
    .click();
  await expect(
    page
      .locator("article")
      .getByRole("button", { name: "Save session & encounters", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page
    .getByRole("button", { name: "Add players / NPCs", exact: true })
    .click();
  await dialog.getByLabel("Select Campaign healer").check();
  await dialog.getByRole("button", { name: /Add selected/ }).click();
  await expect(
    page.getByText("Campaign healer", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add players / NPCs", exact: true })
    .click();
  await expect(dialog.getByLabel("Select Campaign healer")).toHaveCount(0);
});
