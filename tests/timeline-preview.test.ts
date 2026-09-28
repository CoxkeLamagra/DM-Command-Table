import assert from "node:assert/strict";
import test from "node:test";
import { createTimelinePreview } from "../features/campaign/timeline-preview.ts";

test("timeline previews are capped and omit screenshot tokens", () => {
  assert.deepEqual(createTimelinePreview("Before [[screenshot:abc-123]] after", 20), {
    text: "Before  after",
    truncated: false,
  });
  assert.deepEqual(createTimelinePreview("abcdef", 4), {
    text: "abcd",
    truncated: true,
  });
});
