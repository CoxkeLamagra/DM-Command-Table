import type { CachedCampaign } from "@/lib/local-campaigns";

export type Combatant = {
  id: string;
  name: string;
  number?: number | null;
  kind: "player" | "monster" | "npc";
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number;
  conditions: string[];
  monsterId?: string;
  campaignPlayerId?: string;
};

export type CampaignPlayer = {
  id: string;
  name: string;
  race: string;
  className: string;
  level: number | null;
  hp: number | null;
  ac: number | null;
  notes: string;
};

export type Monster = {
  id: string;
  name: string;
  type: string;
  cr: string;
  ac: number;
  hp: number;
  speed: string;
  stats: string;
  abilities: string;
  spells: string;
  slots: number[];
  source?: string;
};

export type PreparedEncounterMonster = {
  id: string;
  monsterId: string;
  number?: number | null;
};

export type PreparedEncounter = {
  id: string;
  name: string;
  monsters: PreparedEncounterMonster[];
};

export type SessionNote = {
  id: string;
  title: string;
  date: string;
  body: string;
  done: boolean;
  encounters: PreparedEncounter[];
};

export type StoryBeat = {
  id: string;
  title: string;
  chapter: string;
  details: string;
  status: "planned" | "active" | "happened";
};

export type CampaignState = {
  campaignName: string;
  campaignNotes: string;
  encounterName: string;
  round: number;
  turn: number;
  combatants: Combatant[];
  players: CampaignPlayer[];
  monsters: Monster[];
  sessions: SessionNote[];
  story: StoryBeat[];
};

export type Campaign = CachedCampaign<CampaignState>;
export type CampaignRole = Campaign["role"];
export type CampaignUser = {
  username: string;
  displayName: string;
  isAdmin: boolean;
};

export type CampaignPatch = <T extends keyof CampaignState>(
  key: T,
  value: CampaignState[T],
) => void;
