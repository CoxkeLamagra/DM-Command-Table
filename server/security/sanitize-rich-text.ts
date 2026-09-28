import sanitizeHtml from "sanitize-html";
import type { CampaignState } from "../../features/campaign/types.ts";
import { RICH_TEXT_TAGS, safeColorPatterns } from "../../features/rich-text/policy.ts";

const RICH_TEXT_KEYS = new Set([
  "campaignNotes",
  "notes",
  "body",
  "details",
  "abilities",
  "spells",
]);

export function sanitizeCampaignRichText(value: CampaignState): CampaignState {
  return sanitizeValue(value, "") as CampaignState;
}

function sanitizeValue(value: unknown, key: string): unknown {
  if (typeof value === "string")
    return RICH_TEXT_KEYS.has(key) ? sanitizeRichText(value) : value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, key));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      sanitizeValue(childValue, childKey),
    ]),
  );
}

export function sanitizeRichText(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [...RICH_TEXT_TAGS],
    allowedAttributes: {
      font: ["color"],
      span: ["style"],
    },
    allowedStyles: {
      "*": {
        color: safeColorPatterns(),
      },
    },
    disallowedTagsMode: "discard",
  });
}
