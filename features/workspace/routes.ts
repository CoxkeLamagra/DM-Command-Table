import type { Section } from "../../domain/types.ts";
const sections = new Set<Section>([
  "campaign",
  "story",
  "sessions",
  "players",
  "bestiary",
  "combat",
  "search",
  "account",
  "administration",
]);
export function parseWorkspacePath(
  pathname: string,
): { campaignId: string; section: Section; recordId?: string } | null {
  const [, prefix, campaignId, section, recordId] = pathname.split("/");
  if (
    prefix !== "campaigns" ||
    !campaignId ||
    !sections.has(section as Section)
  )
    return null;
  return { campaignId, section: section as Section, recordId };
}
export function workspacePath(
  campaignId: string,
  section: Section,
  recordId?: string,
): string {
  return `/campaigns/${encodeURIComponent(campaignId)}/${section}${recordId ? `/${encodeURIComponent(recordId)}` : ""}`;
}
