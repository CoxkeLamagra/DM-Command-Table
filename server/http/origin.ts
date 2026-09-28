export function rejectCrossOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const requestHost =
    request.headers.get("host") ||
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (!requestHost) return invalidOrigin();
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== requestHost) return invalidOrigin();
    return null;
  } catch {
    return invalidOrigin();
  }
}

function invalidOrigin(): Response {
  return Response.json({ error: "Invalid request origin." }, { status: 403 });
}
