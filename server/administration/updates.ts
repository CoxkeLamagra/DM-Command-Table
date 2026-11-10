import { createConnection } from "node:net";
import type { UpdateState } from "../../domain/updates.ts";

export function updateRequest(
  action: "status" | "start",
  actor?: string,
): Promise<UpdateState> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(
      "/run/dm-command-table-updater/control.sock",
    );
    let buffer = "",
      settled = false;
    function finish(value?: UpdateState, error?: Error) {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value!);
    }
    socket.setTimeout(5000, () =>
      finish(undefined, new Error("The update service did not respond.")),
    );
    socket.on("connect", () =>
      socket.write(
        JSON.stringify(action === "start" ? { action, actor } : { action }) +
          "\n",
      ),
    );
    socket.on("error", (error: NodeJS.ErrnoException) => {
      if (
        action === "status" &&
        ["ENOENT", "ECONNREFUSED", "EACCES", "EPERM"].includes(error.code ?? "")
      )
        finish({ available: false, job: null });
      else
        finish(
          undefined,
          new Error("The local update service is unavailable."),
        );
    });
    socket.on("end", () =>
      finish(undefined, new Error("The update service closed the connection.")),
    );
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (Buffer.byteLength(buffer) > 512 * 1024)
        return finish(undefined, new Error("Invalid update service response."));
      if (!buffer.includes("\n")) return;
      try {
        const value = JSON.parse(buffer.slice(0, buffer.indexOf("\n")));
        if (value.error || value.available !== true)
          throw new Error("Invalid update service response.");
        finish(value);
      } catch {
        finish(undefined, new Error("Invalid update service response."));
      }
    });
  });
}
