import type { Monster } from "@/features/campaign/types";
import {
  convertRemoteMonster,
  monsterIdentity,
  type FiveEToolsMonster,
} from "./fiveetools.ts";

export async function applyMonsterImports(
  existingMonsters: Monster[],
  selected: FiveEToolsMonster[],
  createId: () => string,
  decideReplacement: (existing: Monster, incoming: Monster) => Promise<boolean>,
) {
  const monsters = [...existingMonsters];
  let added = 0;
  let replaced = 0;
  let discarded = 0;
  for (const remote of selected) {
    const incoming = convertRemoteMonster(remote, createId);
    const duplicateIndex = monsters.findIndex(
      (existing) => monsterIdentity(existing) === monsterIdentity(incoming),
    );
    if (duplicateIndex < 0) {
      monsters.push(incoming);
      added++;
      continue;
    }
    const existing = monsters[duplicateIndex];
    if (await decideReplacement(existing, incoming)) {
      monsters[duplicateIndex] = {
        ...incoming,
        id: existing.id,
        notes: existing.notes,
      };
      replaced++;
    } else discarded++;
  }
  return { monsters, added, replaced, discarded };
}
