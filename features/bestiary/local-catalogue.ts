import { z } from "zod";
import type { FiveEToolsMonster } from "./fiveetools.ts";

const number = z.number().finite();
const entries = z
  .array(z.unknown())
  .nullish()
  .transform((value) => value ?? undefined);
const monster = z.object({
  hasToken: z.boolean().optional(),
  token: z
    .object({ name: z.string().max(200), source: z.string().max(200) })
    .optional(),
  tokenUrl: z.string().max(2000).optional(),
  tokenHref: z
    .object({
      type: z.string().optional(),
      url: z.string().max(2000).optional(),
      path: z.string().max(2000).optional(),
    })
    .optional(),
  name: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(100),
  alignment: entries,
  save: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((value) => value ?? undefined),
  skill: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((value) => value ?? undefined),
  vulnerable: entries,
  resist: entries,
  immune: entries,
  conditionImmune: entries,
  senses: entries,
  languages: entries,
  passive: z.union([number, z.string()]).optional(),
  pbNote: z.string().optional(),
  size: z.array(z.string()).optional(),
  type: z
    .union([
      z.string(),
      z.object({
        type: z
          .union([
            z.string(),
            z
              .object({ choose: z.array(z.string()).min(1) })
              .transform((value) => value.choose.join(" or ")),
          ])
          .optional(),
        tags: z.array(z.unknown()).optional(),
      }),
    ])
    .optional(),
  ac: z
    .array(
      z.union([
        number,
        z.object({
          ac: number.optional(),
          from: entries,
          condition: z.string().optional(),
        }),
      ]),
    )
    .optional(),
  hp: z
    .object({ average: number.optional(), formula: z.string().optional() })
    .optional(),
  speed: z
    .record(
      z.string(),
      z.union([number, z.boolean(), z.object({ number: number.optional() })]),
    )
    .optional(),
  str: number.optional(),
  dex: number.optional(),
  con: number.optional(),
  int: number.optional(),
  wis: number.optional(),
  cha: number.optional(),
  cr: z
    .union([
      z.string(),
      number,
      z.object({ cr: z.union([z.string(), number]).optional() }),
    ])
    .optional(),
  trait: entries,
  action: entries,
  bonus: entries,
  reaction: entries,
  legendary: entries,
  mythic: entries,
  spellcasting: entries,
});

export function catalogueIdentity(
  item: Pick<FiveEToolsMonster, "name" | "source">,
): string {
  return `${item.name.trim()}::${item.source.trim()}`.toLowerCase();
}

export function parseCatalogue(text: string): FiveEToolsMonster[] {
  if (new TextEncoder().encode(text).length > 10 * 1024 * 1024)
    throw new Error("Catalogue files must be no larger than 10 MB.");
  const result = z
    .object({ monster: z.array(monster).min(1).max(10000) })
    .safeParse(JSON.parse(text));
  if (!result.success)
    throw new Error(
      "Select a valid 5etools monster JSON file (up to 10,000 entries).",
    );
  return [
    ...new Map(
      result.data.monster.map((item) => [catalogueIdentity(item), item]),
    ).values(),
  ];
}

export function searchCatalogue(
  query: string,
  catalogue: FiveEToolsMonster[],
): FiveEToolsMonster[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  return catalogue
    .filter((item) =>
      `${item.name} ${item.source}`.toLowerCase().includes(term),
    )
    .slice(0, 50);
}
