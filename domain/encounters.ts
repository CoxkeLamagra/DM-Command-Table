export type PreparedMonster = {
  id: string;
  monsterId: string;
  displayNumber: number | null;
  quantity: number;
  sortOrder: number;
};

export type PreparedEncounter = {
  id: string;
  sessionId: string;
  name: string;
  notes: string;
  sortOrder: number;
  monsters: PreparedMonster[];
  combatants?: PreparedCombatant[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type CombatCondition = {
  id: string;
  name: string;
  remainingTurns: number | null;
};

export type Combatant = {
  id: string;
  playerId: string | null;
  monsterId: string | null;
  name: string;
  displayNumber: number | null;
  kind: "player" | "monster" | "npc";
  notes: string;
  initiative: number;
  hitPoints: number;
  maximumHitPoints: number;
  armorClass: number;
  sortOrder: number;
  conditions: CombatCondition[];
  revision: number;
};

export type CombatEncounter = {
  id: string;
  campaignId: string;
  name: string;
  round: number;
  turn: number;
  combatants: Combatant[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type PreparedCombatant = Omit<
  Combatant,
  "playerId" | "monsterId" | "conditions" | "revision"
>;
