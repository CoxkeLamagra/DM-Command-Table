export function rejectCrossOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (!requestHost) return invalidOrigin();
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== requestHost) return invalidOrigin();
    if (forwardedProtocol && originUrl.protocol !== `${forwardedProtocol}:`)
      return invalidOrigin();
    return null;
  } catch {
    return invalidOrigin();
  }
}

function invalidOrigin(): Response {
  return Response.json({ error: "Invalid request origin." }, { status: 403 });
}
