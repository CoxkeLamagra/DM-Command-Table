import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrations, runMigrations } from "../db/migrations.ts";
import { emptyAdventure, emptyContinuity } from "../domain/adventure.ts";
import { printPacket } from "../domain/print-packet.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createContentRepository } from "../server/content/content-repository.ts";
import {
  prepareNextSession,
  quickStart,
} from "../server/content/adventure-service.ts";
import { copyCampaign } from "../server/campaigns/campaign-copy.ts";
import {
  exportCampaign,
  importCampaign,
} from "../server/campaigns/campaign-portable.ts";
import { handleApi } from "../server/api/api-router.ts";
function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  runMigrations(database);
  database.exec(
    "INSERT INTO users VALUES('owner','Owner','owner','hash',1,1,1),('viewer','Viewer','viewer','hash',0,1,1)",
  );
  const campaigns = createCampaignRepository(database),
    content = createContentRepository(database);
  const initial = campaigns.create("owner", { name: "Continuity" });
  database
    .prepare("INSERT INTO campaign_members VALUES(?,?,'viewer',1,1)")
    .run(initial.id, "viewer");
  const hero = content.createPlayer(initial.id, "owner", {
    name: "Hero",
    kind: "player",
    race: "Human",
    className: "Fighter",
    level: 3,
    hitPoints: 25,
    armorClass: 17,
    notes: "",
  });
  const guide = content.createPlayer(initial.id, "owner", {
    name: "Guide",
    kind: "npc",
    race: "",
    className: "",
    level: null,
    hitPoints: 12,
    armorClass: 10,
    notes: "",
  });
  const thread = {
    id: crypto.randomUUID(),
    title: "Find the missing scale",
    kind: "clue" as const,
    status: "open" as const,
    notes: "<p>Green scale</p><script>alert(1)</script>",
  };
  const resolved = {
    ...thread,
    id: crypto.randomUUID(),
    title: "Promise kept",
    status: "resolved" as const,
  };
  const preset = {
    id: crypto.randomUUID(),
    name: "Tonight",
    playerIds: [hero.id, guide.id],
  };
  const campaign = campaigns.update(
    initial.id,
    "owner",
    campaigns.get(initial.id, "owner")!.revision,
    {
      adventure: {
        ...emptyAdventure(),
        threads: [thread, resolved],
        partyPresets: [preset],
      },
    },
  );
  const scenes = [
    {
      id: crypto.randomUUID(),
      title: "Completed opening",
      notes: "",
      essential: true,
      minutes: 15,
      done: true,
    },
    {
      id: crypto.randomUUID(),
      title: "Unfinished lead",
      notes: "<p>Ask the guide</p>",
      essential: false,
      minutes: 30,
      done: false,
    },
  ];
  const session = content.createSession(campaign.id, "owner", {
    title: "Session one",
    date: "",
    notes: "<p>Planned opening</p>",
    status: "happened",
    sortOrder: 0,
    continuity: {
      ...emptyContinuity(),
      recap: "<p>The party found a clue</p>",
      rewards: "<p>50 gold</p>",
      scenes,
      threadIds: [thread.id, resolved.id],
      attendanceIds: [hero.id, guide.id],
    },
  });
  return {
    database,
    campaigns,
    content,
    campaign,
    session,
    thread,
    resolved,
    preset,
    hero,
    guide,
  };
}
test("preparation and recap persist separately, sanitization removes scripts and old PATCH values retain continuity", () => {
  const f = fixture();
  try {
    assert.equal(
      f.content.listSessions(f.campaign.id, "owner")[0].continuity?.recap,
      "<p>The party found a clue</p>",
    );
    assert.equal(
      f.campaigns.get(f.campaign.id, "owner")!.adventure!.threads[0].notes,
      "<p>Green scale</p>",
    );
    const patched = f.content.updateSession(
      f.campaign.id,
      "owner",
      f.session.id,
      f.session.revision,
      {
        title: "Renamed",
        date: "",
        notes: f.session.notes,
        status: "happened",
        sortOrder: 0,
      },
    );
    assert.deepEqual(patched.continuity, f.session.continuity);
    const other = f.campaigns.create("owner", { name: "Other" });
    assert.throws(
      () =>
        f.content.createSession(other.id, "owner", {
          ...f.session,
          continuity: { ...emptyContinuity(), attendanceIds: [f.hero.id] },
        }),
      /belong to this campaign/,
    );
    assert.equal(f.content.listSessions(other.id, "owner").length, 0);
    assert.throws(
      () =>
        f.content.updateSession(
          other.id,
          "owner",
          f.session.id,
          patched.revision,
          { ...patched },
        ),
      /not found/i,
    );
    assert.throws(
      () =>
        f.content.updateSession(
          f.campaign.id,
          "owner",
          f.session.id,
          f.session.revision,
          { ...f.session },
        ),
      /changed/i,
    );
  } finally {
    f.database.close();
  }
});
test("prepare next session carries selected unfinished scenes/open threads with fresh IDs and revision protection", () => {
  const f = fixture();
  try {
    const current = f.campaigns.get(f.campaign.id, "owner")!;
    const input = {
      revision: f.session.revision,
      campaignRevision: current.revision,
      title: "Next",
      date: "",
      sceneIds: [f.session.continuity!.scenes[1].id],
      threadIds: [f.thread.id],
    };
    assert.throws(
      () =>
        prepareNextSession(f.database, f.campaign.id, f.session.id, "owner", {
          ...input,
          sceneIds: [f.session.continuity!.scenes[0].id],
        }),
      /unfinished/,
    );
    assert.equal(f.content.listSessions(f.campaign.id, "owner").length, 1);
    const next = prepareNextSession(
      f.database,
      f.campaign.id,
      f.session.id,
      "owner",
      input,
    );
    assert.equal(next.status, "planned");
    assert.equal(next.continuity!.recap, "");
    assert.equal(next.continuity!.rewards, "");
    assert.equal(next.continuity!.scenes.length, 1);
    assert.notEqual(next.continuity!.scenes[0].id, input.sceneIds[0]);
    assert.equal(next.continuity!.scenes[0].essential, false);
    assert.deepEqual(next.continuity!.attendanceIds, [f.hero.id, f.guide.id]);
    assert.deepEqual(next.continuity!.threadIds, [f.thread.id]);
    assert.deepEqual(
      f.content
        .listSessions(f.campaign.id, "owner")
        .find((session) => session.id === f.session.id),
      f.session,
    );
    assert.throws(
      () =>
        prepareNextSession(
          f.database,
          f.campaign.id,
          f.session.id,
          "owner",
          input,
        ),
      /changed/i,
    );
    assert.throws(
      () =>
        prepareNextSession(
          f.database,
          f.campaign.id,
          f.session.id,
          "viewer",
          input,
        ),
      /edit|permission|access/i,
    );
  } finally {
    f.database.close();
  }
});
test("one-shot quick start copies the selected party into exactly one fresh session without modifying the source", () => {
  const f = fixture();
  try {
    const current = f.campaigns.get(f.campaign.id, "owner")!;
    const before = f.content.listPlayers(current.id, "owner");
    const result = quickStart(f.database, "owner", {
      name: "One-shot",
      durationMinutes: 180,
      sourceCampaignId: current.id,
      sourceRevision: current.revision,
      presetId: f.preset.id,
      scenes: f.session.continuity!.scenes,
    });
    assert.equal(f.content.listSessions(result.campaign.id, "owner").length, 1);
    assert.equal(result.campaign.adventure?.oneShot?.durationMinutes, 180);
    assert.equal(
      result.session.continuity!.scenes.every((scene) => !scene.done),
      true,
    );
    const copies = f.content.listPlayers(result.campaign.id, "owner");
    assert.equal(copies.length, 2);
    assert.ok(
      copies.every((player) => ![f.hero.id, f.guide.id].includes(player.id)),
    );
    assert.deepEqual(
      new Set(result.session.continuity!.attendanceIds),
      new Set(copies.map((player) => player.id)),
    );
    assert.deepEqual(f.content.listPlayers(current.id, "owner"), before);
    const count = f.campaigns.list("owner").length;
    assert.throws(
      () =>
        quickStart(f.database, "owner", {
          name: "Bad",
          durationMinutes: 120,
          sourceCampaignId: current.id,
          sourceRevision: current.revision,
          presetId: crypto.randomUUID(),
          scenes: f.session.continuity!.scenes,
        }),
      /not found/i,
    );
    assert.equal(f.campaigns.list("owner").length, count);
  } finally {
    f.database.close();
  }
});
test("portable imports and campaign/template copies remap party links and reset only reusable progress", () => {
  const f = fixture();
  try {
    const imported = importCampaign(
      f.database,
      "owner",
      exportCampaign(f.database, f.campaign.id, "owner"),
    );
    const roster = f.content
        .listPlayers(imported.id, "owner")
        .map((player) => player.id),
      session = f.content.listSessions(imported.id, "owner")[0];
    assert.deepEqual(
      new Set(session.continuity!.attendanceIds),
      new Set(roster),
    );
    assert.deepEqual(
      new Set(imported.adventure!.partyPresets[0].playerIds),
      new Set(roster),
    );
    assert.equal(session.continuity!.recap, f.session.continuity!.recap);
    const copy = copyCampaign(f.database, f.campaign.id, "owner", "campaign");
    assert.equal(
      f.content.listSessions(copy.id, "owner")[0].continuity!.rewards,
      f.session.continuity!.rewards,
    );
    const template = copyCampaign(
        f.database,
        f.campaign.id,
        "owner",
        "template",
      ),
      templateSession = f.content.listSessions(template.id, "owner")[0];
    assert.equal(templateSession.continuity!.recap, "");
    assert.equal(templateSession.continuity!.rewards, "");
    assert.ok(templateSession.continuity!.scenes.every((scene) => !scene.done));
    assert.deepEqual(templateSession.continuity!.attendanceIds, []);
    assert.equal(
      template.adventure!.threads.every((thread) => thread.status === "open"),
      true,
    );
    assert.equal(template.adventure!.partyPresets[0].playerIds.length, 0);
  } finally {
    f.database.close();
  }
});
test("printable packets escape user content and include preparation, recap, rewards, party and threads", () => {
  const f = fixture();
  try {
    const html = printPacket(
      { ...f.campaign, name: "<script>alert(1)</script>" },
      f.session,
      f.content.listPlayers(f.campaign.id, "owner"),
      [],
    );
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    for (const value of [
      "Planned opening",
      "The party found a clue",
      "50 gold",
      "Green scale",
      "Hero",
      "Guide",
      "Unfinished lead",
    ])
      assert.ok(html.includes(value));
    assert.match(html, /Content-Security-Policy/);
  } finally {
    f.database.close();
  }
});
test("continuity API denies Viewer carry-forward, rejects cross-campaign references and serves authorized packets", async () => {
  const f = fixture();
  try {
    const current = f.campaigns.get(f.campaign.id, "owner")!;
    const request = (path: string, method: string, body?: unknown) =>
      new Request(`http://local/api/campaigns/${f.campaign.id}/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const input = {
      revision: f.session.revision,
      campaignRevision: current.revision,
      title: "Next",
      date: "",
      sceneIds: [],
      threadIds: [],
    };
    const denied = await handleApi(
      request(`sessions/${f.session.id}/prepare-next`, "POST", input),
      f.database,
      { userId: "viewer", isAdmin: false },
    );
    assert.equal(denied.status, 403);
    const packet = await handleApi(
      request(`sessions/${f.session.id}/packet`, "GET"),
      f.database,
      { userId: "viewer", isAdmin: false },
    );
    assert.equal(packet.status, 200);
    assert.match((await packet.json()).html, /DM-only packet/);
    const invalid = await handleApi(
      new Request("http://local/api/campaigns/quick-start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bad", durationMinutes: -1, scenes: [] }),
      }),
      f.database,
      { userId: "owner", isAdmin: true },
    );
    assert.equal(invalid.status, 400);
  } finally {
    f.database.close();
  }
});

test("continuity rich-text images remain authorized and protected across campaign export", async () => {
  const f = fixture();
  try {
    const { listScreenshots, deleteScreenshot } =
      await import("../server/media/screenshots.ts");
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    for (const id of ids)
      f.database
        .prepare(
          "INSERT INTO screenshots(id,filename,original_name,mime_type,size,uploaded_by,created_at) VALUES(?,?,?, 'image/webp',10,'owner',1)",
        )
        .run(id, `${id}.webp`, "map.webp");
    const image = (id: string) => `<img src="/api/screenshots/${id}">`;
    f.campaigns.update(
      f.campaign.id,
      "owner",
      f.campaigns.get(f.campaign.id, "owner")!.revision,
      {
        adventure: {
          ...f.campaign.adventure!,
          threads: [{ ...f.thread, notes: image(ids[0]) }],
        },
      },
    );
    f.content.updateSession(
      f.campaign.id,
      "owner",
      f.session.id,
      f.session.revision,
      {
        ...f.session,
        continuity: {
          ...f.session.continuity!,
          threadIds: [f.thread.id],
          recap: image(ids[1]),
          scenes: [
            { ...f.session.continuity!.scenes[0], notes: image(ids[2]) },
          ],
        },
      },
    );
    assert.deepEqual(
      listScreenshots(f.database, "viewer", false)
        .map((image) => image.id)
        .sort(),
      [...ids].sort(),
    );
    for (const id of ids)
      assert.equal(
        await deleteScreenshot(f.database, id, "owner", false),
        "referenced",
      );
    const exported = JSON.stringify(
      exportCampaign(f.database, f.campaign.id, "owner"),
    );
    for (const id of ids) assert.ok(exported.includes(id));
  } finally {
    f.database.close();
  }
});

test("existing v9 sessions migrate with empty continuity while keeping notes and revisions", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("PRAGMA foreign_keys=ON");
    database.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at INTEGER NOT NULL)",
    );
    for (const migration of migrations.filter((item) => item.version < 3)) {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO schema_migrations VALUES(?,?,1)")
        .run(migration.version, migration.name);
    }
    database.exec(
      "INSERT INTO users VALUES('owner','Owner','owner','hash',1,1,1)",
    );
    database.exec(
      "INSERT INTO campaigns(id,owner_id,name,notes,revision,created_at,updated_at) VALUES('campaign','owner','Old campaign','Campaign prep',7,1,1)",
    );
    database.exec(
      "INSERT INTO sessions(id,campaign_id,title,notes,revision,created_at,updated_at) VALUES('session','campaign','Old session','Original preparation',9,1,1)",
    );
    runMigrations(database);
    runMigrations(database);
    const campaign = createCampaignRepository(database).get(
      "campaign",
      "owner",
    )!;
    const session = createContentRepository(database).listSessions(
      "campaign",
      "owner",
    )[0];
    assert.deepEqual(campaign.adventure, emptyAdventure());
    assert.deepEqual(session.continuity, emptyContinuity());
    assert.equal(campaign.revision, 7);
    assert.equal(session.revision, 9);
    assert.equal(session.notes, "Original preparation");
  } finally {
    database.close();
  }
});
