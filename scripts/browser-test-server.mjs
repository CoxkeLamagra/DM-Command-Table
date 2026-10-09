import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { hashPassword } from "../server/security/passwords.ts";
import { loadPreparation } from "../domain/combat.ts";
import { copyCampaign } from "../server/campaigns/campaign-copy.ts";
import { createCampaignRepository } from "../server/campaigns/campaign-repository.ts";
import { createContentRepository } from "../server/content/content-repository.ts";
import { createBestiaryRepository } from "../server/bestiary/bestiary-repository.ts";
import { createEncounterRepository } from "../server/encounters/encounter-repository.ts";
const directory = mkdtempSync(path.join(tmpdir(), "dmct-browser-"));
const databasePath = path.join(directory, "test.sqlite");
const database = new DatabaseSync(databasePath);
runMigrations(database);
const now = Date.now(),
  owner = crypto.randomUUID();
database
  .prepare(
    "INSERT INTO users(id,display_name,username,password_hash,is_admin,created_at,updated_at) VALUES(?,'Browser tester','browser-test',?,1,?,?)",
  )
  .run(owner, await hashPassword("browser-test-pass"), now, now);
const campaign = createCampaignRepository(database).create(owner, {
  name: "Regression campaign",
});
const batchUser = crypto.randomUUID();
database
  .prepare(
    "INSERT INTO users(id,display_name,username,password_hash,is_admin,created_at,updated_at) VALUES(?,'Batch tester','browser-batch1',?,0,?,?)",
  )
  .run(batchUser, await hashPassword("browser-test-pass"), now, now);
database
  .prepare("INSERT INTO campaign_members VALUES(?,?,'editor',?,?)")
  .run(campaign.id, batchUser, now, now);
const session = createContentRepository(database).createSession(
  campaign.id,
  owner,
  {
    title: "Test session",
    date: "",
    notes: "",
    status: "planned",
    sortOrder: 0,
  },
);
const content = createContentRepository(database);
content.createPlayer(campaign.id, owner, {
  name: "Roster hero",
  kind: "player",
  race: "Human",
  className: "Fighter",
  level: 3,
  hitPoints: 24,
  armorClass: 16,
  notes: "<p>Hero notes</p>",
});
content.createPlayer(campaign.id, owner, {
  name: "Roster guide",
  kind: "npc",
  race: "Elf",
  className: "Ranger",
  level: null,
  hitPoints: 18,
  armorClass: 14,
  notes: "<p>Guide notes</p>",
});
content.createStoryBeat(campaign.id, owner, {
  title: "The gate",
  chapter: "I",
  details: "Meet the guard",
  status: "active",
  sortOrder: 0,
  sessionIds: [session.id],
});
createBestiaryRepository(database).create(campaign.id, owner, {
  name: "Test goblin",
  type: "Humanoid",
  challengeRating: "1/4",
  hitPoints: 7,
  armorClass: 15,
  speed: "30 ft.",
  stats: "",
  abilities: "<p>Nimble Escape</p>",
  spells: "",
  notes: "",
  spellSlots: [],
  source: "MM",
  favorite: false,
  tagIds: [],
});
const repository = createEncounterRepository(database);
repository.createPrepared(campaign.id, owner, session.id, {
  name: "Guard patrol",
  notes: "",
  sortOrder: 0,
  monsters: [],
  combatants: [
    {
      id: crypto.randomUUID(),
      name: "Town guard",
      kind: "npc",
      displayNumber: null,
      initiative: 12,
      hitPoints: 20,
      maximumHitPoints: 20,
      armorClass: 16,
      notes: "<p>STR 14; Spear</p>",
      sortOrder: 0,
    },
  ],
});
repository.createPrepared(campaign.id, owner, session.id, {
  name: "Road ambush",
  notes: "",
  sortOrder: 1,
  monsters: [],
  combatants: [],
});
copyCampaign(database, campaign.id, batchUser, "campaign");
database
  .prepare("DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?")
  .run(campaign.id, batchUser);
const runtimeUser = crypto.randomUUID();
database
  .prepare(
    "INSERT INTO users(id,display_name,username,password_hash,is_admin,created_at,updated_at) VALUES(?,'Runtime tester','browser-runtime',?,0,?,?)",
  )
  .run(runtimeUser, await hashPassword("browser-test-pass"), now, now);
database
  .prepare("INSERT INTO campaign_members VALUES(?,?,'editor',?,?)")
  .run(campaign.id, runtimeUser, now, now);
const runtimeCampaign = copyCampaign(
  database,
  campaign.id,
  runtimeUser,
  "campaign",
);
database
  .prepare("DELETE FROM campaign_members WHERE campaign_id=? AND user_id=?")
  .run(campaign.id, runtimeUser);
const runtimeMage = createBestiaryRepository(database).create(
  runtimeCampaign.id,
  runtimeUser,
  {
    name: "Runtime mage",
    type: "Humanoid",
    challengeRating: "2",
    hitPoints: 20,
    armorClass: 12,
    speed: "30 ft.",
    stats: "",
    abilities: "<p>Captured ability</p>",
    spells: "<p>Magic</p>",
    notes: "",
    spellSlots: [2],
    source: "Test",
    favorite: false,
  },
);
const runtimeCombat = repository.getCombat(runtimeCampaign.id, runtimeUser);
repository.saveCombat(
  runtimeCampaign.id,
  runtimeUser,
  runtimeCombat.revision,
  loadPreparation(
    runtimeCombat,
    {
      id: crypto.randomUUID(),
      sessionId: session.id,
      name: "Runtime battle",
      notes: "",
      sortOrder: 0,
      monsters: [
        {
          id: crypto.randomUUID(),
          monsterId: runtimeMage.id,
          displayNumber: 1,
          quantity: 2,
          sortOrder: 0,
        },
      ],
      revision: 1,
      createdAt: "",
      updatedAt: "",
    },
    [runtimeMage],
  ),
);
database.close();
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: "3100",
    DM_COMMAND_TABLE_DB_PATH: databasePath,
    DM_COMMAND_TABLE_UPLOAD_PATH: path.join(directory, "uploads"),
    DM_COMMAND_TABLE_TRUST_PROXY: "false",
  },
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => {
  rmSync(directory, { recursive: true, force: true });
  process.exit(code ?? 0);
});
