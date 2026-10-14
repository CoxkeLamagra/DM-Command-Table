import assert from "node:assert/strict";
import test from "node:test";
import { requestJson } from "../features/shared/api/transport.ts";
import { ApiError } from "../features/shared/api/errors.ts";

test("only revision conflicts trigger the workspace save-conflict event", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: events,
  });
  let conflicts = 0;
  events.addEventListener("workspace:conflict", () => conflicts++);
  try {
    for (const body of [
      { error: "Remove this monster from prepared encounters first." },
      { error: "Changed", code: "revision_conflict" },
    ]) {
      globalThis.fetch = async () => Response.json(body, { status: 409 });
      await assert.rejects(
        requestJson("/api/campaigns/example/monsters/bulk-delete", {
          method: "POST",
        }),
        (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.equal(error.message, body.error);
          assert.equal(error.status, 409);
          return true;
        },
      );
      assert.equal(conflicts, body.code === "revision_conflict" ? 1 : 0);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
