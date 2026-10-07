import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { hashPassword } from "../server/security/passwords.ts";
import { createV6CampaignRepository } from "../server/v6/campaign-repository.ts";
import { createContentRepository } from "../server/v6/content-repository.ts";
import { createEncounterRepository } from "../server/v6/encounter-repository.ts";
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
const campaign = createV6CampaignRepository(database).create(owner, {
  name: "Regression campaign",
});
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
database.close();
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3100", "-H", "127.0.0.1"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      DM_COMMAND_TABLE_V6_DB_PATH: databasePath,
      DM_COMMAND_TABLE_V6_UPLOAD_PATH: path.join(directory, "uploads"),
      DM_COMMAND_TABLE_TRUST_PROXY: "false",
    },
  },
);
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
