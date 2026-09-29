import type { DatabaseSync } from "node:sqlite";
import { createBestiaryRepository } from "./bestiary-repository.ts";
import { createV6CampaignRepository } from "./campaign-repository.ts";
import { createContentRepository } from "./content-repository.ts";
import { createEncounterRepository } from "./encounter-repository.ts";

export function exportV6Campaign(database: DatabaseSync, campaignId: string, actorId: string) {
  const campaign = createV6CampaignRepository(database).get(campaignId, actorId);
  if (!campaign) throw new Error("Campaign not found.");
  const content = createContentRepository(database);
  const bestiary = createBestiaryRepository(database);
  const encounters = createEncounterRepository(database);
  const sessions = content.listSessions(campaignId, actorId);
  return {
    format: "dm-command-table-v6" as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    campaign: { name: campaign.name, notes: campaign.notes },
    tags: bestiary.listTags(campaignId, actorId),
    monsters: bestiary.list(campaignId, actorId),
    players: content.listPlayers(campaignId, actorId),
    sessions: sessions.map((session) => ({
      ...session,
      encounters: encounters.listPrepared(campaignId, actorId, session.id),
    })),
    story: content.listStory(campaignId, actorId),
    combat: encounters.getCombat(campaignId, actorId),
  };
}

export function importV6Campaign(database: DatabaseSync, actorId: string, value: unknown) {
  const data = value as ReturnType<typeof exportV6Campaign>;
  if (
    !data || data.format !== "dm-command-table-v6" || data.version !== 1 ||
    !data.campaign?.name || !Array.isArray(data.tags) ||
    !Array.isArray(data.monsters) || !Array.isArray(data.players) ||
    !Array.isArray(data.sessions) || !Array.isArray(data.story)
  ) throw new Error("This is not a supported v6 campaign export.");

  const campaigns = createV6CampaignRepository(database);
  const content = createContentRepository(database);
  const bestiary = createBestiaryRepository(database);
  const encounters = createEncounterRepository(database);
  const target = campaigns.create(actorId, {
    name: `${data.campaign.name} — Imported`,
    notes: data.campaign.notes ?? "",
  });
  const tagIds = new Map<string, string>();
  for (const tag of data.tags) {
    const created = bestiary.createTag(target.id, actorId, { name: tag.name, color: tag.color });
    tagIds.set(tag.id, created.id);
  }

  const monsterIds = new Map<string, string>();
  for (const monster of data.monsters) {
    const created = bestiary.create(target.id, actorId, {
      ...monster,
      tagIds: monster.tags.flatMap(({ id }) => tagIds.get(id) ?? []),
    });
    monsterIds.set(monster.id, created.id);
  }

  const playerIds = new Map<string, string>();
  for (const player of data.players) {
    const created = content.createPlayer(target.id, actorId, player);
    playerIds.set(player.id, created.id);
  }

  const sessionIds = new Map<string, string>();
  for (const session of data.sessions) {
    const created = content.createSession(target.id, actorId, session);
    sessionIds.set(session.id, created.id);
    for (const encounter of session.encounters ?? []) {
      encounters.createPrepared(target.id, actorId, created.id, {
        ...encounter,
        monsters: encounter.monsters.flatMap((entry) => {
          const monsterId = monsterIds.get(entry.monsterId);
          return monsterId ? [{ ...entry, id: crypto.randomUUID(), monsterId }] : [];
        }),
      });
    }
  }

  for (const beat of data.story) {
    content.createStoryBeat(target.id, actorId, {
      ...beat,
      sessionIds: beat.sessionIds.flatMap((id) => sessionIds.get(id) ?? []),
    });
  }

  if (data.combat) {
    const initial = encounters.getCombat(target.id, actorId);
    encounters.saveCombat(target.id, actorId, initial.revision, {
      ...data.combat,
      combatants: data.combat.combatants.map((entry) => ({
        ...entry,
        id: crypto.randomUUID(),
        playerId: entry.playerId ? playerIds.get(entry.playerId) ?? null : null,
        monsterId: entry.monsterId ? monsterIds.get(entry.monsterId) ?? null : null,
        conditions: entry.conditions.map((condition) => ({
          ...condition,
          id: crypto.randomUUID(),
        })),
      })),
    }, "campaign_imported");
  }
  return campaigns.get(target.id, actorId)!;
}
