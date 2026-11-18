import type { Socket } from "node:net";
import { StringDecoder } from "node:string_decoder";
import type { UpdateState } from "../../domain/updates.ts";

// One newline-delimited response. The deadline includes connect and receive time;
// packet activity must not extend a status request indefinitely.
export function requestUpdateService(
  socket: Socket,
  action: "status" | "start",
  actor?: string,
  timeoutMs = 5000,
): Promise<UpdateState> {
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder("utf8");
    let buffer = "",
      bytes = 0,
      settled = false;
    const deadline = setTimeout(
      () => finish(undefined, new Error("The update service did not respond.")),
      timeoutMs,
    );
    function finish(value?: UpdateState, error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      socket.destroy();
      if (error) reject(error);
      else resolve(value!);
    }
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
    const closed = () =>
      finish(undefined, new Error("The update service closed the connection."));
    socket.on("end", closed);
    socket.on("close", closed);
    socket.on("data", (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > 512 * 1024)
        return finish(undefined, new Error("Invalid update service response."));
      buffer += decoder.write(chunk);
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      try {
        const value = JSON.parse(buffer.slice(0, end));
        if (value.error || value.available !== true)
          throw new Error("Invalid update service response.");
        finish(value);
      } catch {
        finish(undefined, new Error("Invalid update service response."));
      }
    });
  });
}
