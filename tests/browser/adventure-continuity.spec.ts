import { test, expect } from "@playwright/test";

test("session continuity survives saves and selected carry-forward, and one-shots start with one session", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-continuity");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page.getByLabel("New thread title").fill("Find the missing scale");
  await page.getByRole("button", { name: "Add thread", exact: true }).click();
  await page.getByLabel("New party preset name").fill("Tonight");
  await page
    .getByRole("button", { name: "Add party preset", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Campaign: Saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await page.getByLabel("New scene title").fill("Unfinished lead");
  await page.getByRole("button", { name: "Add scene", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Actual events and decisions…", exact: true })
    .fill("The party found a clue");
  await page
    .getByRole("textbox", {
      name: "Treasure, XP, milestones and other rewards…",
      exact: true,
    })
    .fill("50 gold");
  await page
    .getByRole("region", { name: "Session threads" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("region", { name: "Session attendance" })
    .getByRole("checkbox", { name: /Roster hero/ })
    .check();
  await page
    .getByRole("button", { name: "Save session & encounters", exact: true })
    .click();
  await expect(
    page.getByText("Session and prepared encounters saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", {
      name: "Actual events and decisions…",
      exact: true,
    }),
  ).toHaveText("The party found a clue");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download printable packet", exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toBe("dm-session-packet.html");
  await page
    .getByRole("button", { name: "Prepare next session", exact: true })
    .click();
  await page.getByLabel("Next session title").fill("Session two");
  await page
    .getByRole("button", { name: "Create next session", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Session title", exact: true }),
  ).toHaveValue("Session two");
  await expect(
    page.getByRole("textbox", {
      name: "Actual events and decisions…",
      exact: true,
    }),
  ).toHaveText("");
  await expect(
    page.getByRole("region", { name: "Scene checklist" }),
  ).toContainText("Unfinished lead");
  await page
    .getByRole("button", { name: "One-shot quick start", exact: true })
    .click();
  await page
    .getByLabel("One-shot name", { exact: true })
    .fill("The missing scale");
  await page
    .getByRole("button", { name: "Create one-shot", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Session title", exact: true }),
  ).toHaveValue("The missing scale");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Scene checklist" }),
  ).toContainText("Opening hook");
});
