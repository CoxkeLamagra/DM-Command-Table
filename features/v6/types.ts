export type V6User = {
  userId: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
};

export type CampaignRole = "owner" | "editor" | "viewer";

export type V6Campaign = {
  id: string;
  ownerId: string;
  name: string;
  notes: string;
  archived: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  role: CampaignRole;
};

export type CampaignMember = {
  userId: string;
  username: string;
  displayName: string;
  role: CampaignRole;
  updatedAt: string;
};

export type ProgressStatus = "planned" | "active" | "happened";

export type V6Session = {
  id: string; campaignId: string; title: string; date: string; notes: string;
  status: ProgressStatus; sortOrder: number; revision: number;
  createdAt: string; updatedAt: string;
};

export type V6StoryBeat = {
  id: string; campaignId: string; title: string; chapter: string; details: string;
  status: ProgressStatus; sortOrder: number; sessionIds: string[]; revision: number;
  createdAt: string; updatedAt: string;
};

export type PreparedMonster = {
  id: string; monsterId: string; displayNumber: number | null;
  quantity: number; sortOrder: number;
};

export type V6PreparedEncounter = {
  id: string; sessionId: string; name: string; notes: string; sortOrder: number;
  monsters: PreparedMonster[]; revision: number; createdAt: string; updatedAt: string;
};

export type V6Player = {
  id: string; campaignId: string; name: string; race: string; className: string;
  level: number | null; hitPoints: number | null; armorClass: number | null;
  notes: string; revision: number; createdAt: string; updatedAt: string;
};

export type V6Monster = {
  id: string; campaignId: string; name: string; type: string; challengeRating: string;
  armorClass: number; hitPoints: number; speed: string; stats: string;
  abilities: string; spells: string; notes: string; spellSlots: number[];
  source: string | null; favorite: boolean;
  tags: Array<{ id: string; name: string; color: string | null }>;
  revision: number; createdAt: string; updatedAt: string;
};

export type V6CombatCondition = { id: string; name: string; remainingTurns: number | null };
export type V6Combatant = {
  id: string; playerId: string | null; monsterId: string | null; name: string;
  displayNumber: number | null; kind: "player" | "monster" | "npc";
  notes: string;
  initiative: number; hitPoints: number; maximumHitPoints: number;
  armorClass: number; sortOrder: number; conditions: V6CombatCondition[]; revision: number;
};
export type V6Combat = {
  id: string; campaignId: string; name: string; round: number; turn: number;
  combatants: V6Combatant[]; revision: number; createdAt: string; updatedAt: string;
};
export type V6SearchResult = { resourceType: string; resourceId: string; title: string; excerpt: string; rank: number };
export type ManagedV6User = { id: string; username: string; displayName: string; isAdmin: boolean; createdAt: string };
export type V6ServerSettings = {
  secureCookieMode: "auto" | "always" | "never";
  sessionLifetimeDays: number;
  uploadLimitMb: number;
  screenshotQuotaMb: number;
  screenshotGlobalQuotaMb: number;
  combatHistoryLimit: number;
  auditEventLimit: number;
};
export type V6Administration = {
  users: ManagedV6User[];
  registrationEnabled: boolean;
  serverSettings: V6ServerSettings;
};
export type V6Screenshot = { id: string; name: string; size: number; uploadedBy: string; createdAt: string; url: string };
export type V6SessionTemplate = { id: string; ownerId: string; name: string; content: string; createdAt: string; updatedAt: string };

export type V6Section =
  | "campaign"
  | "story"
  | "sessions"
  | "players"
  | "bestiary"
  | "combat"
  | "search"
  | "account"
  | "administration";

export class V6ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "V6ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
