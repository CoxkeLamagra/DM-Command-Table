import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page) {
  const login = await page.request.post("/api/auth", {
    data: {
      action: "login",
      username: "browser-offline",
      password: "browser-test-pass",
    },
  });
  expect(login.ok()).toBe(true);
  const campaign = (
    await (
      await page.request.post("/api/campaigns", {
        data: { name: "Read budget regression" },
      })
    ).json()
  ).campaign;
  const monster = (
    await (
      await page.request.post(`/api/campaigns/${campaign.id}/monsters`, {
        data: {
          name: "Detail dragon",
          type: "Dragon",
          challengeRating: "1",
          armorClass: 12,
          hitPoints: 20,
          speed: "30 ft",
          stats: "<p>Kept stats</p>",
          abilities: "<p>Kept attack</p>",
          spells: "",
          notes: "<p>Kept notes</p>",
          spellSlots: [],
          source: "MM",
          favorite: false,
        },
      })
    ).json()
  ).monster;
  return { campaign, monster };
}

test("combat detail loading locks edits and preserves existing combatants", async ({
  page,
}) => {
  const { campaign, monster } = await fixture(page);
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  let requested!: () => void;
  const started = new Promise<void>((r) => (requested = r));
  try {
    await page.goto(`/campaigns/${campaign.id}/combat`);
    await page
      .getByRole("button", { name: "Add combatants", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Single-use", exact: true }).click();
    await dialog.getByLabel("Single-use name").fill("Race guest");
    await dialog.getByLabel("Single-use hit points").fill("13");
    await dialog
      .getByRole("button", { name: "Add single-use combatant", exact: true })
      .click();
    await expect(
      page.getByLabel("Current hit points", { exact: true }),
    ).toHaveValue("13");
    await page.route(`**/monsters/${monster.id}`, async (route) => {
      requested();
      await hold;
      await route.continue();
    });
    await page
      .getByRole("button", { name: "Add combatants", exact: true })
      .click();
    await dialog.getByRole("tab", { name: "Bestiary", exact: true }).click();
    await dialog.getByLabel("Select Detail dragon").check();
    await dialog
      .getByRole("button", { name: "Add selected (1)", exact: true })
      .click();
    await started;
    await expect(
      page.getByLabel("Current hit points", { exact: true }),
    ).toBeDisabled();
    release();
    await expect(
      page.getByText("Detail dragon #1", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Race guest #1", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Kept attack", { exact: true })).toBeVisible();
  } finally {
    release?.();
    await page.request.delete(`/api/campaigns/${campaign.id}`);
  }
});

test("prepared customization retains edits made while full monster details load", async ({
  page,
}) => {
  const { campaign, monster } = await fixture(page);
  const session = (
    await (
      await page.request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: {
          title: "Detail session",
          date: "",
          notes: "",
          status: "planned",
          sortOrder: 0,
        },
      })
    ).json()
  ).session;
  const entryA = crypto.randomUUID(),
    entryB = crypto.randomUUID();
  await page.request.post(
    `/api/campaigns/${campaign.id}/sessions/${session.id}/encounters`,
    {
      data: {
        name: "Detail encounter",
        notes: "",
        sortOrder: 0,
        monsters: [
          {
            id: entryA,
            monsterId: monster.id,
            quantity: 1,
            displayNumber: 1,
            sortOrder: 0,
          },
          {
            id: entryB,
            monsterId: monster.id,
            quantity: 1,
            displayNumber: 2,
            sortOrder: 1,
          },
        ],
        combatants: [],
      },
    },
  );
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  let requested!: () => void;
  const started = new Promise<void>((r) => (requested = r));
  try {
    await page.goto(`/campaigns/${campaign.id}/sessions/${session.id}`);
    await page.getByRole("tab", { name: /^Encounters/ }).click();
    await page
      .locator("button[aria-expanded]")
      .filter({ hasText: "Detail encounter" })
      .click();
    await page.route(`**/monsters/${monster.id}`, async (route) => {
      requested();
      await hold;
      await route.continue();
    });
    await page
      .getByRole("button", {
        name: "Edit details for Detail dragon",
        exact: true,
      })
      .first()
      .click();
    await started;
    const secondRow = page
      .getByText("Detail dragon #2", { exact: true })
      .locator("..");
    await secondRow.getByRole("button").last().click();
    await expect(
      page.getByText("Detail dragon #2", { exact: true }),
    ).toHaveCount(0);
    release();
    await expect(page.getByLabel("Summary for Detail encounter")).toContainText(
      "1 combatant",
    );
    await expect(
      page.getByRole("button", {
        name: "Edit details for Detail dragon",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Detail dragon #2", { exact: true }),
    ).toHaveCount(0);
  } finally {
    release?.();
    await page.request.delete(`/api/campaigns/${campaign.id}`);
  }
});
