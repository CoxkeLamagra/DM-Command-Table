import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import test from "node:test";

test("screenshots remain local and support save, read, list, and delete", async () => {
  const root = `/tmp/dm-command-table-screenshots-${process.pid}`;
  process.env.DM_COMMAND_TABLE_DB_PATH = `${root}/database.sqlite`;
  process.env.DM_COMMAND_TABLE_UPLOAD_PATH = `${root}/uploads`;
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const { getDatabase } = await import("../db/sqlite.ts");
  const {
    deleteScreenshot,
    listScreenshots,
    readScreenshot,
    saveScreenshot,
  } = await import("../server/screenshots/repository.ts");
  const now = Date.now();
  getDatabase()
    .prepare(
      "INSERT INTO users (id, display_name, username, password_hash, is_admin, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run("user", "User", "user", "hash", 1, now);

  getDatabase()
    .prepare(
      "INSERT INTO users (id, display_name, username, password_hash, is_admin, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run("other", "Other", "other", "hash", 0, now);

  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const saved = await saveScreenshot(
    new File([bytes], "screen.png", { type: "image/png" }),
    "user",
  );
  assert.equal(listScreenshots("user")[0].id, saved.id);
  assert.equal(listScreenshots("other").length, 0);
  assert.equal(listScreenshots("other", true)[0].id, saved.id);
  const loaded = await readScreenshot(saved.id, "user");
  assert.equal(loaded?.mimeType, "image/webp");
  assert.ok(loaded?.bytes.length);
  assert.equal(await readScreenshot(saved.id, "other"), null);

  getDatabase()
    .prepare(
      "INSERT INTO campaigns (id, owner_id, name, payload, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      "shared-campaign",
      "user",
      "Shared",
      JSON.stringify({ notes: `[[screenshot:${saved.id}]]` }),
      now,
      now,
    );
  getDatabase()
    .prepare(
      "INSERT INTO campaign_members (campaign_id, user_id, member_username, role, added_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run("shared-campaign", "other", "other", "viewer", now);
  assert.equal(listScreenshots("other")[0].id, saved.id);
  assert.ok(await readScreenshot(saved.id, "other"));

  assert.equal(await deleteScreenshot(saved.id), true);
  assert.equal(await readScreenshot(saved.id, "user"), null);

  getDatabase().close();
  await rm(root, { recursive: true, force: true });
});
