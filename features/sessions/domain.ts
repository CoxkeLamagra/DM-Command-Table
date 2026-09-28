import type {
  PreparedEncounter,
  PreparedEncounterMonster,
  ProgressStatus,
  SessionNote,
} from "@/features/campaign/types";

type IdFactory = () => string;

export function createSessionNote(createId: IdFactory, date: string): SessionNote {
  return {
    id: createId(),
    title: "New session",
    date,
    body: "",
    done: false,
    status: "planned",
    encounters: [],
  };
}

export function getSessionStatus(session: SessionNote): ProgressStatus {
  return session.status ?? (session.done ? "happened" : "planned");
}

export function sessionStatusLabel(status: ProgressStatus): string {
  if (status === "active") return "Active now";
  if (status === "happened") return "Happened";
  return "Planned";
}

export function createPreparedEncounter(
  index: number,
  createId: IdFactory,
): PreparedEncounter {
  return {
    id: createId(),
    name: `Encounter ${index + 1}`,
    monsters: [],
  };
}

export function addPreparedMonster(
  encounter: PreparedEncounter,
  monsterId: string,
  createId: IdFactory,
): PreparedEncounterMonster {
  const nextNumber =
    Math.max(
      0,
      ...encounter.monsters
        .filter((entry) => entry.monsterId === monsterId)
        .map((entry) => entry.number ?? 0),
    ) + 1;
  return { id: createId(), monsterId, number: nextNumber };
}
