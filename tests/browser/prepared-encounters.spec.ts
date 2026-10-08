import { test, expect } from "@playwright/test";
test("encounter drafts survive collapse, search and in-flight saves and load into combat", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-test");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: /Test session/ }).click();
  const patrol = page
    .locator("button[aria-expanded]")
    .filter({ hasText: "Guard patrol" });
  const ambush = page
    .locator("button[aria-expanded]")
    .filter({ hasText: "Road ambush" });
  await expect(patrol).toHaveAttribute("aria-expanded", "false");
  await expect(ambush).toHaveAttribute("aria-expanded", "false");
  await patrol.click();
  const editor = page.getByRole("button", {
    name: "Edit details for Town guard",
    exact: true,
  });
  await expect(editor).toHaveAttribute("aria-expanded", "false");
  await editor.click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Captain draft");
  await page
    .getByRole("button", { name: "Collapse editor", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toBeHidden();
  await page
    .getByRole("button", {
      name: "Edit details for Captain draft",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Captain draft");
  await page
    .getByRole("button", {
      name: "Collapse details for Captain draft",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Test session/ }).click();
  await page.getByRole("button", { name: /Test session/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Edit details for Captain draft",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("button", {
      name: "Edit details for Captain draft",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Captain draft");
  await page.getByPlaceholder("Search sessions…").fill("no match");
  await page.getByPlaceholder("Search sessions…").fill("");
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Captain draft");
  const section = page.locator("article");
  await section
    .getByRole("button", { name: "Expand all", exact: true })
    .click();
  await expect(ambush).toHaveAttribute("aria-expanded", "true");
  await section
    .getByRole("button", { name: "Collapse all", exact: true })
    .click();
  await expect(patrol).toHaveAttribute("aria-expanded", "false");
  await patrol.click();
  let ready!: () => void;
  let release!: () => void;
  const responseReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const releaseResponse = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/sessions/*/save", async (route) => {
    const response = await route.fetch();
    ready();
    await releaseResponse;
    await route.fulfill({ response });
  });
  await section
    .getByRole("button", { name: "Save session & encounters", exact: true })
    .click();
  await responseReady;
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Captain after save");
  release();
  await expect(
    section.getByRole("button", {
      name: "Save session & encounters",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Captain after save");
  await page.unroute("**/sessions/*/save");
  await section
    .getByRole("button", { name: "Save session & encounters", exact: true })
    .click();
  await expect(
    section.getByRole("button", {
      name: "Save session & encounters",
      exact: true,
    }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Campaign", exact: true }).click();
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: /Test session/ }).click();
  await patrol.click();
  await expect(
    page.getByRole("button", {
      name: "Edit details for Captain after save",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "false");
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs++;
    await dialog.accept();
  });
  await section
    .getByRole("button", { name: "Load in Combat", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Captain after save", { exact: true }).first(),
  ).toBeVisible();
  expect(dialogs).toBe(1);
  const conditions = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Status conditions",
      exact: true,
    }),
  });
  await conditions
    .getByRole("button", { name: "Choose a default condition", exact: true })
    .click();
  const menu = page.getByRole("menu", {
    name: "Choose a default condition",
    exact: true,
  });
  for (const name of [
    "Blinded",
    "Charmed",
    "Deafened",
    "Exhaustion",
    "Frightened",
    "Grappled",
    "Incapacitated",
    "Invisible",
    "Paralyzed",
    "Petrified",
    "Poisoned",
    "Prone",
    "Restrained",
    "Stunned",
    "Unconscious",
    "Concentrating",
  ]) {
    await expect(menu.getByRole("menuitem", { name, exact: true })).toHaveCount(
      1,
    );
  }
  await menu.getByRole("menuitem", { name: "Blinded", exact: true }).click();
  await expect(conditions.getByLabel("Condition name")).toHaveValue("Blinded");
  await conditions.getByPlaceholder("Turns", { exact: true }).fill("2");
  await conditions.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    conditions.getByRole("button", { name: "Blinded · 2 turns", exact: true }),
  ).toBeVisible();
  await conditions.getByLabel("Condition name").fill("Marked by a curse");
  await conditions
    .getByRole("button", { name: "Choose a default condition", exact: true })
    .click();
  await expect(
    menu.getByRole("menuitem", { name: "Poisoned", exact: true }),
  ).toHaveCount(1);
  await menu.press("Escape");
  await expect(conditions.getByLabel("Condition name")).toHaveValue(
    "Marked by a curse",
  );
  await conditions.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    conditions.getByRole("button", { name: "Marked by a curse", exact: true }),
  ).toBeVisible();
});
