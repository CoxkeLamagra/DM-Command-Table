import type { DatabaseSync } from "node:sqlite";
import { createPlayerRepository } from "./players-repository.ts";
import { createSessionRepository } from "./sessions-repository.ts";
import { createStoryRepository } from "./stories-repository.ts";
export function createContentRepository(database: DatabaseSync) {
  return {
    ...createPlayerRepository(database),
    ...createSessionRepository(database),
    ...createStoryRepository(database),
  };
}
