import { AsyncLocalStorage } from "node:async_hooks";
import { PublicApiError, RequestTooLargeError } from "./errors.ts";

const MAX_READERS = 8;
const MAX_RESERVED_BYTES = 64 * 1024 * 1024;
const actors = new AsyncLocalStorage<string>();
const perActor = new Map<string, number>();
export function withBodyActor<T>(actor: string, operation: () => T): T {
  return actors.run(actor, operation);
}

let active = 0,
  reserved = 0;

// Own admission, deadlines and cleanup in one place for JSON and multipart.
export async function readRequestBody(
  request: Request,
  maximumBytes: number,
  timeoutMs = 30_000,
): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes)
    throw new RequestTooLargeError();
  if (!request.body) throw new SyntaxError("The request body is empty.");
  const actor = actors.getStore();
  if (
    (actor && (perActor.get(actor) ?? 0) >= 2) ||
    active >= MAX_READERS ||
    reserved + maximumBytes > MAX_RESERVED_BYTES
  )
    throw new PublicApiError(
      "Request processing is busy. Please retry shortly.",
      503,
    );
  const reader = request.body.getReader();
  active++;
  if (actor) perActor.set(actor, (perActor.get(actor) ?? 0) + 1);
  reserved += maximumBytes;
  let failure: PublicApiError | undefined;
  let completed = false;
  const interrupt = (error: PublicApiError) => {
    failure ??= error;
    // Cancelling closes the reader immediately, waking a pending read without
    // queuing a Promise.race listener for every attacker-controlled chunk.
    void reader.cancel().catch(() => undefined);
  };
  const timer = setTimeout(
    () => interrupt(new PublicApiError("Request body timed out.", 408)),
    timeoutMs,
  );
  const abort = () =>
    interrupt(new PublicApiError("Request was cancelled.", 400));
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  try {
    let buffer = new Uint8Array(Math.min(maximumBytes, 64 * 1024));
    let size = 0;
    while (true) {
      if (failure) throw failure;
      const { done, value } = await reader.read();
      if (failure) throw failure;
      if (done) break;
      const next = size + value.byteLength;
      if (next > maximumBytes) throw new RequestTooLargeError();
      if (next > buffer.length) {
        const grown = new Uint8Array(
          Math.min(maximumBytes, Math.max(next, buffer.length * 2)),
        );
        grown.set(buffer.subarray(0, size));
        buffer = grown;
      }
      buffer.set(value, size);
      size = next;
    }
    completed = true;
    return buffer.slice(0, size);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    if (!completed) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
    active--;
    if (actor) {
      const count = (perActor.get(actor) ?? 1) - 1;
      if (count) perActor.set(actor, count);
      else perActor.delete(actor);
    }
    reserved -= maximumBytes;
  }
}
