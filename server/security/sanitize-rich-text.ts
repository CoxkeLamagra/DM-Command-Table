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
      return (
        frame.tag === "img" &&
        !/^\/api\/screenshots\/[0-9a-f-]+$/i.test(frame.attribs.src ?? "")
      );
    },
  });
}
