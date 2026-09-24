import assert from "node:assert/strict";
import test from "node:test";
import {
  appendScreenshotToken,
  parseScreenshotNotes,
  screenshotToken,
} from "../features/screenshots/tokens.ts";

test("screenshot references retain their existing portable token format", () => {
  assert.equal(screenshotToken("abc-123"), "[[screenshot:abc-123]]");
  assert.equal(
    appendScreenshotToken("Notes  \n", "abc-123"),
    "Notes\n[[screenshot:abc-123]]",
  );
});

test("note parsing preserves text and screenshot order", () => {
  assert.deepEqual(
    parseScreenshotNotes("Before\n[[screenshot:abc-123]]\nAfter"),
    [
      { text: "Before\n" },
      { screenshotId: "abc-123" },
      { text: "\nAfter" },
    ],
  );
});
