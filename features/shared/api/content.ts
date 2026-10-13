import type { Player, Session, StoryBeat } from "@/domain/types";
import { requestJson, json } from "./transport";
export async function listSessions(campaignId: string): Promise<Session[]> {
  return (
    await requestJson<{ sessions: Session[] }>(
      `/api/campaigns/${campaignId}/sessions`,
    )
  ).sessions;
}

export async function createSession(
  campaignId: string,
  input: Pick<Session, "title" | "date" | "notes" | "status" | "sortOrder">,
): Promise<Session> {
  return (
    await requestJson<{ session: Session }>(
      `/api/campaigns/${campaignId}/sessions`,
      json("POST", input),
    )
  ).session;
}

export async function updateSession(
  campaignId: string,
  session: Session,
): Promise<Session> {
  return (
    await requestJson<{ session: Session }>(
      `/api/campaigns/${campaignId}/sessions/${session.id}`,
      json("PATCH", {
        title: session.title,
        date: session.date,
        notes: session.notes,
        status: session.status,
        sortOrder: session.sortOrder,
        revision: session.revision,
      }),
    )
  ).session;
}

export async function deleteSession(
  campaignId: string,
  id: string,
): Promise<void> {
  await requestJson(`/api/campaigns/${campaignId}/sessions/${id}`, {
    method: "DELETE",
  });
}

export async function listStory(campaignId: string): Promise<StoryBeat[]> {
  return (
    await requestJson<{ story: StoryBeat[] }>(
      `/api/campaigns/${campaignId}/story`,
    )
  ).story;
}

export async function createStoryBeat(
  campaignId: string,
  input: Pick<
    StoryBeat,
    "title" | "chapter" | "details" | "status" | "sortOrder" | "sessionIds"
  >,
): Promise<StoryBeat> {
  return (
    await requestJson<{ beat: StoryBeat }>(
      `/api/campaigns/${campaignId}/story`,
      json("POST", input),
    )
  ).beat;
}

export async function updateStoryBeat(
  campaignId: string,
  beat: StoryBeat,
): Promise<StoryBeat> {
  return (
    await requestJson<{ beat: StoryBeat }>(
      `/api/campaigns/${campaignId}/story/${beat.id}`,
      json("PATCH", {
        title: beat.title,
        chapter: beat.chapter,
        details: beat.details,
        status: beat.status,
        sortOrder: beat.sortOrder,
        sessionIds: beat.sessionIds,
        revision: beat.revision,
      }),
    )
  ).beat;
}

export async function deleteStoryBeat(
  campaignId: string,
  id: string,
): Promise<void> {
  await requestJson(`/api/campaigns/${campaignId}/story/${id}`, {
    method: "DELETE",
  });
}

export async function listPlayers(campaignId: string): Promise<Player[]> {
  return (
    await requestJson<{ players: Player[] }>(
      `/api/campaigns/${campaignId}/players`,
    )
  ).players;
}

export type PlayerDraft = Pick<
  Player,
  | "name"
  | "kind"
  | "race"
  | "className"
  | "level"
  | "hitPoints"
  | "armorClass"
  | "notes"
>;

export async function createPlayer(
  campaignId: string,
  nameOrDraft: string | PlayerDraft = "New player",
  kind: "player" | "npc" = "player",
): Promise<Player> {
  const input =
    typeof nameOrDraft === "string"
      ? {
          name: nameOrDraft,
          kind,
          race: "",
          className: "",
          level: null,
          hitPoints: null,
          armorClass: null,
          notes: "",
        }
      : nameOrDraft;
  return (
    await requestJson<{ player: Player }>(
      `/api/campaigns/${campaignId}/players`,
      json("POST", input),
    )
  ).player;
}

export async function updatePlayer(
  campaignId: string,
  player: Player,
): Promise<Player> {
  const {
    id,
    campaignId: ignoredCampaign,
    createdAt,
    updatedAt,
    ...input
  } = player;
  void ignoredCampaign;
  void createdAt;
  void updatedAt;
  return (
    await requestJson<{ player: Player }>(
      `/api/campaigns/${campaignId}/players/${id}`,
      json("PATCH", input),
    )
  ).player;
}

export async function deletePlayer(
  campaignId: string,
  id: string,
): Promise<void> {
  await requestJson(`/api/campaigns/${campaignId}/players/${id}`, {
    method: "DELETE",
  });
}
