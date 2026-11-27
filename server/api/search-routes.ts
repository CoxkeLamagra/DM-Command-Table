import { parseInput } from "../http/validation.ts";
import { z } from "zod";
import { apiJson } from "../http/http.ts";
import { createSupportRepository } from "../support/support-repository.ts";
import type { RouteInput } from "./route-table.ts";

export function searchCampaign({
  database,
  context,
  campaignId,
  url,
}: RouteInput) {
  return apiJson({
    results: createSupportRepository(database).search(
      campaignId,
      context.userId,
      url.searchParams.get("q") ?? "",
      100,
      parseInput(
        z.enum(["all", "session", "story", "player", "npc", "monster"]),
        url.searchParams.get("type") ?? "all",
      ),
    ),
  });
}
