import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrations, runMigrations } from "./migrations.ts";

const DEFAULT_V6_DATABASE_PATH = path.join(
  process.cwd(),
  "data",
  "dm-command-table-v6.sqlite",
);

let database: DatabaseSync | undefined;

export function openV6Database(databasePath: string): DatabaseSync {
  const resolved = path.resolve(databasePath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  const opened = new DatabaseSync(resolved);
  configure(opened);
  runMigrations(opened);
  verifySchema(opened);
  return opened;
}

export function getV6Database(): DatabaseSync {
  if (database) return database;
  database = openV6Database(
    process.env.DM_COMMAND_TABLE_V6_DB_PATH || DEFAULT_V6_DATABASE_PATH,
  );
  return database;
}

export function currentV6SchemaVersion(databaseValue = getV6Database()): number {
  const row = databaseValue
    .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
    .get() as { version: number };
  return row.version;
}

export function expectedV6SchemaVersion(): number {
  return migrations.at(-1)?.version ?? 0;
}

function configure(databaseValue: DatabaseSync): void {
  databaseValue.exec("PRAGMA journal_mode = WAL");
  databaseValue.exec("PRAGMA foreign_keys = ON");
  databaseValue.exec("PRAGMA busy_timeout = 5000");
  databaseValue.exec("PRAGMA synchronous = NORMAL");
}

function verifySchema(databaseValue: DatabaseSync): void {
  const actual = currentV6SchemaVersion(databaseValue);
  const expected = expectedV6SchemaVersion();
  if (actual !== expected)
    throw new Error(`V6 database schema ${actual} does not match expected version ${expected}.`);
  const violations = databaseValue.prepare("PRAGMA foreign_key_check").all();
  if (violations.length)
    throw new Error("V6 database contains foreign-key violations.");
}

