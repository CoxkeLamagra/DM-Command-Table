// An opt-in single HTTPS origin for Internet deployments; no forwarding header
// can change this configured identity. LAN deployments leave it unset.
export function publicOrigin(
  value = process.env.DM_COMMAND_TABLE_PUBLIC_ORIGIN,
): URL | null {
  if (value === undefined || value === "") return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "DM_COMMAND_TABLE_PUBLIC_ORIGIN must be a valid HTTPS origin.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "DM_COMMAND_TABLE_PUBLIC_ORIGIN must be a single HTTPS origin without credentials, path, query or fragment.",
    );
  return url;
}

export function permittedPublicRequest(
  headers: Pick<Headers, "get">,
  pathname: string,
  configured = publicOrigin(),
): boolean {
  if (!configured) return true;
  const host = headers.get("host")?.toLowerCase();
  // Local health probes remain available to the stopped-service update/rollback
  // helper. No other route receives this exception; the response has no data.
  if (
    pathname === "/api/health" &&
    /^(127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host ?? "")
  )
    return true;
  if (host !== configured.host) return false;
  const origin = headers.get("origin");
  return !origin || origin === configured.origin;
}
