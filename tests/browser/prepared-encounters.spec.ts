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
  const patrol = page.getByRole("button", { name: /Guard patrol/ });
  const ambush = page.getByRole("button", { name: /Road ambush/ });
  await expect(patrol).toHaveAttribute("aria-expanded", "false");
  await expect(ambush).toHaveAttribute("aria-expanded", "false");
  await patrol.click();
  await page.getByLabel("Name", { exact: true }).fill("Captain draft");
  await page.getByRole("button", { name: /Test session/ }).click();
  await page.getByRole("button", { name: /Test session/ }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Captain draft",
  );
  await page.getByPlaceholder("Search sessions…").fill("no match");
  await page.getByPlaceholder("Search sessions…").fill("");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Captain draft",
  );
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
  await section.getByRole("button", { name: "Save", exact: true }).click();
  await responseReady;
  await page.getByLabel("Name", { exact: true }).fill("Captain after save");
  release();
  await expect(
    section.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Captain after save",
  );
  await page.unroute("**/sessions/*/save");
  await section.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    section.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
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
});
