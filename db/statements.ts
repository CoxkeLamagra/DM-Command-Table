import type { DatabaseSync, StatementSync } from "node:sqlite";
const MAX_STATEMENTS = 256;
const connections = new WeakMap<DatabaseSync, Map<string, StatementSync>>();
// Cache executable SQL only. Bindings, authorization checks and returned rows remain fresh.
export function statement(database: DatabaseSync, sql: string): StatementSync {
  let cache = connections.get(database);
  if (!cache) {
    cache = new Map();
    connections.set(database, cache);
  }
  const existing = cache.get(sql);
  if (existing) {
    cache.delete(sql);
    cache.set(sql, existing);
    return existing;
  }
  const prepared = database.prepare(sql);
  cache.set(sql, prepared);
  if (cache.size > MAX_STATEMENTS) cache.delete(cache.keys().next().value!);
  return prepared;
}
