export function shouldUseSecureCookie(
  mode: "auto" | "always" | "never",
  headers: Pick<Headers, "get">,
  trustProxy: boolean,
): boolean {
  if (mode !== "auto") return mode === "always";
  if (
    trustProxy &&
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
  )
    return true;
  const host =
    headers.get("host") ||
    (trustProxy
      ? headers.get("x-forwarded-host")?.split(",")[0]?.trim()
      : null);
  try {
    const origin = new URL(headers.get("origin") ?? "");
    return origin.protocol === "https:" && origin.host === host;
  } catch {
    return false;
  }
}
