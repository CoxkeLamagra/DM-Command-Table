import { requestHost, sameHostWebOrigin } from "./request-origin.ts";
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
  const origin = headers.get("origin");
  return (
    sameHostWebOrigin(origin, requestHost(headers, trustProxy)) &&
    origin!.startsWith("https:")
  );
}
