import { test, expect } from "@playwright/test";

test("remote catalogue connects automatically and imports searchable monster previews", async ({
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
          name: "Choice creature",
          source: "MM",
          type: { type: { choose: ["celestial", "fiend"] } },
          action: null,
        },
        {
          hasToken: true,
          name: "Remote goblin",
          source: "MM",
          type: "humanoid",
          cr: "1/4",
          ac: [15],
          hp: { average: 7, formula: "2d6" },
          str: 8,
          dex: 14,
          con: 10,
          int: 10,
          wis: 8,
          cha: 8,
          senses: ["darkvision 60 ft."],
          languages: ["Common", "Goblin"],
          action: [
            { name: "Scimitar", entries: ["Melee attack: 5 slashing damage."] },
          ],
        },
      ],
    },
  };
  await page.route("https://dnd5e.lamagra.link/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path.endsWith(".webp"))
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAARUlEQVRYhe3XsREAMAhC0YzGKOzi4GaLpHmFvXcifM40+3OOBcYJSoTxhsuIhhVXGEUcLyAZSFZQGli+ismoZlVO81wHF+/niHkNYwSEAAAAAElFTkSuQmCC",
          "base64",
        ),
        headers: { "access-control-allow-origin": "*" },
      });
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
  expect(requests).toEqual([]);
  await page
    .getByRole("button", { name: "Import monsters", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Connect to remote catalogue" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByText("Catalogue connected · 1 monsters indexed"),
  ).toBeVisible();
  await dialog.getByPlaceholder("Type at least two characters…").fill("goblin");
  await expect(
    dialog.getByText(/CR 1\/4 · humanoid · AC 15 · HP 7/),
  ).toBeVisible();
  await dialog
    .getByText("View stat block for Remote goblin", { exact: true })
    .click();
  const preview = dialog.getByRole("region", {
    name: "Remote goblin stat block",
  });
  await expect(
    preview.getByRole("img", { name: "Remote goblin token" }),
  ).toBeVisible();
  await expect(preview.getByText("14 (+2)", { exact: true })).toBeVisible();
  await expect(preview.getByText(/darkvision 60 ft./)).toBeVisible();
  await dialog
    .getByText("View stat block for Remote goblin", { exact: true })
    .click();
  await expect(preview).toBeHidden();
  await dialog.getByLabel("Select Remote goblin", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Import selected (1)", exact: true })
    .click();
  await expect(
    page.getByText("Import complete: 1 added, 0 replaced, 0 discarded", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Remote goblin/ }).click();
  await expect(
    dialog.getByRole("region", { name: "Remote goblin stat block" }),
  ).toBeVisible();
  await expect(
    dialog
      .getByRole("region", { name: "Remote goblin stat block" })
      .getByText(/Scimitar/),
  ).toBeVisible();
  const savedBlock = dialog.getByRole("region", {
    name: "Remote goblin stat block",
  });
  await expect(
    savedBlock.getByRole("img", { name: "Remote goblin token" }),
  ).toHaveAttribute("src", /^\/api\/screenshots\//);
  await dialog.getByText("Visual stat block", { exact: true }).click();
  await expect(savedBlock).toBeHidden();
  await dialog.getByText("Visual stat block", { exact: true }).click();
  await expect(savedBlock).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: test.info().outputPath("bestiary-stat-block.png"),
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await page
    .getByRole("button", { name: "Add combatants", exact: true })
    .click();
  await dialog.getByRole("tab", { name: "Bestiary", exact: true }).click();
  await dialog.getByLabel("Select Remote goblin", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Add selected (1)", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Remote goblin stat block" }),
  ).toBeVisible();
  const combatBlock = page.getByRole("region", {
    name: "Remote goblin stat block",
  });
  await page.getByText("Visual stat block", { exact: true }).click();
  await expect(combatBlock).toBeHidden();
  await page.getByText("Visual stat block", { exact: true }).click();
  await expect(combatBlock).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Combat: Saved", exact: true }),
  ).toBeVisible();
  await page.route("https://dnd5e.lamagra.link/**", (route) => route.abort());
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Remote goblin stat block" })
      .getByText(/darkvision 60 ft./),
  ).toBeVisible();
  const image = page.getByRole("img", { name: "Remote goblin token" });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(requests.sort()).toEqual(
    [
      ...Object.keys(payloads),
      "/img/bestiary/tokens/MM/Remote%20goblin.webp",
    ].sort(),
  );
  await page.getByRole("button", { name: "Bestiary", exact: true }).click();
  await page.getByRole("button", { name: /^Remote goblin/ }).click();
  page.on("dialog", (confirmation) => confirmation.accept());
  const deletePath = "**/monsters/bulk-delete";
  const dependencyError =
    "This monster is used by a prepared encounter. Remove it from all prepared encounters before deleting it from the Bestiary.";
  await page.route(deletePath, (route) =>
    route.fulfill({ status: 409, json: { error: dependencyError } }),
  );
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(dependencyError, { exact: true })).toBeVisible();
  await expect(
    page.getByText("Save conflict detected", { exact: true }),
  ).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.unroute(deletePath);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: /^Remote goblin/ }),
  ).toHaveCount(0);
});
