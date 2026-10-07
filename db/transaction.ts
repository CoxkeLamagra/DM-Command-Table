import type { DatabaseSync } from "node:sqlite";

const activeTransactions = new WeakSet<DatabaseSync>();

export function runTransaction<T>(
  database: DatabaseSync,
  operation: () => T,
): T {
  const nested = database.isTransaction || activeTransactions.has(database);
  const savepoint = `dmct_${crypto.randomUUID().replaceAll("-", "")}`;
  database.exec(nested ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
  if (!nested) activeTransactions.add(database);
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
  } finally {
    if (!nested) activeTransactions.delete(database);
  }
}
