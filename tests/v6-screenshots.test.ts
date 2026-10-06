import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createV6CampaignRepository } from "../server/v6/campaign-repository.ts";
import { createContentRepository } from "../server/v6/content-repository.ts";
import {
  deleteV6Screenshot,
  extractScreenshotIds,
  listV6Screenshots,
} from "../server/v6/screenshots.ts";

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
  const campaign = createV6CampaignRepository(database).create("owner", {
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
    notes: `<p>Map</p><img src="/api/v6-screenshots/${screenshotId}">`,
  });
  assert.deepEqual(
    extractScreenshotIds(`<img src='/api/v6-screenshots/${screenshotId}'>`),
    [screenshotId],
  );
  assert.equal(
    listV6Screenshots(database, "viewer", false)[0]?.id,
    screenshotId,
  );
  assert.equal(
    await deleteV6Screenshot(database, screenshotId, "owner", false),
    "referenced",
  );
  database.close();
});
