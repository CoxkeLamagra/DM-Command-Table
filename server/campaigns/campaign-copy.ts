import type { DatabaseSync } from "node:sqlite";
import { PublicApiError } from "../http/errors.ts";
import { requireCampaignRead } from "./access.ts";
import { createBestiaryRepository } from "../bestiary/bestiary-repository.ts";
import {
  createCampaignRepository,
  type Campaign,
} from "./campaign-repository.ts";
import { createContentRepository } from "../content/content-repository.ts";
import { createEncounterRepository } from "../encounters/encounter-repository.ts";
import { runTransaction } from "../../db/transaction.ts";

export type CampaignCopyMode = "campaign" | "template";

export function copyCampaign(
  database: DatabaseSync,
  sourceId: string,
  actorId: string,
  mode: CampaignCopyMode,
): Campaign {
  requireCampaignRead(database, sourceId, actorId);
  return runTransaction(database, () => {
    const campaigns = createCampaignRepository(database);
    const source = campaigns.get(sourceId, actorId);
    if (!source) throw new PublicApiError("Campaign not found.", 404);
    const target = campaigns.create(actorId, {
      name: copyName(source.name, mode),
      notes: source.notes,
    });
    const content = createContentRepository(database);
    const bestiary = createBestiaryRepository(database);
    const encounters = createEncounterRepository(database);

    const tagIds = new Map<string, string>();
    for (const tag of bestiary.listTags(sourceId, actorId))
      tagIds.set(
        tag.id,
        bestiary.createTag(target.id, actorId, {
          name: tag.name,
          color: tag.color,
        }).id,
      );
    const monsterIds = new Map<string, string>();
    for (const monster of bestiary.list(sourceId, actorId)) {
      const created = bestiary.create(target.id, actorId, {
        ...monster,
        tagIds: monster.tags.flatMap(({ id }) => tagIds.get(id) ?? []),
      });
      monsterIds.set(monster.id, created.id);
    }
    const playerIds = new Map<string, string>();
    if (mode === "campaign")
      for (const player of content.listPlayers(sourceId, actorId)) {
        const created = content.createPlayer(target.id, actorId, player);
        playerIds.set(player.id, created.id);
      }
    const sessionIds = new Map<string, string>();
    for (const session of content.listSessions(sourceId, actorId)) {
      const created = content.createSession(target.id, actorId, {
        ...session,
        status: mode === "template" ? "planned" : session.status,
      });
      sessionIds.set(session.id, created.id);
      for (const encounter of encounters.listPrepared(
        sourceId,
        actorId,
        session.id,
      ))
        encounters.createPrepared(target.id, actorId, created.id, {
          ...encounter,
          combatants: (encounter.combatants ?? []).map((entry) => ({
            ...entry,
            id: crypto.randomUUID(),
          })),
          monsters: encounter.monsters.flatMap((entry) => {
            const monsterId = monsterIds.get(entry.monsterId);
            return monsterId
              ? [{ ...entry, id: crypto.randomUUID(), monsterId }]
              : [];
          }),
        });
    }
    for (const beat of content.listStory(sourceId, actorId))
      content.createStoryBeat(target.id, actorId, {
        ...beat,
        status: mode === "template" ? "planned" : beat.status,
        sessionIds: beat.sessionIds.flatMap((id) => sessionIds.get(id) ?? []),
      });
    if (mode === "campaign") {
      const sourceCombat = encounters.getCombat(sourceId, actorId);
      const targetCombat = encounters.getCombat(target.id, actorId);
      encounters.saveCombat(
        target.id,
        actorId,
        targetCombat.revision,
        {
          name: sourceCombat.name,
          round: sourceCombat.round,
          turn: sourceCombat.turn,
          combatants: sourceCombat.combatants.map((entry) => ({
            ...entry,
            id: crypto.randomUUID(),
            playerId: entry.playerId
              ? (playerIds.get(entry.playerId) ?? null)
              : null,
            monsterId: entry.monsterId
              ? (monsterIds.get(entry.monsterId) ?? null)
              : null,
            conditions: entry.conditions.map((condition) => ({
              ...condition,
              id: crypto.randomUUID(),
            })),
          })),
        },
        "campaign_copied",
      );
    }
    return campaigns.get(target.id, actorId)!;
  });
}

function copyName(name: string, mode: CampaignCopyMode) {
  const suffix = mode === "template" ? " — Template" : " — Copy";
  return `${(name.trim() || "Campaign").slice(0, 120 - suffix.length)}${suffix}`;
}
