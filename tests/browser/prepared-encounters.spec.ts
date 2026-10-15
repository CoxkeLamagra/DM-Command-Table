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
  await expect(
    page.getByRole("tab", { name: "Encounters (2)", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /^Encounters/ }).click();
  await page.getByRole("button", { name: "Encounter", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Encounters (3)", exact: true }),
  ).toBeVisible();
  const newEncounter = page
    .locator("button[aria-expanded]")
    .filter({ hasText: "New encounter" });
  await expect(newEncounter).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: "Add combatants", exact: true }),
  ).toBeVisible();
  await newEncounter.click();
  await expect(
    page.getByRole("button", {
      name: "Save encounter New encounter",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save encounter New encounter", exact: true })
    .click();
  await expect(newEncounter).toHaveAttribute("aria-expanded", "false");
  page.once("dialog", async (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Delete encounter New encounter",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("tab", { name: "Encounters (2)", exact: true }),
  ).toBeVisible();
  const patrol = page
    .locator("button[aria-expanded]")
    .filter({ hasText: "Guard patrol" });
  const ambush = page
    .locator("button[aria-expanded]")
    .filter({ hasText: "Road ambush" });
  await expect(patrol).toHaveAttribute("aria-expanded", "false");
  await expect(ambush).toHaveAttribute("aria-expanded", "false");
  const cards = page.locator("[data-prepared-encounter]");
  await expect(
    page.getByRole("button", {
      name: "Load encounter Guard patrol",
      exact: true,
    }),
  ).toBeVisible();
  const moved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/encounters/reorder") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Drag encounter Road ambush", exact: true })
    .dragTo(cards.filter({ has: patrol }));
  expect((await moved).status()).toBe(200);
  await expect(cards.first()).toContainText("Road ambush");
  await expect(ambush).toContainText("1.");
  await page.reload();
  await page.getByRole("button", { name: /Test session/ }).click();
  await page.getByRole("tab", { name: /^Encounters/ }).click();
  await expect(cards.first()).toContainText("Road ambush");
  const restored = page.waitForResponse(
    (response) =>
      response.url().endsWith("/encounters/reorder") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", {
      name: "Move encounter Guard patrol up",
      exact: true,
    })
    .click();
  expect((await restored).status()).toBe(200);
  await expect(cards.first()).toContainText("Guard patrol");

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
  for (const direction of ["down", "up"]) {
    const response = page.waitForResponse(
      (value) =>
        value.url().endsWith("/encounters/reorder") &&
        value.request().method() === "POST",
    );
    await page
      .getByRole("button", {
        name: `Move encounter Guard patrol ${direction}`,
        exact: true,
      })
      .click();
    expect((await response).status()).toBe(200);
  }
  await patrol.click();
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Captain draft");
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
  // Reproduce a notification covering the save control without forcing clicks
  // or waiting for dismissal; the next save must remain a real pointer action.
  const saveButton = section.getByRole("button", {
    name: "Save session & encounters",
    exact: true,
  });
  await saveButton.scrollIntoViewIfNeeded();
  const bounds = await saveButton.boundingBox();
  expect(bounds).not.toBeNull();
  const notification = page.locator('[data-sonner-toast][data-front="true"]');
  await expect(notification).toBeVisible();
  await notification.evaluate((element, box) => {
    Object.assign((element as HTMLElement).style, {
      position: "fixed",
      transform: "none",
      bottom: "auto",
      right: "auto",
      left: `${box!.x + box!.width / 2 - 100}px`,
      top: `${box!.y + box!.height / 2 - 30}px`,
      width: "200px",
      height: "60px",
    });
  }, bounds);
  await section
    .getByRole("button", { name: "Save session & encounters", exact: true })
    .click({ timeout: 2000 });
  await expect(
    section.getByRole("button", {
      name: "Save session & encounters",
      exact: true,
    }),
  ).toBeEnabled();
  const currentNotification = page.locator(
    '[data-sonner-toast][data-front="true"]',
  );
  const notificationElement = await currentNotification.elementHandle();
  await currentNotification.locator("[data-close-button]").click();
  await expect.poll(() => notificationElement!.isVisible()).toBe(false);
  await page.getByRole("button", { name: "Campaign", exact: true }).click();
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await page.getByRole("button", { name: /Test session/ }).click();
  await page.getByRole("tab", { name: /^Encounters/ }).click();
  await patrol.click();
  await expect(
    page.getByRole("button", {
      name: "Edit details for Captain after save",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "false");
  await patrol.click();
  await expect(patrol).toHaveAttribute("aria-expanded", "false");
  await section
    .getByRole("button", { name: "Load encounter Guard patrol", exact: true })
    .first()
    .click();
  const loadPreview = page.getByRole("dialog", {
    name: "Load encounter preview",
  });
  await expect(
    loadPreview.getByRole("heading", {
      name: /^Replace \d+ current combatants$/,
    }),
  ).toBeVisible();
  await expect(
    loadPreview.getByText(/entire current roster is replaced/),
  ).toBeVisible();
  await expect(
    loadPreview.getByRole("heading", { name: /^Retain/ }),
  ).toHaveCount(0);
  const replaceAllChoice = page.getByRole("radio", {
    name: /^No — replace everyone/,
  });
  if (await replaceAllChoice.isVisible()) await replaceAllChoice.check();
  await page
    .getByRole("dialog", { name: "Load encounter preview" })
    .getByRole("button", { name: "Confirm load", exact: true })
    .click();
  await expect(
    page.getByText("Captain after save", { exact: true }).first(),
  ).toBeVisible();

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
    conditions.getByRole("button", { name: "Clear Blinded", exact: true }),
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
    conditions.getByRole("button", {
      name: "Clear Marked by a curse",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Combat: Saved", exact: true }),
  ).toBeVisible();
  for (const preserve of [true, false]) {
    await page.getByRole("button", { name: "Sessions", exact: true }).click();
    const load = page.getByRole("button", {
      name: "Load encounter Guard patrol",
      exact: true,
    });
    if (!(await load.isVisible())) {
      await page.getByRole("button", { name: /Test session/ }).click();
      await page.getByRole("tab", { name: /^Encounters/ }).click();
    }
    await load.click();
    await expect(
      loadPreview.getByRole("group", {
        name: "Preserve active Players and NPCs?",
      }),
    ).toBeVisible();
    await expect(
      loadPreview.getByRole("button", { name: "Confirm load", exact: true }),
    ).toBeDisabled();
    await loadPreview
      .getByRole("radio", {
        name: preserve ? /^Yes — keep active/ : /^No — replace everyone/,
      })
      .check();
    if (preserve)
      await expect(
        loadPreview.getByRole("heading", { name: /^Retain/ }),
      ).toBeVisible();
    await loadPreview
      .getByRole("button", { name: "Confirm load", exact: true })
      .click();
    await expect(
      page.getByText("Captain after save", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      conditions.getByRole("button", {
        name: "Clear Marked by a curse",
        exact: true,
      }),
    ).toHaveCount(preserve ? 1 : 0);
  }
});
