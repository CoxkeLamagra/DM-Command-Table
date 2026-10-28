import { parseInput } from "../http/validation.ts";
import { z } from "zod";
import { apiJson } from "../http/http.ts";
import { createSupportRepository } from "../support/support-repository.ts";
import type { RouteInput } from "./route-input.ts";
export async function handleSearchRoutes(
  input: RouteInput,
): Promise<Response | null> {
  const { database, context, campaignId, resource, method, url } = input;
  const support = createSupportRepository(database);
  if (resource === "search" && method === "GET") {
    return apiJson({
      results: support.search(
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

  return null;
}
