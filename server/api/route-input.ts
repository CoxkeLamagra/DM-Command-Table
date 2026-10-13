import type { DatabaseSync } from "node:sqlite";
import type { ApiContext } from "../http/http.ts";
export type RouteInput = {
  request: Request;
  database: DatabaseSync;
  context: ApiContext;
  campaignId: string;
  resource: string;
  resourceId: string | undefined;
  segments: string[];
  method: string;
  url: URL;
};
