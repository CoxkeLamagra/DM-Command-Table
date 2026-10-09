import { storagePaths, assertStorageReady } from "../server/config.ts";
import { chmodSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrations, runMigrations } from "./migrations.ts";

let database: DatabaseSync | undefined;

export function openDatabase(databasePath: string): DatabaseSync {
  const resolved = path.resolve(databasePath);
  mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  const opened = new DatabaseSync(resolved);
  try {
    chmodSync(resolved, 0o600);
    configure(opened);
    runMigrations(opened);
    verifySchema(opened);
    return opened;
  } catch (error) {
    opened.close();
    throw error;
  }
}

export function getDatabase(): DatabaseSync {
  if (database) return database;
  assertStorageReady();
  database = openDatabase(storagePaths().database);
  return database;
}

export function currentSchemaVersion(databaseValue = getDatabase()): number {
  const row = databaseValue
    .prepare(
      "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations",
    )
    .get() as { version: number };
  return row.version;
}

export function expectedSchemaVersion(): number {
  return migrations.at(-1)?.version ?? 0;
}

function configure(databaseValue: DatabaseSync): void {
  databaseValue.exec("PRAGMA journal_mode = WAL");
  databaseValue.exec("PRAGMA foreign_keys = ON");
  databaseValue.exec("PRAGMA busy_timeout = 5000");
  databaseValue.exec("PRAGMA synchronous = NORMAL");
}

function verifySchema(databaseValue: DatabaseSync): void {
  const actual = currentSchemaVersion(databaseValue);
  const expected = expectedSchemaVersion();
  if (actual !== expected)
    throw new Error(
      ` database schema ${actual} does not match expected version ${expected}.`,
    );
  const names = databaseValue
    .prepare("SELECT version,name FROM schema_migrations ORDER BY version")
    .all() as Array<{ version: number; name: string }>;
  if (names.some((value, index) => value.name !== migrations[index]?.name))
    throw new Error(
      "Unsupported database format. Use a fresh data directory for this release.",
    );
  const violations = databaseValue.prepare("PRAGMA foreign_key_check").all();
  if (violations.length)
    throw new Error(" database contains foreign-key violations.");
}
