export type AdventureThread = {
  id: string;
  title: string;
  kind: "promise" | "clue" | "consequence" | "objective";
  status: "open" | "resolved";
  notes: string;
};
export type PartyPreset = { id: string; name: string; playerIds: string[] };
export type CampaignAdventure = {
  threads: AdventureThread[];
  partyPresets: PartyPreset[];
  oneShot: { durationMinutes: number } | null;
};
export type PlannedScene = {
  id: string;
  title: string;
  notes: string;
  essential: boolean;
  minutes: number;
  done: boolean;
};
export type SessionContinuity = {
  recap: string;
  rewards: string;
  scenes: PlannedScene[];
  threadIds: string[];
  attendanceIds: string[];
};
export function emptyAdventure(): CampaignAdventure {
  return { threads: [], partyPresets: [], oneShot: null };
}
export function emptyContinuity(): SessionContinuity {
  return {
    recap: "",
    rewards: "",
    scenes: [],
    threadIds: [],
    attendanceIds: [],
  };
}
export function remapAdventure(
  value: CampaignAdventure,
  players: Map<string, string>,
  reset = false,
): CampaignAdventure {
  return {
    ...value,
    threads: value.threads.map((thread) => ({
      ...thread,
      status: reset ? "open" : thread.status,
    })),
    partyPresets: value.partyPresets.map((preset) => ({
      ...preset,
      playerIds: preset.playerIds.flatMap((id) => players.get(id) ?? []),
    })),
  };
}
export function remapContinuity(
  value: SessionContinuity,
  players: Map<string, string>,
  reset = false,
): SessionContinuity {
  return {
    ...value,
    recap: reset ? "" : value.recap,
    rewards: reset ? "" : value.rewards,
    scenes: value.scenes.map((scene) => ({
      ...scene,
      done: reset ? false : scene.done,
    })),
    attendanceIds: reset
      ? []
      : value.attendanceIds.flatMap((id) => players.get(id) ?? []),
  };
}
export function carryContinuity(
  value: SessionContinuity,
  sceneIds: string[],
  threadIds: string[],
): SessionContinuity {
  return {
    ...emptyContinuity(),
    attendanceIds: [...value.attendanceIds],
    threadIds: [...threadIds],
    scenes: value.scenes
      .filter((scene) => !scene.done && sceneIds.includes(scene.id))
      .map((scene) => ({ ...scene, id: crypto.randomUUID(), done: false })),
  };
}
