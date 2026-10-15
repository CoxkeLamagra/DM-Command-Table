import type { Monster } from "@/domain/types";
import { requestJson, json } from "./transport";
export async function listMonsters(campaignId: string): Promise<Monster[]> {
  return (
    await requestJson<{ monsters: Monster[] }>(
      `/api/campaigns/${campaignId}/monsters`,
    )
  ).monsters;
}

export async function importMonster(
  campaignId: string,
  monster: Omit<
    Monster,
    "id" | "campaignId" | "tags" | "revision" | "createdAt" | "updatedAt"
  >,
): Promise<Monster> {
  return (
    await requestJson<{ monster: Monster }>(
      `/api/campaigns/${campaignId}/monsters`,
      json("POST", { ...monster, tagIds: [], catalogueImport: true }),
    )
  ).monster;
}

export async function updateMonster(
  campaignId: string,
  monster: Monster,
  catalogueImport = false,
): Promise<Monster> {
  return (
    await requestJson<{ monster: Monster }>(
      `/api/campaigns/${campaignId}/monsters/${monster.id}`,
      json("PATCH", {
        name: monster.name,
        type: monster.type,
        challengeRating: monster.challengeRating,
        armorClass: monster.armorClass,
        hitPoints: monster.hitPoints,
        speed: monster.speed,
        stats: monster.stats,
        token: monster.token ?? "",
        abilities: monster.abilities,
        spells: monster.spells,
        notes: monster.notes,
        spellSlots: monster.spellSlots,
        source: monster.source,
        favorite: monster.favorite,
        tagIds: monster.tags.map(({ id }) => id),
        revision: monster.revision,
        catalogueImport,
      }),
    )
  ).monster;
}

export async function deleteMonster(
  campaignId: string,
  id: string,
): Promise<void> {
  await requestJson(`/api/campaigns/${campaignId}/monsters/${id}`, {
    method: "DELETE",
  });
}
export async function createMonster(campaignId: string): Promise<Monster> {
  return (
    await requestJson<{ monster: Monster }>(
      `/api/campaigns/${campaignId}/monsters`,
      json("POST", {
        name: "New monster",
        type: "",
        challengeRating: "",
        armorClass: 10,
        hitPoints: 1,
        speed: "",
        stats: "",
        abilities: "",
        spells: "",
        notes: "",
        spellSlots: [],
        source: null,
        favorite: false,
        tagIds: [],
      }),
    )
  ).monster;
}
