import type {
  PreparedEncounter,
  Session,
  SessionTemplate,
} from "@/domain/types";
import { requestJson, json } from "./transport";
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

export async function reorderPreparedEncounters(
  campaignId: string,
  sessionId: string,
  order: Pick<PreparedEncounter, "id" | "revision">[],
): Promise<PreparedEncounter[]> {
  return (
    await requestJson<{ encounters: PreparedEncounter[] }>(
      `/api/campaigns/${campaignId}/sessions/${sessionId}/encounters/reorder`,
      json("POST", { order }),
    )
  ).encounters;
}
