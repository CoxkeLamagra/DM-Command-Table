import { isLocalMediaUrl } from "../../domain/local-media.ts";
import sanitizeHtml from "sanitize-html";
import {
  RICH_TEXT_TAGS,
  safeColorPatterns,
} from "../../features/rich-text/policy.ts";

export function sanitizeRichText(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [...RICH_TEXT_TAGS],
    allowedAttributes: {
      font: ["color"],
      span: ["style"],
      img: ["src", "alt"],
    },
    allowedStyles: {
      "*": {
        color: safeColorPatterns(),
      },
    },
    disallowedTagsMode: "discard",
    exclusiveFilter(frame) {
      return frame.tag === "img" && !isLocalMediaUrl(frame.attribs.src ?? "");
    },
  });
}
