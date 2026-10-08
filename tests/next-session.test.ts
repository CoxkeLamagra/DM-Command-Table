import assert from "node:assert/strict";
import test from "node:test";
import { nextSession } from "../features/shared/next-session.ts";
import type { V6Session } from "../features/v6/types.ts";
function session(
  id: string,
  status: V6Session["status"],
  date: string,
  sortOrder = 0,
): V6Session {
  return {
    id,
    campaignId: "campaign",
    title: id,
    status,
    date,
    sortOrder,
    notes: "",
    revision: 1,
    createdAt: "",
    updatedAt: "",
  };
}
test("next-session shortcuts continue active sessions, then order planned dates with undated last", () => {
  const values = [
    session("done", "happened", "2026-01-01"),
    session("undated", "planned", ""),
    session("later", "planned", "2026-11-10"),
    session("earlier", "planned", "2026-10-15"),
    session("active", "active", "2026-11-20"),
  ];
  assert.equal(nextSession(values)?.id, "active");
  assert.equal(
    nextSession(values.filter(({ status }) => status !== "active"))?.id,
    "earlier",
  );
  assert.deepEqual(
    values.map(({ id }) => id),
    ["done", "undated", "later", "earlier", "active"],
  );
  assert.equal(nextSession([values[0]]), undefined);
  assert.equal(nextSession([]), undefined);
});
test("undated session shortcuts use a stable sort order", () => {
  assert.equal(
    nextSession([
      session("b", "planned", "", 1),
      session("a", "planned", "", 0),
    ])?.id,
    "a",
  );
});
