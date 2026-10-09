import { test, expect } from "@playwright/test";
test("draft recovery, session play and load preview preserve preparation and configurable turns", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-batch1");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page
    .getByRole("textbox", { name: "Campaign name", exact: true })
    .fill("Recover this campaign draft");
  page.on("dialog", async (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Restore draft", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Campaign name", exact: true }),
  ).toHaveValue("Recover this campaign draft");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Campaign: Saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await page
    .getByRole("button", { name: "Session play view", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Session notes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Linked stories", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Session Players and NPCs" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Session notes…", exact: true })
    .fill("Live session draft");
  await page
    .getByRole("button", { name: "Back to preparation", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Session notes…", exact: true }),
  ).toHaveText("Live session draft");
  await page
    .getByRole("button", { name: "Save session & encounters", exact: true })
    .click();
  await expect(
    page.getByText("Session and prepared encounters saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /^Encounters/ }).click();
  await page
    .locator("button[aria-expanded]")
    .filter({ hasText: "Guard patrol" })
    .click();
  await page
    .getByRole("button", { name: "Load in Combat", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Load encounter preview" });
  await expect(preview.getByText(/Result:/)).toBeVisible();
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sessions", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load in Combat", exact: true })
    .click();
  await preview
    .getByRole("button", { name: "Confirm load", exact: true })
    .click();
  await page
    .getByLabel("Zero HP turn handling")
    .selectOption("include-players");
  await page.reload();
  await expect(page.getByLabel("Zero HP turn handling")).toHaveValue(
    "include-players",
  );
  await page
    .getByRole("textbox", { name: "Encounter name", exact: true })
    .fill("Logout draft");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(localStorage).filter((key) =>
            key.startsWith("dmct-draft-v1:"),
          ).length,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("dmct-draft-v1:"),
        ).length,
    ),
  ).toBe(0);
});
