import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import test from "node:test";

test("screenshots remain local and support save, read, list, and delete", async () => {
  const root = `/tmp/dm-command-table-screenshots-${process.pid}`;
  process.env.DM_COMMAND_TABLE_DB_PATH = `${root}/database.sqlite`;
  process.env.DM_COMMAND_TABLE_UPLOAD_PATH = `${root}/uploads`;
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

  const bytes = new Uint8Array([137, 80, 78, 71]);
  const saved = await saveScreenshot(
    new File([bytes], "screen.png", { type: "image/png" }),
    "user",
  );
  assert.equal(listScreenshots()[0].id, saved.id);
  const loaded = await readScreenshot(saved.id);
  assert.deepEqual(loaded?.bytes, Buffer.from(bytes));
  assert.equal(await deleteScreenshot(saved.id), true);
  assert.equal(await readScreenshot(saved.id), null);

  getDatabase().close();
  await rm(root, { recursive: true, force: true });
});
