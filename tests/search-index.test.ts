import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrations, runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createContentRepository } from "../server/content/content-repository.ts";
import { createSupportRepository } from "../server/support/support-repository.ts";
import {
  removeSearchEntry,
  writeSearchEntry,
} from "../server/support/search-index.ts";

function schemaThreeDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  database.function("dmct_sha256", { deterministic: true }, (value) =>
    String(value),
  );
  for (const migration of migrations.slice(0, 3)) database.exec(migration.sql);
  database.exec(
    "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,applied_at INTEGER)",
  );
  for (const migration of migrations.slice(0, 3))
    database
      .prepare("INSERT INTO schema_migrations VALUES(?,?,1)")
      .run(migration.version, migration.name);
  return database;
}

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  runMigrations(database);
  database.exec(
    "INSERT INTO users VALUES('owner','Owner','owner','hash',1,1,1)",
  );
  const campaigns = createCampaignRepository(database);
  return {
    database,
    first: campaigns.create("owner", { name: "First" }),
    second: campaigns.create("owner", { name: "Second" }),
    content: createContentRepository(database),
    support: createSupportRepository(database),
  };
}

/** Every FTS row has exactly one lookup row pointing at it, and vice versa. */
function assertInSync(database: DatabaseSync) {
  const counts = database
    .prepare(
      `SELECT (SELECT COUNT(*) FROM search_index) AS fts,
              (SELECT COUNT(*) FROM search_index_rows) AS lookup,
              (SELECT COUNT(*) FROM search_index_rows r JOIN search_index s
                 ON s.rowid = r.search_rowid
                AND s.campaign_id = r.campaign_id
                AND s.resource_type = r.resource_type
                AND s.resource_id = r.resource_id) AS matched`,
    )
    .get() as { fts: number; lookup: number; matched: number };
  assert.equal(counts.lookup, counts.fts);
  assert.equal(counts.matched, counts.fts);
}

const player = {
  name: "Shadowheart",
  race: "Half-Elf",
  className: "Cleric",
  level: 5,
  hitPoints: 40,
  armorClass: 18,
  notes: "Silver moon",
};

test("migration 4 maps existing search entries, removes duplicates and keeps results", () => {
  const database = schemaThreeDatabase();
  try {
    const insert = database.prepare(
      "INSERT INTO search_index (campaign_id,resource_type,resource_id,title,content) VALUES (?,?,?,?,?)",
    );
    insert.run("a", "session", "s1", "Old title", "stale text");
    insert.run("a", "session", "s1", "Moonlit road", "silver dragon");
    insert.run("a", "story", "b1", "Hidden crown", "mystery");
    insert.run("b", "session", "s1", "Other campaign", "silver coins");
    runMigrations(database);
    runMigrations(database);
    assertInSync(database);
    const rows = database
      .prepare(
        "SELECT campaign_id AS c, resource_type AS t, resource_id AS id, title FROM search_index ORDER BY rowid",
      )
      .all()
      .map((row) => ({ ...row }));
    assert.deepEqual(rows, [
      { c: "a", t: "session", id: "s1", title: "Moonlit road" },
      { c: "a", t: "story", id: "b1", title: "Hidden crown" },
      { c: "b", t: "session", id: "s1", title: "Other campaign" },
    ]);
    assert.equal(
      (
        database
          .prepare("SELECT MAX(version) AS version FROM schema_migrations")
          .get() as { version: number }
      ).version,
      4,
    );
  } finally {
    database.close();
  }
});

test("record writes replace only their own search entry", () => {
  const { database, first, second, content, support } = fixture();
  try {
    const mine = content.createPlayer(first.id, "owner", player);
    const other = content.createPlayer(second.id, "owner", player);
    assertInSync(database);
    content.updatePlayer(first.id, "owner", mine.id, mine.revision, {
      ...player,
      notes: "Golden sun",
    });
    assertInSync(database);
    assert.deepEqual(
      support.search(first.id, "owner", "golden").map((r) => r.resourceId),
      [mine.id],
    );
    assert.deepEqual(support.search(first.id, "owner", "silver"), []);
    assert.deepEqual(
      support.search(second.id, "owner", "silver").map((r) => r.resourceId),
      [other.id],
    );
    content.deletePlayer(first.id, "owner", mine.id);
    assertInSync(database);
    assert.deepEqual(support.search(first.id, "owner", "golden"), []);
    assert.equal(support.search(second.id, "owner", "silver").length, 1);
  } finally {
    database.close();
  }
});

test("search entry helpers are idempotent and roll back with their transaction", () => {
  const { database, first, support } = fixture();
  try {
    removeSearchEntry(database, first.id, "session", "missing");
    writeSearchEntry(database, first.id, "session", "s1", "Road", "silver");
    writeSearchEntry(database, first.id, "session", "s1", "Road", "golden");
    assertInSync(database);
    assert.equal(support.search(first.id, "owner", "silver").length, 0);
    assert.equal(support.search(first.id, "owner", "golden").length, 1);
    database.exec("BEGIN");
    writeSearchEntry(database, first.id, "session", "s1", "Road", "copper");
    database.exec("ROLLBACK");
    assertInSync(database);
    assert.equal(support.search(first.id, "owner", "golden").length, 1);
  } finally {
    database.close();
  }
});

test("search entry lookups use the primary key instead of scanning the index", () => {
  const { database } = fixture();
  try {
    const plan = database
      .prepare(
        "EXPLAIN QUERY PLAN SELECT search_rowid FROM search_index_rows WHERE campaign_id=? AND resource_type=? AND resource_id=?",
      )
      .all("c", "t", "id")
      .map((row) => String((row as { detail: string }).detail))
      .join("\n");
    assert.match(plan, /SEARCH search_index_rows USING PRIMARY KEY/);
  } finally {
    database.close();
  }
});
