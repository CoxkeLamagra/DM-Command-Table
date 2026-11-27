import { test, expect, type Page } from "@playwright/test";

const cors = { "access-control-allow-origin": "*" };
function site(name: string) {
  return {
    "/search/index.json": {
      m: { s: { MM: 1 } },
      x: [{ c: 1, n: name, s: 1 }],
    },
    "/data/bestiary/index.json": { MM: "bestiary-mm.json" },
    "/data/bestiary/bestiary-mm.json": {
      monster: [
        {
          name,
          source: "MM",
          type: "humanoid",
          cr: "1/8",
          ac: [12],
          hp: { average: 5, formula: "2d6-2" },
        },
      ],
    },
  } as Record<string, unknown>;
}

async function openImport(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-offline");
  await page.getByLabel("Password", { exact: true }).fill("browser-test-pass");
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("button", { name: "Bestiary", exact: true }).click();
  await page
    .getByRole("button", { name: "Import monsters", exact: true })
    .click();
  return page.getByRole("dialog");
}

test("bestiary import searches 5e.tools when dnd5e.lamagra.link has no match", async ({
  page,
}) => {
  const fallbackRequests: string[] = [];
  const primary = site("Primary goblin");
  const fallback = site("Fallback kobold");
  await page.route("https://dnd5e.lamagra.link/**", (route) =>
    route.fulfill({
      json: primary[new URL(route.request().url()).pathname],
      headers: cors,
    }),
  );
  await page.route("https://5e.tools/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    fallbackRequests.push(path);
    return route.fulfill({ json: fallback[path], headers: cors });
  });
  const dialog = await openImport(page);
  await expect(
    dialog.getByText("Catalogue connected · 1 monsters indexed"),
  ).toBeVisible();
  await dialog.getByPlaceholder("Type at least two characters…").fill("goblin");
  await expect(
    dialog.getByText("Primary goblin", { exact: true }),
  ).toBeVisible();
  expect(fallbackRequests).toEqual([]);
  await dialog.getByPlaceholder("Type at least two characters…").fill("kobold");
  await expect(
    dialog.getByText("Fallback kobold", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(/5e\.tools fallback: 1 monsters/),
  ).toBeVisible();
  await dialog.getByLabel("Select Fallback kobold", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Import selected (1)", exact: true })
    .click();
  await expect(
    page.getByText("Import complete: 1 added, 0 replaced, 0 discarded", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Fallback kobold/ }),
  ).toBeVisible();
});

test("bestiary import uses 5e.tools when dnd5e.lamagra.link is unreachable", async ({
  page,
}) => {
  const fallback = site("Fallback kobold");
  await page.route("https://dnd5e.lamagra.link/**", (route) => route.abort());
  await page.route("https://5e.tools/**", (route) =>
    route.fulfill({
      json: fallback[new URL(route.request().url()).pathname],
      headers: cors,
    }),
  );
  const dialog = await openImport(page);
  await expect(
    dialog.getByText(/Catalogue connected via 5e\.tools · 1 monsters indexed/),
  ).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByPlaceholder("Type at least two characters…").fill("kobold");
  await expect(
    dialog.getByText(/CR 1\/8 · humanoid · AC 12 · HP 5/),
  ).toBeVisible();
});
