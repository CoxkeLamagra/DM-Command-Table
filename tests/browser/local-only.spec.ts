import { test, expect } from "@playwright/test";

test("local catalogue search, preview, import and replacement work with external requests denied", async ({
  page,
}) => {
  const external: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") {
      external.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain(
    "connect-src 'self' https://dnd5e.lamagra.link;",
  );
  await page.getByLabel("Username", { exact: true }).fill("browser-offline");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("button", { name: "Bestiary", exact: true }).click();
  await page
    .getByRole("button", { name: "Import monsters", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Connect to remote catalogue" }),
  ).toBeVisible();
  const upload = () =>
    dialog.locator('input[type="file"]').setInputFiles({
      name: "local.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          monster: [
            {
              name: "Offline drake",
              source: "LOCAL",
              type: "dragon",
              ac: [16],
              hp: { average: 42 },
              cr: "3",
              action: [{ name: "Bite", entries: ["1 damage"] }],
            },
          ],
        }),
      ),
    });
  await upload();
  await dialog.getByPlaceholder("Type at least two characters…").fill("drake");
  await expect(dialog.getByText(/CR 3 · dragon · AC 16 · HP 42/)).toBeVisible();
  await dialog.getByText("Offline drake", { exact: true }).click();
  await dialog
    .getByRole("button", { name: "Import selected (1)", exact: true })
    .click();
  await expect(
    page.getByText("Import complete: 1 added, 0 replaced, 0 discarded", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import monsters", exact: true })
    .click();
  await upload();
  await dialog.getByPlaceholder("Type at least two characters…").fill("drake");
  await dialog.getByText("Offline drake", { exact: true }).click();
  page.once("dialog", (prompt) => prompt.accept());
  await dialog
    .getByRole("button", { name: "Import selected (1)", exact: true })
    .click();
  await expect(
    page.getByText("Import complete: 0 added, 1 replaced, 0 discarded", {
      exact: true,
    }),
  ).toBeVisible();
  expect(external).toEqual([]);
});
