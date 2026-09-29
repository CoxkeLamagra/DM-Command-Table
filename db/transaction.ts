import type { DatabaseSync } from "node:sqlite";

export function runTransaction<T>(
  database: DatabaseSync,
  operation: () => T,
): T {
  const nested = database.isTransaction;
  const savepoint = `dmct_${crypto.randomUUID().replaceAll("-", "")}`;
  database.exec(nested ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec(nested ? `RELEASE SAVEPOINT ${savepoint}` : "COMMIT");
    return result;
  } catch (error) {
    if (nested) {
      database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      database.exec(`RELEASE SAVEPOINT ${savepoint}`);
    } else {
      database.exec("ROLLBACK");
    }
    throw error;
  }
}
