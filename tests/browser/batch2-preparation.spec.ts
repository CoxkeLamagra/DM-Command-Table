import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
}

test("roster filters, mixed imports and session tabs preserve drafts and save hidden encounters", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Players / NPC’s", exact: true })
    .click();
  const filter = page.getByLabel("Filter roster by type");
  await filter.selectOption("npc");
  await expect(
    page.getByRole("button", { name: /Roster guide/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Roster hero/ })).toHaveCount(
    0,
  );
  await filter.selectOption("player");
  await expect(page.getByRole("button", { name: /Roster hero/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Roster guide/ })).toHaveCount(
    0,
  );
  await filter.selectOption("all");
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: /Test session/ }).click();
  await page
    .getByRole("textbox", { name: "Session notes…", exact: true })
    .fill("Keep these notes while preparing.");
  await page.getByRole("tab", { name: /^Linked stories/ }).click();
  await expect(page.getByRole("button", { name: /The gate/ })).toBeVisible();
  await page.getByRole("tab", { name: /^Encounters \(/ }).click();
  const summary = page.getByLabel("Summary for Road ambush");
  await expect(summary).toContainText("0 combatants");
  await page
    .locator("button[aria-expanded]")
    .filter({ hasText: "Road ambush" })
    .click();
  await page
    .getByRole("button", { name: "Add combatants", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Select Roster hero").check();
  await dialog.getByLabel("Filter roster by type").selectOption("npc");
  await dialog.getByLabel("Select Roster guide").check();
  await dialog.getByRole("tab", { name: "Bestiary", exact: true }).click();
  await dialog.getByLabel("Quantity for Test goblin").fill("3");
  await expect(
    dialog.getByRole("button", { name: "Add selected (5)", exact: true }),
  ).toBeEnabled();
  await dialog.getByLabel("Search combatants").fill("no results");
  await expect(
    dialog.getByRole("button", { name: "Add selected (5)", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("tab", { name: "Single-use", exact: true }).click();
  await dialog.getByLabel("Single-use type").selectOption("player");
  await dialog.getByLabel("Single-use name").fill("Batch2 guest");
  await dialog.getByLabel("Single-use hit points").fill("21");
  await dialog
    .getByRole("button", { name: "Add single-use & selected (6)", exact: true })
    .click();
  await expect(summary).toContainText("6 combatants");
  await expect(summary).toContainText("3 Monsters");
  await expect(summary).toContainText("2 Players");
  await expect(summary).toContainText("1 NPCs");
  await expect(summary).toContainText("3 × Test goblin");
  await page.getByRole("tab", { name: "Notes", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Session notes…", exact: true }),
  ).toHaveText("Keep these notes while preparing.");
  await page
    .getByRole("button", { name: "Save session & encounters", exact: true })
    .click();
  await expect(
    page.getByRole("status", {
      name: "Session Test session: Saved",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: /Test session/ }).click();
  await page.getByRole("tab", { name: /^Encounters \(/ }).click();
  await expect(summary).toContainText("6 combatants");
  await page
    .getByRole("button", { name: "Players / NPC’s", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Batch2 guest/ })).toHaveCount(
    0,
  );
});

test("combat uses the shared picker for multiple sources, quantities and single-use records", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page
    .getByRole("button", { name: "Add combatants", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Select Roster hero").check();
  await dialog.getByRole("tab", { name: "Bestiary", exact: true }).click();
  await dialog.getByLabel("Quantity for Test goblin").fill("2");
  await dialog
    .getByRole("button", { name: "Add selected (3)", exact: true })
    .click();
  await expect(page.getByText("Test goblin #1", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Test goblin #2", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add combatants", exact: true })
    .click();
  await expect(dialog.getByLabel("Select Roster hero")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Add selected (0)", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("tab", { name: "Single-use", exact: true }).click();
  await dialog.getByLabel("Single-use name").fill("Combat guest");
  await dialog.getByLabel("Single-use hit points").fill("-1");
  await expect(
    dialog.getByRole("button", {
      name: "Add single-use combatant",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog.getByLabel("Single-use hit points").fill("13");
  await dialog
    .getByRole("button", { name: "Add single-use combatant", exact: true })
    .click();
  await expect(
    page.getByLabel("Current hit points", { exact: true }),
  ).toHaveValue("13");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Combat: Saved", exact: true }),
  ).toBeVisible();
  // Leave an empty saved tracker for the independent combat regression specs.
  await page
    .getByRole("button", { name: "Encounter actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Clear combat", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page.getByText("Add a combatant to begin.", { exact: true }),
  ).toBeVisible();
});
