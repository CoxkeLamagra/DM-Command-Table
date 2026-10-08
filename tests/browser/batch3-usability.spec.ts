import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
}

test("Player/NPC creation stays local until save, survives failures and retains in-flight edits", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Players / NPC’s", exact: true })
    .click();
  let posts = 0;
  let ready!: () => void;
  let release!: () => void;
  const responseReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const releaseResponse = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/players", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    posts++;
    if (posts === 1) {
      await route.fulfill({
        status: 503,
        json: { error: "Temporary save failure" },
      });
      return;
    }
    const response = await route.fetch();
    ready();
    await releaseResponse;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Player", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(posts).toBe(0);
  await page.getByRole("button", { name: "NPC", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill("Cancelled draft");
  page.once("dialog", async (prompt) => prompt.accept());
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(posts).toBe(0);
  await expect(
    page.getByRole("button", { name: /Cancelled draft/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "NPC", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill("Saved scout");
  await dialog.getByLabel("Hit points", { exact: true }).fill("17");
  await dialog.getByLabel("Armor class", { exact: true }).fill("14");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Temporary save failure", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
    "Saved scout",
  );
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await responseReady;
  await dialog.getByLabel("Name", { exact: true }).fill("Later scout");
  release();
  await expect(
    dialog.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
    "Later scout",
  );
  await expect(
    dialog.getByRole("status", {
      name: "Player / NPC: Unsaved changes",
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    dialog.getByRole("status", { name: "Player / NPC: Saved", exact: true }),
  ).toBeVisible();
  expect(posts).toBe(2); // One failed POST, one successful POST; later edits use PATCH.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Later scout/ })).toHaveCount(
    1,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Players / NPC’s", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Cancelled draft/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Later scout/ }).click();
  await expect(dialog.getByLabel("Hit points", { exact: true })).toHaveValue(
    "17",
  );
  await expect(dialog.getByLabel("Type", { exact: true })).toHaveValue("npc");
});

test("next-session shortcuts and typed search open exact records with safe highlights", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Prepare next session", exact: true })
    .click();
  await expect(page.getByLabel("Session title")).toHaveValue("Test session");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const query = page.getByLabel("Search campaign records");
  const filter = page.getByLabel("Filter search by record type");
  await query.fill("Roster");
  await filter.selectOption("npc");
  const guide = page.getByRole("button", {
    name: "Open NPC: Roster guide",
    exact: true,
  });
  await expect(guide).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Player: Roster hero", exact: true }),
  ).toHaveCount(0);
  await expect(guide.locator("mark").first()).toHaveText("Roster");
  await guide.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
    "Roster guide",
  );
  await expect(dialog.getByLabel("Type", { exact: true })).toHaveValue("npc");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await query.fill("Test goblin");
  await filter.selectOption("monster");
  await page
    .getByRole("button", { name: "Open Monster: Test goblin", exact: true })
    .click();
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
    "Test goblin",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await query.fill("The gate");
  await page
    .getByRole("button", { name: "Open Story: The gate", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Story details…", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await query.fill("no matching phrase");
  await expect(
    page.getByRole("status").filter({ hasText: "No matching records" }),
  ).toBeVisible();
});

test("mobile rosters fit the screen, density persists, and combat switches Initiative/Details without losing edits", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  async function navigate(name: string) {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("button", { name, exact: true }).click();
  }
  await navigate("Players / NPC’s");
  await expect(page.getByRole("button", { name: /Roster hero/ })).toBeVisible();
  expect(
    await page
      .getByRole("main")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Use compact layout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Players / NPC’s", exact: true })
    .click();
  await expect(page.getByRole("main")).toHaveAttribute(
    "data-density",
    "compact",
  );
  await page.reload();
  await expect(page.getByRole("main")).toHaveAttribute(
    "data-density",
    "compact",
  );
  await navigate("Bestiary");
  await expect(page.getByRole("button", { name: /Test goblin/ })).toBeVisible();
  expect(
    await page
      .getByRole("main")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await navigate("Combat");
  await page
    .getByRole("button", { name: "Add combatants", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Single-use", exact: true }).click();
  await dialog.getByLabel("Single-use name").fill("Mobile ally");
  await dialog
    .getByRole("button", { name: "Add single-use combatant", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Details", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Damage or healing amount").fill("3");
  await page.getByRole("button", { name: "Damage", exact: true }).click();
  await page.getByRole("tab", { name: /^Initiative/ }).click();
  await expect(
    page.getByLabel("Current hit points", { exact: true }),
  ).toBeHidden();
  await page
    .getByRole("tabpanel")
    .getByRole("button", { name: /Mobile ally/ })
    .click();
  await expect(
    page.getByLabel("Current hit points", { exact: true }),
  ).toHaveValue("7");
  await page.getByRole("button", { name: "Next turn", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Combat: Saved", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Details", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(
    await page
      .getByRole("main")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
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
