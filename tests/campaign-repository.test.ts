import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { RevisionConflictError } from "../server/http/conflicts.ts";

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const now = Date.now();
  database
    .prepare(
      `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    )
    .run("owner", "Owner", "owner", "hash", now, now);
  database
    .prepare(
      `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    )
    .run("viewer", "Viewer", "viewer", "hash", now, now);
  return { database, repository: createCampaignRepository(database) };
}

test("normalized campaigns use optimistic revisions and audit events", () => {
  const { database, repository } = fixture();
  const campaign = repository.create("owner", { name: "  Ravenloft  " });
  assert.equal(campaign.name, "Ravenloft");
  assert.equal(campaign.revision, 1);

  const updated = repository.update(campaign.id, "owner", 1, {
    notes: "Castle notes",
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.notes, "Castle notes");
  assert.throws(
    () => repository.update(campaign.id, "owner", 1, { name: "Stale" }),
    RevisionConflictError,
  );

  const events = database
    .prepare(
      "SELECT action FROM audit_events WHERE campaign_id = ? ORDER BY id",
    )
    .all(campaign.id) as Array<{ action: string }>;
  assert.deepEqual(
    events.map(({ action }) => action),
    ["created", "updated"],
  );
  database.close();
});

test("archived campaigns are separated without deleting them", () => {
  const { database, repository } = fixture();
  const campaign = repository.create("owner", { name: "Archive me" });
  repository.update(campaign.id, "owner", campaign.revision, {
    archived: true,
  });
  assert.equal(repository.list("owner").length, 0);
  assert.equal(repository.list("owner", { archived: true }).length, 1);
  database.close();
});
