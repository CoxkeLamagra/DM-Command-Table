import type {
  CampaignMember,
  V6Administration,
  V6Campaign,
  V6Combat,
  V6Monster,
  V6Player,
  V6PreparedEncounter,
  V6Screenshot,
  V6SearchResult,
  V6ServerSettings,
  V6Session,
  V6SessionTemplate,
  V6StoryBeat,
  V6User,
} from "./types";
import { V6ApiError } from "./types";

type AuthStatus = {
  user: V6User | null;
  initialSetup: boolean;
  registrationEnabled: boolean;
};

export async function v6Request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch {
    emitConnectivity(false);
    throw new V6ApiError("The local server could not be reached.", 0);
  }
  emitConnectivity(true);
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  } & T;
  if (!response.ok) {
    if (response.status === 409 && typeof window !== "undefined")
      window.dispatchEvent(
        new CustomEvent("v6:conflict", { detail: { path, body } }),
      );
    throw new V6ApiError(
      body.error ?? "The request could not be completed.",
      response.status,
      body.code,
      body,
    );
  }
  if ((init.method ?? "GET").toUpperCase() !== "GET") emitMutation(path);
  return body;
}

export const V6_CLIENT_INSTANCE_ID =
  typeof crypto === "undefined" ? "server" : crypto.randomUUID();

function emitConnectivity(online: boolean) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("v6:connectivity", { detail: { online } }),
    );
}

