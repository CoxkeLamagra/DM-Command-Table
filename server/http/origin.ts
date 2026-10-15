import { requestHost, sameHostWebOrigin } from "../security/request-origin.ts";
export function rejectCrossOrigin(request: Request): Response | null {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return invalidOrigin();
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return sameHostWebOrigin(
    origin,
    requestHost(
      request.headers,
      process.env.DM_COMMAND_TABLE_TRUST_PROXY === "true",
    ),
  )
    ? null
    : invalidOrigin();
}

function invalidOrigin(): Response {
  return Response.json({ error: "Invalid request origin." }, { status: 403 });
}
