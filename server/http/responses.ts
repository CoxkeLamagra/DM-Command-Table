const PRIVATE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
};

export function privateJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

export function jsonError(message: string, status: number): Response {
  return privateJson({ error: message }, status);
}
