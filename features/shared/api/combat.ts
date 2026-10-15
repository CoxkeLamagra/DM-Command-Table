import type { Combat, PreparedEncounter } from "@/domain/types";
import { requestJson, json } from "./transport";
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

export async function commandCombat(
  campaignId: string,
  combat: Combat,
  command: import("@/domain/combat").CombatAction,
  zeroHpPolicy: import("@/domain/combat").ZeroHpPolicy = "skip-all",
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
  preservePlayersAndNpcs = false,
): Promise<Combat> {
  return (
    await requestJson<{ combat: Combat }>(
      `/api/campaigns/${campaignId}/combat/load-prepared`,
      json("POST", { prepared, revision, preservePlayersAndNpcs }),
    )
  ).combat;
}
