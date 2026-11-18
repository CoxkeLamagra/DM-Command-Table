import { createConnection } from "node:net";
import type { UpdateState } from "../../domain/updates.ts";
import { requestUpdateService } from "./update-client.ts";

export function updateRequest(
  action: "status" | "start",
  actor?: string,
): Promise<UpdateState> {
  return requestUpdateService(
    createConnection("/run/dm-command-table-updater/control.sock"),
    action,
    actor,
  );
}
