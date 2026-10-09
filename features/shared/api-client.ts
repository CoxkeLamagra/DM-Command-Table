import type {
  CampaignMember,
  Administration,
  Campaign,
  Combat,
  Monster,
  Player,
  PreparedEncounter,
  Screenshot,
  SearchResult,
  ServerSettings,
  Session,
  SessionTemplate,
  StoryBeat,
  User,
} from "@/domain/types";
import { ApiError } from "@/domain/types";

type AuthStatus = {
  user: User | null;
  initialSetup: boolean;
  registrationEnabled: boolean;
};

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      cache: "no-store",
      ...init,
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
  } catch {
    emitConnectivity(false);
    throw new ApiError("The local server could not be reached.", 0);
  }
  emitConnectivity(true);
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  } & T;
  if (!response.ok) {
    if (response.status === 409 && typeof window !== "undefined")
      window.dispatchEvent(
        new CustomEvent("workspace:conflict", { detail: { path, body } }),
      );
    throw new ApiError(
      body.error ?? "The request could not be completed.",
      response.status,
      body.code,
      body,
    );
  }
  if ((init.method ?? "GET").toUpperCase() !== "GET") emitMutation(path);
  return body;
}

export const CLIENT_INSTANCE_ID =
  typeof crypto === "undefined" ? "server" : crypto.randomUUID();

function emitConnectivity(online: boolean) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("workspace:connectivity", { detail: { online } }),
    );
}

