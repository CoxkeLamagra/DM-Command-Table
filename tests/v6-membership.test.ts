import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { createV6CampaignRepository } from "../server/v6/campaign-repository.ts";
import { createMembershipRepository } from "../server/v6/membership-repository.ts";
import { AuthorizationError } from "../server/v6/access.ts";

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  runMigrations(database);
  const now = Date.now();
  const insert = database.prepare(
    `INSERT INTO users
      (id, display_name, username, password_hash, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', 0, ?, ?)`,
  );
  insert.run("owner", "Owner", "owner", now, now);
  insert.run("editor", "Editor", "editor", now, now);
  insert.run("viewer", "Viewer", "viewer", now, now);
  const campaign = createV6CampaignRepository(database).create("owner", {
    name: "Shared campaign",
  });
  return {
    database,
    campaign,
    memberships: createMembershipRepository(database),
  };
}

test("owners can grant, change, and revoke campaign access", () => {
  const { database, campaign, memberships } = fixture();
  let members = memberships.grant(campaign.id, "owner", "viewer", "viewer");
  assert.deepEqual(members.map(({ username, role }) => ({ username, role })), [
    { username: "owner", role: "owner" },
    { username: "viewer", role: "viewer" },
  ]);
  members = memberships.grant(campaign.id, "owner", "viewer", "editor");
  assert.equal(members.find(({ username }) => username === "viewer")?.role, "editor");
  members = memberships.revoke(campaign.id, "owner", "viewer");
  assert.equal(members.length, 1);
  database.close();
});

test("ownership transfer keeps the previous owner as an editor", () => {
  const { database, campaign, memberships } = fixture();
  memberships.grant(campaign.id, "owner", "editor", "editor");
  const members = memberships.transferOwnership(campaign.id, "owner", "editor");
  assert.equal(members.find(({ username }) => username === "editor")?.role, "owner");
  assert.equal(members.find(({ username }) => username === "owner")?.role, "editor");
  assert.throws(() => memberships.list(campaign.id, "owner"), AuthorizationError);
  database.close();
});

