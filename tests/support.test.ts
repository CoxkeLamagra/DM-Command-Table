import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import {
  createSupportRepository,
  searchExpression,
} from "../server/support/support-repository.ts";

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const now = Date.now();
  database
    .prepare(
      `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES ('owner', 'Owner', 'owner', 'hash', 1, ?, ?)`,
    )
    .run(now, now);
  const campaign = createCampaignRepository(database).create("owner", {
    name: "Campaign",
  });
  return { database, campaign, support: createSupportRepository(database) };
}

test("session templates remain private to their local owner", () => {
  const { database, support } = fixture();
  const template = support.saveTemplate("owner", {
    name: "Mystery",
    content: "Clues, suspects, reveal",
  });
  assert.deepEqual(support.listTemplates("owner"), [template]);
  assert.deepEqual(support.listTemplates("someone-else"), []);
  support.deleteTemplate("owner", template.id);
  assert.deepEqual(support.listTemplates("owner"), []);
  database.close();
});

test("campaign search is isolated and supports multi-term prefixes", () => {
  const { database, campaign, support } = fixture();
  support.indexResource(
    campaign.id,
    "session",
    "s1",
    "Moonlit road",
    "The party met a silver dragon",
  );
  support.indexResource(
    campaign.id,
    "story",
    "b1",
    "Hidden crown",
    "A different mystery",
  );
  const results = support.search(campaign.id, "owner", "silver dra");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.resourceId, "s1");
  assert.equal(
    searchExpression(' silver "dragon" '),
    '"silver"* AND "dragon"*',
  );
  database.close();
});

test("screenshot references are explicit normalized relationships", () => {
  const { database, campaign, support } = fixture();
  database
    .prepare(
      `INSERT INTO screenshots
      (id, filename, original_name, mime_type, size, uploaded_by, created_at)
     VALUES ('shot', 'shot.webp', 'shot.png', 'image/webp', 100, 'owner', ?)`,
    )
    .run(Date.now());
  support.setScreenshotReferences(campaign.id, "owner", "session", "s1", [
    "shot",
    "shot",
  ]);
  const count = database
    .prepare(
      "SELECT COUNT(*) AS count FROM screenshot_references WHERE screenshot_id = 'shot'",
    )
    .get() as { count: number };
  assert.equal(count.count, 1);
  database.close();
});

test("search distinguishes NPCs and applies type filters before the result limit", async () => {
  const { createContentRepository } =
    await import("../server/content/content-repository.ts");
  const { database, campaign, support } = fixture();
  const content = createContentRepository(database);
  const input = {
    race: "",
    className: "",
    level: null,
    hitPoints: null,
    armorClass: null,
    notes: "",
  };
  for (let index = 0; index < 35; index++)
    content.createPlayer(campaign.id, "owner", {
      ...input,
      name: `Shared player ${index}`,
      kind: "player",
    });
  const npc = content.createPlayer(campaign.id, "owner", {
    ...input,
    name: "Shared guide",
    kind: "npc",
  });
  const results = support.search(campaign.id, "owner", "Shared", 1, "npc");
  assert.equal(results.length, 1);
  assert.equal(results[0].resourceId, npc.id);
  assert.equal(results[0].resourceType, "npc");
  assert.ok(
    support
      .search(campaign.id, "owner", "Shared", 100, "player")
      .every(
        ({ resourceType, resourceId }) =>
          resourceType === "player" && resourceId !== npc.id,
      ),
  );
  content.updatePlayer(campaign.id, "owner", npc.id, npc.revision, {
    ...input,
    name: npc.name,
    kind: "player",
  });
  assert.equal(
    support.search(campaign.id, "owner", "Shared", 100, "npc").length,
    0,
  );
  database.close();
});
