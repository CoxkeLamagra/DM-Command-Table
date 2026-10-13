import {
  monsterSchema,
  playerSchema,
  preparedEncounterFields,
  preparedEncounterFits,
  revisionSchema,
  sessionSchema,
  storySchema,
} from "../http/schemas.ts";
import { sanitizeRichText } from "../security/sanitize-rich-text.ts";
export const revisionedPlayer = playerSchema.extend({
  revision: revisionSchema,
});
export const revisionedSession = sessionSchema.extend({
  revision: revisionSchema,
});
export const revisionedStory = storySchema.extend({ revision: revisionSchema });
export const revisionedMonster = monsterSchema.extend({
  revision: revisionSchema,
});
export const revisionedPrepared = preparedEncounterFields
  .extend({
    revision: revisionSchema,
  })
  .refine(
    preparedEncounterFits,
    "Prepared encounters support at most 10,000 combatants.",
  );

export function clean<T extends Record<string, unknown>>(
  input: T,
  fields: (keyof T)[],
): T {
  const result = { ...input };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === "string")
      result[field] = sanitizeRichText(value) as T[keyof T];
  }
  return result;
}
