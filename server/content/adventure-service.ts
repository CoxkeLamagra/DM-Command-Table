import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { runTransaction } from "../../db/transaction.ts";
import {
  emptyAdventure,
  emptyContinuity,
  carryContinuity,
} from "../../domain/adventure.ts";
import { carrySchema, quickStartSchema } from "../http/adventure-schemas.ts";
import { createCampaignRepository } from "../campaigns/campaign-repository.ts";
import {
  requireCampaignEdit,
  requireCampaignRead,
} from "../campaigns/access.ts";
import { createContentRepository } from "./content-repository.ts";
import {
  ResourceNotFoundError,
  RevisionConflictError,
} from "../http/conflicts.ts";
import { PublicApiError } from "../http/errors.ts";
export function prepareNextSession(
  database: DatabaseSync,
  campaignId: string,
  sessionId: string,
  actorId: string,
  input: z.infer<typeof carrySchema>,
) {
  requireCampaignEdit(database, campaignId, actorId);
  return runTransaction(database, () => {
    const campaign = createCampaignRepository(database).get(
      campaignId,
      actorId,
    )!;
    if (campaign.revision !== input.campaignRevision)
      throw new RevisionConflictError(
        "campaign",
        campaignId,
        input.campaignRevision,
        campaign.revision,
      );
    const content = createContentRepository(database),
      sessions = content.listSessions(campaignId, actorId);
    const source = sessions.find((session) => session.id === sessionId);
    if (!source) throw new ResourceNotFoundError("session", sessionId);
    if (source.revision !== input.revision)
      throw new RevisionConflictError(
        "session",
        sessionId,
        input.revision,
        source.revision,
      );
    const continuity = source.continuity ?? emptyContinuity(),
      adventure = campaign.adventure ?? emptyAdventure();
    if (
      input.sceneIds.some(
        (id) =>
          !continuity.scenes.some((scene) => scene.id === id && !scene.done),
      ) ||
      input.threadIds.some(
        (id) =>
          !adventure.threads.some(
            (thread) => thread.id === id && thread.status === "open",
          ),
      )
    )
      throw new PublicApiError(
        "Choose only unfinished scenes and open campaign threads.",
      );
    return content.createSession(campaignId, actorId, {
      title: input.title,
      date: input.date,
      notes: "",
      status: "planned",
      sortOrder:
        Math.max(-1, ...sessions.map((session) => session.sortOrder)) + 1,
      continuity: carryContinuity(continuity, input.sceneIds, input.threadIds),
    });
  });
}
export function quickStart(
  database: DatabaseSync,
  actorId: string,
  input: z.infer<typeof quickStartSchema>,
) {
  return runTransaction(database, () => {
    const campaigns = createCampaignRepository(database),
      content = createContentRepository(database);
    let selected: ReturnType<typeof content.listPlayers> = [];
    if (input.sourceCampaignId) {
      requireCampaignRead(database, input.sourceCampaignId, actorId);
      const source = campaigns.get(input.sourceCampaignId, actorId)!;
      if (input.sourceRevision !== source.revision)
        throw new RevisionConflictError(
          "campaign",
          source.id,
          input.sourceRevision ?? 0,
          source.revision,
        );
      if (input.presetId) {
        const preset = source.adventure?.partyPresets.find(
          (value) => value.id === input.presetId,
        );
        if (!preset)
          throw new ResourceNotFoundError("party preset", input.presetId);
        selected = content
          .listPlayers(source.id, actorId)
          .filter((player) => preset.playerIds.includes(player.id));
      }
    } else if (input.presetId)
      throw new PublicApiError(
        "Choose a source campaign for the party preset.",
      );
    const created = campaigns.create(actorId, { name: input.name });
    const playerIds = selected.map(
      (player) => content.createPlayer(created.id, actorId, player).id,
    );
    const adventure = {
      ...emptyAdventure(),
      oneShot: { durationMinutes: input.durationMinutes },
      partyPresets: playerIds.length
        ? [{ id: crypto.randomUUID(), name: "One-shot party", playerIds }]
        : [],
    };
    const updated = campaigns.update(
      created.id,
      actorId,
      campaigns.get(created.id, actorId)!.revision,
      { adventure },
    );
    const session = content.createSession(created.id, actorId, {
      title: input.name,
      date: "",
      notes: "",
      status: "planned",
      sortOrder: 0,
      continuity: {
        ...emptyContinuity(),
        attendanceIds: playerIds,
        scenes: input.scenes.map((scene) => ({
          ...scene,
          id: crypto.randomUUID(),
          done: false,
        })),
      },
    });
    return { campaign: campaigns.get(updated.id, actorId)!, session };
  });
}
