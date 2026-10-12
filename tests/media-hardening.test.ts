import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMigrations } from "../db/migrations.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";

import { createSupportRepository } from "../server/support/support-repository.ts";
import {
  syncScreenshotReferences,
  listScreenshots,
} from "../server/media/screenshots.ts";
import { screenshotResponse } from "../server/media/screenshot-response.ts";
import { exportCampaign } from "../server/campaigns/campaign-portable.ts";
import { importCampaignPackage } from "../server/campaigns/campaign-package.ts";
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  runMigrations(db);
  db.exec(
    "INSERT INTO users VALUES('owner','Owner','owner','hash',1,1,1),('uploader','Uploader','uploader','hash',0,1,1),('viewer','Viewer','viewer','hash',0,1,1)",
  );
  const campaign = createCampaignRepository(db).create("owner", {
    name: "Images",
  });
  db.prepare(
    "INSERT INTO campaign_members VALUES(?,'viewer','viewer',1,1)",
  ).run(campaign.id);
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES(?,?,?,'image/webp',4,'uploader',1)",
  ).run(id, id + ".webp", "map");
  db.prepare(
    "INSERT INTO screenshot_references VALUES(?,?, 'session','resource',1)",
  ).run(id, campaign.id);
  return { db, campaign, id };
}
test("resaving the only screenshot reference retains access after uploader deletion; failed replacements are atomic", () => {
  const f = fixture();
  try {
    f.db.prepare("DELETE FROM users WHERE id='uploader'").run();
    syncScreenshotReferences(
      f.db,
      f.campaign.id,
      "owner",
      "session",
      "resource",
      `<img src="/api/screenshots/${f.id}">`,
    );
    assert.equal(listScreenshots(f.db, "viewer", false)[0].id, f.id);
    const support = createSupportRepository(f.db);
    support.setScreenshotReferences(
      f.campaign.id,
      "owner",
      "session",
      "resource",
      [f.id],
    );
    assert.throws(
      () =>
        support.setScreenshotReferences(
          f.campaign.id,
          "owner",
          "session",
          "resource",
          [f.id, crypto.randomUUID()],
        ),
      /not found/i,
    );
    assert.equal(listScreenshots(f.db, "viewer", false)[0].id, f.id);
  } finally {
    f.db.close();
  }
});
test("screenshot streams preserve bytes and conditional requests reauthorize after sharing revocation", async () => {
  const f = fixture(),
    dir = mkdtempSync(path.join(tmpdir(), "dmct-stream-")),
    prior = process.env.DM_COMMAND_TABLE_UPLOAD_PATH;
  process.env.DM_COMMAND_TABLE_UPLOAD_PATH = dir;
  try {
    const bytes = Buffer.alloc(256 * 1024, 7);
    writeFileSync(path.join(dir, f.id + ".webp"), bytes);
    const url = `http://local/api/screenshots/${f.id}`;
    const response = await screenshotResponse(
      f.db,
      f.id,
      "viewer",
      false,
      new Request(url),
    );
    assert.ok(response);
    assert.equal(response.headers.get("cache-control"), "private, no-cache");
    assert.equal(Number(response.headers.get("content-length")), bytes.length);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    const conditional = new Request(url, {
      headers: { "if-none-match": response.headers.get("etag")! },
    });
    const cached = await screenshotResponse(
      f.db,
      f.id,
      "viewer",
      false,
      conditional,
    );
    assert.equal(cached!.status, 304);
    f.db.prepare("DELETE FROM campaign_members WHERE user_id='viewer'").run();
    assert.equal(
      await screenshotResponse(f.db, f.id, "viewer", false, conditional),
      null,
    );
    const controller = new AbortController();
    const aborted = await screenshotResponse(
      f.db,
      f.id,
      "owner",
      false,
      new Request(url, { signal: controller.signal }),
    );
    controller.abort();
    await assert.rejects(() => aborted!.arrayBuffer());
  } finally {
    f.db.close();
    rmSync(dir, { recursive: true, force: true });
    if (prior === undefined) delete process.env.DM_COMMAND_TABLE_UPLOAD_PATH;
    else process.env.DM_COMMAND_TABLE_UPLOAD_PATH = prior;
  }
});
test("invalid or excess-asset campaign packages reject before image processing and leave no staged writes", async () => {
  const f = fixture();
  try {
    const asset = {
      id: crypto.randomUUID(),
      name: "unused.webp",
      bytes: "not image data",
    };
    await assert.rejects(
      () =>
        importCampaignPackage(f.db, "owner", {
          format: "dmct-campaign-package",
          version: 1,
          campaign: { invalid: true },
          assets: [asset],
        }),
      /supported current campaign/,
    );
    const portable = exportCampaign(f.db, f.campaign.id, "owner");
    await assert.rejects(
      () =>
        importCampaignPackage(f.db, "owner", {
          format: "dmct-campaign-package",
          version: 1,
          campaign: portable,
          assets: [asset],
        }),
      /unused images/,
    );
    assert.equal(
      (
        f.db.prepare("SELECT COUNT(*) AS n FROM screenshots").get() as {
          n: number;
        }
      ).n,
      1,
    );
    assert.equal(
      (
        f.db.prepare("SELECT COUNT(*) AS n FROM campaigns").get() as {
          n: number;
        }
      ).n,
      1,
    );
  } finally {
    f.db.close();
  }
});
