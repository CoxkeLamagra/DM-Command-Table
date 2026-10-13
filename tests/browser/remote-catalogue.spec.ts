import { test, expect } from "@playwright/test";

test("remote catalogue connects only on request and imports searchable monster previews", async ({
  page,
}) => {
  const requests: string[] = [];
  const payloads: Record<string, unknown> = {
    "/search/index.json": {
      m: { s: { MM: 1 } },
      x: [{ c: 1, n: "Remote goblin", s: 1 }],
    },
    "/data/bestiary/index.json": { MM: "bestiary-mm.json" },
    "/data/bestiary/bestiary-mm.json": {
      monster: [
        {
          name: "Remote goblin",
          source: "MM",
          type: "humanoid",
          cr: "1/4",
          ac: [15],
          hp: { average: 7 },
        },
      ],
    },
  };
  await page.route("https://dnd5e.lamagra.link/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    return route.fulfill({
      json: payloads[path],
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-offline");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("button", { name: "Bestiary", exact: true }).click();
  await page
    .getByRole("button", { name: "Import monsters", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  expect(requests).toEqual([]);
  await dialog
    .getByRole("button", { name: "Connect to remote catalogue", exact: true })
    .click();
  await expect(
    dialog.getByText("Remote catalogue: 1 monsters indexed"),
  ).toBeVisible();
  await dialog.getByPlaceholder("Type at least two characters…").fill("goblin");
  await expect(
    dialog.getByText(/CR 1\/4 · humanoid · AC 15 · HP 7/),
  ).toBeVisible();
  await dialog.getByText("Remote goblin", { exact: true }).click();
  await dialog
    .getByRole("button", { name: "Import selected (1)", exact: true })
    .click();
  await expect(
    page.getByText("Import complete: 1 added, 0 replaced, 0 discarded", {
      exact: true,
    }),
  ).toBeVisible();
  expect(requests.sort()).toEqual(Object.keys(payloads).sort());
});
