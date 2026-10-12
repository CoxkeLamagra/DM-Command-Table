import test from "node:test";
import assert from "node:assert/strict";
import { isPackageWork, withPackageWork } from "../server/http/package-work.ts";
test("package admission is bounded before body reading and releases on both success and failure", async () => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = withPackageWork(() => hold),
    second = withPackageWork(() => hold);
  let reached = false;
  await assert.rejects(
    () =>
      withPackageWork(async () => {
        reached = true;
      }),
    { status: 503 },
  );
  assert.equal(reached, false);
  release();
  await Promise.all([first, second]);
  await assert.rejects(
    () =>
      withPackageWork(async () => {
        throw new Error("failed");
      }),
    /failed/,
  );
  assert.equal(await withPackageWork(async () => "ready"), "ready");
  assert.equal(isPackageWork("/api/campaigns/import"), true);
  assert.equal(isPackageWork("/api/campaigns/id/package"), true);
  assert.equal(isPackageWork("/api/campaigns/id/combat"), false);
});