function emitMutation(path: string) {
  if (typeof window === "undefined") return;
  const detail = {
    path,
    campaignId: path.match(/\/api\/v6\/campaigns\/([^/?]+)/)?.[1] ?? null,
    source: "local",
  };
  window.dispatchEvent(new CustomEvent("v6:mutation", { detail }));
  try {
    const channel = new BroadcastChannel("dm-command-table-v6");
    channel.postMessage({
      ...detail,
      source: "remote",
      clientInstanceId: V6_CLIENT_INSTANCE_ID,
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

export function getV6AuthStatus(): Promise<AuthStatus> {
  return v6Request("/api/v6-auth");
}

export function authenticateV6(input: {
  action: "login" | "register";
  username: string;
  password: string;
  displayName?: string;
  bootstrapToken?: string;
}): Promise<{ user: V6User }> {
  return v6Request("/api/v6-auth", json("POST", input));
}

export function logoutV6(): Promise<void> {
  return v6Request("/api/v6-auth", json("POST", { action: "logout" }));
}

export async function listV6Campaigns(archived = false): Promise<V6Campaign[]> {
  const result = await v6Request<{ campaigns: V6Campaign[] }>(
    `/api/v6/campaigns?archived=${archived}`,
  );
  return result.campaigns;
}

export async function getV6Campaign(campaignId: string): Promise<V6Campaign> {
  return (
    await v6Request<{ campaign: V6Campaign }>(`/api/v6/campaigns/${campaignId}`)
  ).campaign;
}

export async function createV6Campaign(
  name = "New campaign",
): Promise<V6Campaign> {
  const result = await v6Request<{ campaign: V6Campaign }>(
    "/api/v6/campaigns",
    json("POST", { name, notes: "" }),
  );
  return result.campaign;
}

export async function updateV6Campaign(
  campaign: V6Campaign,
  patch: Partial<Pick<V6Campaign, "name" | "notes" | "archived">>,
): Promise<V6Campaign> {
  const result = await v6Request<{ campaign: V6Campaign }>(
    `/api/v6/campaigns/${campaign.id}`,
    json("PATCH", { revision: campaign.revision, ...patch }),
  );
  return result.campaign;
}
export async function copyV6Campaign(
  campaignId: string,
  mode: "campaign" | "template",
): Promise<V6Campaign> {
  return (
    await v6Request<{ campaign: V6Campaign }>(
      `/api/v6/campaigns/${campaignId}/copy`,
      json("POST", { mode }),
    )
  ).campaign;
}
export async function deleteV6Campaign(campaignId: string): Promise<void> {
  await v6Request(`/api/v6/campaigns/${campaignId}`, { method: "DELETE" });
}
export async function exportV6Campaign(
  campaignId: string,
): Promise<Record<string, unknown>> {
  return v6Request(`/api/v6/campaigns/${campaignId}/export`);
}
export async function importV6Campaign(value: unknown): Promise<V6Campaign> {
  return (
    await v6Request<{ campaign: V6Campaign }>(
      "/api/v6/campaigns/import",
      json("POST", value),
    )
  ).campaign;
}

export async function listCampaignMembers(
  campaignId: string,
): Promise<CampaignMember[]> {
  const result = await v6Request<{ members: CampaignMember[] }>(
    `/api/v6/campaigns/${campaignId}/members`,
  );
  return result.members;
}

export async function grantCampaignAccess(
  campaignId: string,
  username: string,
  role: "viewer" | "editor",
): Promise<CampaignMember[]> {
  const result = await v6Request<{ members: CampaignMember[] }>(
    `/api/v6/campaigns/${campaignId}/members`,
    json("POST", { username, role }),
  );
  return result.members;
}

export async function revokeCampaignAccess(
  campaignId: string,
  userId: string,
): Promise<CampaignMember[]> {
  const result = await v6Request<{ members: CampaignMember[] }>(
    `/api/v6/campaigns/${campaignId}/members/${userId}`,
    { method: "DELETE" },
  );
  return result.members;
}

export async function transferCampaignOwnership(
  campaignId: string,
  userId: string,
): Promise<CampaignMember[]> {
  const result = await v6Request<{ members: CampaignMember[] }>(
    `/api/v6/campaigns/${campaignId}/members/transfer`,
    json("POST", { userId }),
  );
  return result.members;
}

export async function listV6Sessions(campaignId: string): Promise<V6Session[]> {
  return (
    await v6Request<{ sessions: V6Session[] }>(
      `/api/v6/campaigns/${campaignId}/sessions`,
    )
  ).sessions;
}

export async function createV6Session(
  campaignId: string,
  input: Pick<V6Session, "title" | "date" | "notes" | "status" | "sortOrder">,
): Promise<V6Session> {
  return (
    await v6Request<{ session: V6Session }>(
      `/api/v6/campaigns/${campaignId}/sessions`,
      json("POST", input),
    )
  ).session;
}

export async function updateV6Session(
  campaignId: string,
  session: V6Session,
): Promise<V6Session> {
  return (
    await v6Request<{ session: V6Session }>(
      `/api/v6/campaigns/${campaignId}/sessions/${session.id}`,
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

export async function deleteV6Session(
  campaignId: string,
  id: string,
): Promise<void> {
  await v6Request(`/api/v6/campaigns/${campaignId}/sessions/${id}`, {
    method: "DELETE",
  });
}

export async function listV6Story(campaignId: string): Promise<V6StoryBeat[]> {
  return (
    await v6Request<{ story: V6StoryBeat[] }>(
      `/api/v6/campaigns/${campaignId}/story`,
    )
  ).story;
}

export async function createV6StoryBeat(
  campaignId: string,
  input: Pick<
    V6StoryBeat,
    "title" | "chapter" | "details" | "status" | "sortOrder" | "sessionIds"
  >,
): Promise<V6StoryBeat> {
  return (
    await v6Request<{ beat: V6StoryBeat }>(
      `/api/v6/campaigns/${campaignId}/story`,
      json("POST", input),
    )
  ).beat;
}

export async function updateV6StoryBeat(
  campaignId: string,
  beat: V6StoryBeat,
): Promise<V6StoryBeat> {
  return (
    await v6Request<{ beat: V6StoryBeat }>(
      `/api/v6/campaigns/${campaignId}/story/${beat.id}`,
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

export async function deleteV6StoryBeat(
  campaignId: string,
  id: string,
): Promise<void> {
  await v6Request(`/api/v6/campaigns/${campaignId}/story/${id}`, {
    method: "DELETE",
  });
}

export async function listPreparedEncounters(
  campaignId: string,
  sessionId: string,
): Promise<V6PreparedEncounter[]> {
  return (
    await v6Request<{ encounters: V6PreparedEncounter[] }>(
      `/api/v6/campaigns/${campaignId}/sessions/${sessionId}/encounters`,
    )
  ).encounters;
}

export async function createPreparedEncounter(
  campaignId: string,
  sessionId: string,
  sortOrder: number,
): Promise<V6PreparedEncounter> {
  return (
    await v6Request<{ encounter: V6PreparedEncounter }>(
      `/api/v6/campaigns/${campaignId}/sessions/${sessionId}/encounters`,
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
  encounter: V6PreparedEncounter,
): Promise<V6PreparedEncounter> {
  return (
    await v6Request<{ encounter: V6PreparedEncounter }>(
      `/api/v6/campaigns/${campaignId}/sessions/${encounter.sessionId}/encounters/${encounter.id}`,
      json("PATCH", {
        name: encounter.name,
        notes: encounter.notes,
        sortOrder: encounter.sortOrder,
        monsters: encounter.monsters,
        revision: encounter.revision,
      }),
    )
  ).encounter;
}

export async function deletePreparedEncounter(
  campaignId: string,
  encounter: V6PreparedEncounter,
): Promise<void> {
  await v6Request(
    `/api/v6/campaigns/${campaignId}/sessions/${encounter.sessionId}/encounters/${encounter.id}`,
    { method: "DELETE" },
  );
}

export async function listV6Players(campaignId: string): Promise<V6Player[]> {
  return (
    await v6Request<{ players: V6Player[] }>(
      `/api/v6/campaigns/${campaignId}/players`,
    )
  ).players;
}
export async function createV6Player(
  campaignId: string,
  sortName = "New player",
): Promise<V6Player> {
  return (
    await v6Request<{ player: V6Player }>(
      `/api/v6/campaigns/${campaignId}/players`,
      json("POST", {
        name: sortName,
        race: "",
        className: "",
        level: null,
        hitPoints: null,
        armorClass: null,
        notes: "",
      }),
    )
  ).player;
}
export async function updateV6Player(
  campaignId: string,
  player: V6Player,
): Promise<V6Player> {
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
    await v6Request<{ player: V6Player }>(
      `/api/v6/campaigns/${campaignId}/players/${id}`,
      json("PATCH", input),
    )
  ).player;
}
export async function deleteV6Player(
  campaignId: string,
  id: string,
): Promise<void> {
  await v6Request(`/api/v6/campaigns/${campaignId}/players/${id}`, {
    method: "DELETE",
  });
}

export async function listV6Monsters(campaignId: string): Promise<V6Monster[]> {
  return (
    await v6Request<{ monsters: V6Monster[] }>(
      `/api/v6/campaigns/${campaignId}/monsters`,
    )
  ).monsters;
}
export async function createV6Monster(campaignId: string): Promise<V6Monster> {
  return (
    await v6Request<{ monster: V6Monster }>(
      `/api/v6/campaigns/${campaignId}/monsters`,
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
export async function importV6Monster(
  campaignId: string,
  monster: Omit<
    V6Monster,
    "id" | "campaignId" | "tags" | "revision" | "createdAt" | "updatedAt"
  >,
): Promise<V6Monster> {
  return (
    await v6Request<{ monster: V6Monster }>(
      `/api/v6/campaigns/${campaignId}/monsters`,
      json("POST", { ...monster, tagIds: [] }),
    )
  ).monster;
}
export async function updateV6Monster(
  campaignId: string,
  monster: V6Monster,
): Promise<V6Monster> {
  return (
    await v6Request<{ monster: V6Monster }>(
      `/api/v6/campaigns/${campaignId}/monsters/${monster.id}`,
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
export async function deleteV6Monster(
  campaignId: string,
  id: string,
): Promise<void> {
  await v6Request(`/api/v6/campaigns/${campaignId}/monsters/${id}`, {
    method: "DELETE",
  });
}

export async function getV6Combat(campaignId: string): Promise<V6Combat> {
  return (
    await v6Request<{ combat: V6Combat }>(
      `/api/v6/campaigns/${campaignId}/combat`,
    )
  ).combat;
}
export async function saveV6Combat(
  campaignId: string,
  combat: V6Combat,
  action: string,
): Promise<V6Combat> {
  return (
    await v6Request<{ combat: V6Combat }>(
      `/api/v6/campaigns/${campaignId}/combat`,
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
export async function undoV6Combat(campaignId: string): Promise<V6Combat> {
  return (
    await v6Request<{ combat: V6Combat }>(
      `/api/v6/campaigns/${campaignId}/combat/undo`,
      { method: "POST" },
    )
  ).combat;
}
export async function searchV6Campaign(
  campaignId: string,
  query: string,
): Promise<V6SearchResult[]> {
  return (
    await v6Request<{ results: V6SearchResult[] }>(
      `/api/v6/campaigns/${campaignId}/search?q=${encodeURIComponent(query)}`,
    )
  ).results;
}
export async function updateV6Account(
  input:
    | { action: "rename"; username: string; displayName?: string }
    | {
        action: "change-password";
        currentPassword: string;
        newPassword: string;
      },
): Promise<void> {
  await v6Request("/api/v6-account", json("PATCH", input));
}
export async function getV6Administration(): Promise<V6Administration> {
  return v6Request("/api/v6-admin");
}
export async function createV6ManagedAccount(input: {
  username: string;
  displayName: string;
  password: string;
}) {
  return v6Request<V6Administration>("/api/v6-admin", json("POST", input));
}
export async function updateV6ManagedAccount(input: {
  action: "update";
  id: string;
  username?: string;
  displayName?: string;
  password?: string;
  isAdmin?: boolean;
}) {
  return v6Request<V6Administration>("/api/v6-admin", json("PATCH", input));
}
export async function setV6Registration(registrationEnabled: boolean) {
  return v6Request<V6Administration>(
    "/api/v6-admin",
    json("PATCH", { action: "set-registration", registrationEnabled }),
  );
}
export async function setV6ServerSettings(serverSettings: V6ServerSettings) {
  return v6Request<V6Administration>(
    "/api/v6-admin",
    json("PATCH", { action: "set-server-settings", serverSettings }),
  );
}
export async function deleteV6ManagedAccount(id: string) {
  return v6Request<V6Administration>(
    `/api/v6-admin?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
export async function uploadV6Screenshot(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  return (
    await v6Request<{ screenshot: { url: string } }>("/api/v6-screenshots", {
      method: "POST",
      body: form,
    })
  ).screenshot.url;
}
export async function listV6Screenshots(): Promise<V6Screenshot[]> {
  return (
    await v6Request<{ screenshots: V6Screenshot[] }>("/api/v6-screenshots")
  ).screenshots;
}
export async function deleteV6Screenshot(id: string): Promise<void> {
  await v6Request(`/api/v6-screenshots/${id}`, { method: "DELETE" });
}
export async function listV6SessionTemplates(): Promise<V6SessionTemplate[]> {
  return (
    await v6Request<{ templates: V6SessionTemplate[] }>("/api/v6/templates")
  ).templates;
}
export async function saveV6SessionTemplate(
  name: string,
  content: string,
  id?: string,
): Promise<V6SessionTemplate> {
  return (
    await v6Request<{ template: V6SessionTemplate }>(
      "/api/v6/templates",
      json("POST", { id, name, content }),
    )
  ).template;
}
export async function deleteV6SessionTemplate(id: string): Promise<void> {
  await v6Request(`/api/v6/templates/${id}`, { method: "DELETE" });
}
