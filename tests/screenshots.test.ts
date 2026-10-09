import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createContentRepository } from "../server/content/content-repository.ts";
import {
  deleteScreenshot,
  extractScreenshotIds,
  listScreenshots,
} from "../server/media/screenshots.ts";

test("embedded screenshots become protected campaign resources", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const now = Date.now();
  const addUser = database.prepare(
    `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', 0, ?, ?)`,
  );
  addUser.run("owner", "Owner", "owner", now, now);
  addUser.run("viewer", "Viewer", "viewer", now, now);
  const campaign = createCampaignRepository(database).create("owner", {
    name: "Campaign",
  });
  database
    .prepare(
      "INSERT INTO campaign_members (campaign_id,user_id,role,created_at,updated_at) VALUES (?,?,'viewer',?,?)",
    )
    .run(campaign.id, "viewer", now, now);
  const screenshotId = crypto.randomUUID();
  database
    .prepare(
      "INSERT INTO screenshots (id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?)",
    )
    .run(
      screenshotId,
      `${screenshotId}.webp`,
      "map.png",
      "image/webp",
      10,
      "owner",
      now,
    );
  const content = createContentRepository(database);
  content.createSession(campaign.id, "owner", {
    title: "Map",
    date: "",
    status: "planned",
    sortOrder: 0,
    notes: `<p>Map</p><img src="/api/screenshots/${screenshotId}">`,
  });
  assert.deepEqual(
    extractScreenshotIds(`<img src='/api/screenshots/${screenshotId}'>`),
    [screenshotId],
  );
  assert.equal(listScreenshots(database, "viewer", false)[0]?.id, screenshotId);
  assert.equal(
    await deleteScreenshot(database, screenshotId, "owner", false),
    "referenced",
  );
  database.close();
});

test("image uploads reject SVG payloads disguised as PNG", async () => {
  const { saveScreenshot } = await import("../server/media/screenshots.ts");
  const database = new DatabaseSync(":memory:");
  runMigrations(database);
  const file = new File(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    ],
    "fake.png",
    { type: "image/png" },
  );
  await assert.rejects(
    () => saveScreenshot(database, file, "owner"),
    /not a valid supported image/,
  );
  assert.equal(
    (
      database.prepare("SELECT COUNT(*) AS count FROM screenshots").get() as {
        count: number;
      }
    ).count,
    0,
  );
  database.close();
});
