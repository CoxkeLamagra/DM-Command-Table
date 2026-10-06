import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const databasePath = path.resolve(
  process.env.DM_COMMAND_TABLE_V6_DB_PATH ??
    path.join(root, "data", "dm-command-table-v6.sqlite"),
);
const uploadPath = path.resolve(
  process.env.DM_COMMAND_TABLE_V6_UPLOAD_PATH ??
    path.join(path.dirname(databasePath), "uploads-v6"),
);

await access(databasePath);
const database = new DatabaseSync(databasePath, { readOnly: true });
try {
  const result = database.prepare("PRAGMA quick_check").get();
  if (!result || Object.values(result)[0] !== "ok") {
    throw new Error(`SQLite integrity check failed: ${JSON.stringify(result)}`);
  }
  const rows = database.prepare("SELECT filename FROM screenshots").all();
  const expected = new Set(rows.map(({ filename }) => filename));
  const actual = new Set(
    await readdir(uploadPath).catch((error) => {
      if (error?.code === "ENOENT") return [];
      throw error;
    }),
  );
  const missing = [...expected].filter((filename) => !actual.has(filename));
  const orphaned = [...actual].filter((filename) => !expected.has(filename));
  if (missing.length || orphaned.length) {
    console.error(JSON.stringify({ missing, orphaned }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(
      `Storage is healthy (${expected.size} screenshot files checked).`,
    );
  }
} finally {
  database.close();
}
