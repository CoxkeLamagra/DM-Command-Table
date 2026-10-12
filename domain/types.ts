import type { CombatEncounter } from "./encounters";
export type {
  PreparedMonster,
  PreparedCombatant,
  PreparedEncounter,
  CombatCondition,
  Combatant,
} from "./encounters";
export type Combat = CombatEncounter;
export type User = {
  userId: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
};

export type CampaignRole = "owner" | "editor" | "viewer";

export type Campaign = {
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

export type Session = {
  id: string;
  campaignId: string;
  title: string;
  date: string;
  notes: string;
  status: ProgressStatus;
  sortOrder: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type StoryBeat = {
  id: string;
  campaignId: string;
  title: string;
  chapter: string;
  details: string;
  status: ProgressStatus;
  sortOrder: number;
  sessionIds: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type Player = {
  kind: "player" | "npc";
  id: string;
  campaignId: string;
  name: string;
  race: string;
  className: string;
  level: number | null;
  hitPoints: number | null;
  armorClass: number | null;
  notes: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type Monster = {
  id: string;
  campaignId: string;
  name: string;
  type: string;
  challengeRating: string;
  armorClass: number;
  hitPoints: number;
  speed: string;
  stats: string;
  abilities: string;
  spells: string;
  notes: string;
  spellSlots: number[];
  source: string | null;
  favorite: boolean;
  tags: Array<{ id: string; name: string; color: string | null }>;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type SearchResult = {
  resourceType: string;
  resourceId: string;
  title: string;
  excerpt: string;
  rank: number;
};
export type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
};
export type ServerSettings = {
  secureCookieMode: "auto" | "always" | "never";
  sessionLifetimeDays: number;
  uploadLimitMb: number;
  screenshotQuotaMb: number;
  screenshotGlobalQuotaMb: number;
  combatHistoryLimit: number;
  auditEventLimit: number;
};
export type Administration = {
  users: ManagedUser[];
  registrationEnabled: boolean;
  serverSettings: ServerSettings;
};
export type Screenshot = {
  id: string;
  name: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  url: string;
};
export type SessionTemplate = {
  id: string;
  ownerId: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type Section =
  | "campaign"
  | "story"
  | "sessions"
  | "players"
  | "bestiary"
  | "combat"
  | "search"
  | "account"
  | "administration";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
