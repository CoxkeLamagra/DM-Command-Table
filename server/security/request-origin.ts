type RequestHeaders = Pick<Headers, "get">;
export function requestHost(
  headers: RequestHeaders,
  trustProxy: boolean,
): string | null {
  return (
    headers.get("host") ||
    (trustProxy
      ? headers.get("x-forwarded-host")?.split(",")[0]?.trim()
      : null) ||
    null
  );
}
export function sameHostWebOrigin(
  origin: string | null,
  host: string | null,
): boolean {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      url.host === host
    );
  } catch {
    return false;
  }
}
