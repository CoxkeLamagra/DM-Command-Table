import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyRuntimeMigrations, RUNTIME_SCHEMA } from "./runtime-schema.ts";

const DEFAULT_DATABASE_PATH = path.join(
  process.cwd(),
  "data",
  "dm-command-table.sqlite",
);

let database: DatabaseSync | undefined;

export function getDatabase(): DatabaseSync {
  if (database) return database;

  const databasePath = path.resolve(
    /* turbopackIgnore: true */
    process.env.DM_COMMAND_TABLE_DB_PATH || DEFAULT_DATABASE_PATH,
  );
  mkdirSync(path.dirname(databasePath), { recursive: true });

  database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec(RUNTIME_SCHEMA);
  applyRuntimeMigrations(database);

  return database;
}