function emitMutation(path: string) {
  if (typeof window === "undefined") return;
  const detail = {
    path,
    campaignId: path.match(/\/api\/campaigns\/([^/?]+)/)?.[1] ?? null,
    source: "local",
  };
  window.dispatchEvent(new CustomEvent("workspace:mutation", { detail }));
  try {
    const channel = new BroadcastChannel("dm-command-table");
    channel.postMessage({
      ...detail,
      source: "remote",
      clientInstanceId: CLIENT_INSTANCE_ID,
    });
    channel.close();
  } catch {
    /* BroadcastChannel is an enhancement, not a requirement. */
  }
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function getAuthStatus(): Promise<AuthStatus> {
  return requestJson("/api/auth");
}

export function authenticate(input: {
  action: "login" | "register";
  username: string;
  password: string;
  displayName?: string;
  bootstrapToken?: string;
}): Promise<{ user: User }> {
  return requestJson("/api/auth", json("POST", input));
}

export function logout(): Promise<void> {
  return requestJson("/api/auth", json("POST", { action: "logout" }));
}

export async function listCampaigns(archived = false): Promise<Campaign[]> {
  const result = await requestJson<{ campaigns: Campaign[] }>(
    `/api/campaigns?archived=${archived}`,
  );
  return result.campaigns;
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  return (
    await requestJson<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`)
  ).campaign;
}

export async function createCampaign(name = "New campaign"): Promise<Campaign> {
  const result = await requestJson<{ campaign: Campaign }>(
    "/api/campaigns",
    json("POST", { name, notes: "" }),
  );
  return result.campaign;
}

export async function updateCampaign(
  campaign: Campaign,
  patch: Partial<Pick<Campaign, "name" | "notes" | "archived">>,
): Promise<Campaign> {
  const result = await requestJson<{ campaign: Campaign }>(
    `/api/campaigns/${campaign.id}`,
    json("PATCH", { revision: campaign.revision, ...patch }),
  );
  return result.campaign;
}
export async function copyCampaign(
  campaignId: string,
  mode: "campaign" | "template",
): Promise<Campaign> {
  return (
    await requestJson<{ campaign: Campaign }>(
      `/api/campaigns/${campaignId}/copy`,
      json("POST", { mode }),
    )
  ).campaign;
}
export async function deleteCampaign(campaignId: string): Promise<void> {
  await requestJson(`/api/campaigns/${campaignId}`, { method: "DELETE" });
}
export async function exportCampaign(
  campaignId: string,
): Promise<Record<string, unknown>> {
  return requestJson(`/api/campaigns/${campaignId}/export`);
}
export async function importCampaign(value: unknown): Promise<Campaign> {
  return (
    await requestJson<{ campaign: Campaign }>(
      "/api/campaigns/import",
      json("POST", value),
    )
  ).campaign;
}

export async function listCampaignMembers(
  campaignId: string,
): Promise<CampaignMember[]> {
  const result = await requestJson<{ members: CampaignMember[] }>(
    `/api/campaigns/${campaignId}/members`,
  );
  return result.members;
}

export async function grantCampaignAccess(
  campaignId: string,
  username: string,
  role: "viewer" | "editor",
): Promise<CampaignMember[]> {
  const result = await requestJson<{ members: CampaignMember[] }>(
    `/api/campaigns/${campaignId}/members`,
    json("POST", { username, role }),
  );
  return result.members;
}

export async function revokeCampaignAccess(
  campaignId: string,
  userId: string,
): Promise<CampaignMember[]> {
  const result = await requestJson<{ members: CampaignMember[] }>(
    `/api/campaigns/${campaignId}/members/${userId}`,
    { method: "DELETE" },
  );
  return result.members;
}

export async function transferCampaignOwnership(
  campaignId: string,
  userId: string,
): Promise<CampaignMember[]> {
  const result = await requestJson<{ members: CampaignMember[] }>(
    `/api/campaigns/${campaignId}/members/transfer`,
    json("POST", { userId }),
  );
  return result.members;
}

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

export async function listPreparedEncounters(
  campaignId: string,
  sessionId: string,
): Promise<PreparedEncounter[]> {
  return (
    await requestJson<{ encounters: PreparedEncounter[] }>(
      `/api/campaigns/${campaignId}/sessions/${sessionId}/encounters`,
    )
  ).encounters;
}

export async function createPreparedEncounter(
  campaignId: string,
  sessionId: string,
  sortOrder: number,
): Promise<PreparedEncounter> {
  return (
    await requestJson<{ encounter: PreparedEncounter }>(
      `/api/campaigns/${campaignId}/sessions/${sessionId}/encounters`,
      json("POST", {
        name: "New encounter",
        notes: "",
        sortOrder,
        monsters: [],
      }),
    )
  ).encounter;
}

export async function updatePreparedEncounter(
  campaignId: string,
  encounter: PreparedEncounter,
): Promise<PreparedEncounter> {
  return (
    await requestJson<{ encounter: PreparedEncounter }>(
      `/api/campaigns/${campaignId}/sessions/${encounter.sessionId}/encounters/${encounter.id}`,
      json("PATCH", {
        name: encounter.name,
        notes: encounter.notes,
        sortOrder: encounter.sortOrder,
        monsters: encounter.monsters,
        combatants: encounter.combatants ?? [],
        revision: encounter.revision,
      }),
    )
  ).encounter;
}

export async function deletePreparedEncounter(
  campaignId: string,
  encounter: PreparedEncounter,
): Promise<void> {
  await requestJson(
    `/api/campaigns/${campaignId}/sessions/${encounter.sessionId}/encounters/${encounter.id}`,
    { method: "DELETE" },
  );
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

export async function listMonsters(campaignId: string): Promise<Monster[]> {
  return (
    await requestJson<{ monsters: Monster[] }>(
      `/api/campaigns/${campaignId}/monsters`,
    )
  ).monsters;
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
      json("POST", { ...monster, tagIds: [] }),
    )
  ).monster;
}
export async function updateMonster(
  campaignId: string,
  monster: Monster,
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
        abilities: monster.abilities,
        spells: monster.spells,
        notes: monster.notes,
        spellSlots: monster.spellSlots,
        source: monster.source,
        favorite: monster.favorite,
        tagIds: monster.tags.map(({ id }) => id),
        revision: monster.revision,
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

export async function getCombat(campaignId: string): Promise<Combat> {
  return (
    await requestJson<{ combat: Combat }>(`/api/campaigns/${campaignId}/combat`)
  ).combat;
}
export async function saveCombat(
  campaignId: string,
  combat: Combat,
  action: string,
): Promise<Combat> {
  return (
    await requestJson<{ combat: Combat }>(
      `/api/campaigns/${campaignId}/combat`,
      json("PUT", {
        name: combat.name,
        round: combat.round,
        turn: combat.turn,
        combatants: combat.combatants,
        revision: combat.revision,
        action,
      }),
    )
  ).combat;
}
export async function undoCombat(
  campaignId: string,
  revision: number,
): Promise<Combat> {
  return (
    await requestJson<{ combat: Combat }>(
      `/api/campaigns/${campaignId}/combat/undo`,
      json("POST", { revision }),
    )
  ).combat;
}
export async function searchCampaign(
  campaignId: string,
  query: string,
  type = "all",
): Promise<SearchResult[]> {
  return (
    await requestJson<{ results: SearchResult[] }>(
      `/api/campaigns/${campaignId}/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`,
    )
  ).results;
}
export async function updateAccount(
  input:
    | { action: "rename"; username: string; displayName?: string }
    | {
        action: "change-password";
        currentPassword: string;
        newPassword: string;
      },
): Promise<void> {
  await requestJson("/api/account", json("PATCH", input));
}
export async function getAdministration(): Promise<Administration> {
  return requestJson("/api/admin");
}
export async function createManagedAccount(input: {
  username: string;
  displayName: string;
  password: string;
}) {
  return requestJson<Administration>("/api/admin", json("POST", input));
}
export async function updateManagedAccount(input: {
  action: "update";
  id: string;
  username?: string;
  displayName?: string;
  password?: string;
  isAdmin?: boolean;
}) {
  return requestJson<Administration>("/api/admin", json("PATCH", input));
}
export async function setRegistration(registrationEnabled: boolean) {
  return requestJson<Administration>(
    "/api/admin",
    json("PATCH", { action: "set-registration", registrationEnabled }),
  );
}
export async function setServerSettings(serverSettings: ServerSettings) {
  return requestJson<Administration>(
    "/api/admin",
    json("PATCH", { action: "set-server-settings", serverSettings }),
  );
}
export async function deleteManagedAccount(id: string) {
  return requestJson<Administration>(
    `/api/admin?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
export async function uploadScreenshot(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  return (
    await requestJson<{ screenshot: { url: string } }>("/api/screenshots", {
      method: "POST",
      body: form,
    })
  ).screenshot.url;
}
export async function listScreenshots(): Promise<Screenshot[]> {
  return (await requestJson<{ screenshots: Screenshot[] }>("/api/screenshots"))
    .screenshots;
}
export async function deleteScreenshot(id: string): Promise<void> {
  await requestJson(`/api/screenshots/${id}`, { method: "DELETE" });
}
export async function listSessionTemplates(): Promise<SessionTemplate[]> {
  return (await requestJson<{ templates: SessionTemplate[] }>("/api/templates"))
    .templates;
}
export async function saveSessionTemplate(
  name: string,
  content: string,
  id?: string,
): Promise<SessionTemplate> {
  return (
    await requestJson<{ template: SessionTemplate }>(
      "/api/templates",
      json("POST", { id, name, content }),
    )
  ).template;
}
export async function deleteSessionTemplate(id: string): Promise<void> {
  await requestJson(`/api/templates/${id}`, { method: "DELETE" });
}

export async function saveSessionPreparation(
  campaignId: string,
  session: Session,
  encounters: PreparedEncounter[],
) {
  return requestJson<{ session: Session; encounters: PreparedEncounter[] }>(
    `/api/campaigns/${campaignId}/sessions/${session.id}/save`,
    json("POST", { session, encounters }),
  );
}
export type EncounterDraftController = {
  snapshot: () => PreparedEncounter[];
  reconcile: (
    submitted: PreparedEncounter[],
    saved: PreparedEncounter[],
  ) => void;
};

export async function deleteRecords(
  campaignId: string,
  resource: "players" | "monsters",
  ids: string[],
): Promise<void> {
  await requestJson(
    `/api/campaigns/${campaignId}/${resource}/bulk-delete`,
    json("POST", { ids }),
  );
}
export async function commandCombat(
  campaignId: string,
  combat: Combat,
  command: import("../../domain/combat").CombatAction,
  zeroHpPolicy: import("../../domain/combat").ZeroHpPolicy = "skip-all",
): Promise<Combat> {
  return (
    await requestJson<{ combat: Combat }>(
      `/api/campaigns/${campaignId}/combat/command`,
      json("POST", { combat, command, zeroHpPolicy }),
    )
  ).combat;
}
export async function loadPreparedCombat(
  campaignId: string,
  prepared: PreparedEncounter,
  revision: number,
): Promise<Combat> {
  return (
    await requestJson<{ combat: Combat }>(
      `/api/campaigns/${campaignId}/combat/load-prepared`,
      json("POST", { prepared, revision }),
    )
  ).combat;
}

export function exportPackage(campaignId: string): Promise<unknown> {
  return requestJson(`/api/campaigns/${campaignId}/package`);
}
