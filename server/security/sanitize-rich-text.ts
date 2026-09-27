import sanitizeHtml from "sanitize-html";
import type { CampaignState } from "@/features/campaign/types";

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
    allowedTags: [
      "b",
      "br",
      "div",
      "em",
      "font",
      "i",
      "li",
      "ol",
      "p",
      "span",
      "strong",
      "u",
      "ul",
    ],
    allowedAttributes: {
      font: ["color"],
      span: ["style"],
    },
    allowedStyles: {
      "*": {
        color: [
          /^#[0-9a-f]{3,8}$/i,
          /^rgba?\([\d\s,.%]+\)$/i,
          /^[a-z]+$/i,
        ],
      },
    },
    disallowedTagsMode: "discard",
  });
}
