import { ApiError } from "./errors";
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      cache: "no-store",
      ...init,
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
  } catch {
    emitConnectivity(false);
    throw new ApiError("The local server could not be reached.", 0);
  }
  emitConnectivity(true);
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  } & T;
  if (!response.ok) {
    if (response.status === 409 && typeof window !== "undefined")
      window.dispatchEvent(
        new CustomEvent("workspace:conflict", { detail: { path, body } }),
      );
    throw new ApiError(
      body.error ?? "The request could not be completed.",
      response.status,
      body.code,
      body,
    );
  }
  if ((init.method ?? "GET").toUpperCase() !== "GET") emitMutation(path);
  return body;
}

export const CLIENT_INSTANCE_ID =
  typeof crypto === "undefined" ? "server" : crypto.randomUUID();

function emitConnectivity(online: boolean) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("workspace:connectivity", { detail: { online } }),
    );
}

function emitMutation(path: string) {
  if (typeof window === "undefined") return;
  const detail = {
    path,
    campaignId: path.match(/\/api\/campaigns\/([^/?]+)/)?.[1] ?? null,
    source: "local",
  };
  window.dispatchEvent(new CustomEvent("workspace:mutation", { detail }));
  try {
    const channel = new BroadcastChannel("dm-command-table");
    channel.postMessage({
      ...detail,
      source: "remote",
      clientInstanceId: CLIENT_INSTANCE_ID,
    });
    channel.close();
  } catch {
    /* BroadcastChannel is an enhancement, not a requirement. */
  }
}

export function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
