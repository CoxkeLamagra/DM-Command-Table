import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../db/migrations.ts";
import { copyV6Campaign } from "../server/v6/campaign-copy.ts";
import { createV6CampaignRepository } from "../server/v6/campaign-repository.ts";
import { createContentRepository } from "../server/v6/content-repository.ts";
import { createEncounterRepository } from "../server/v6/encounter-repository.ts";

test("v6 campaign templates retain content and encounters while resetting progress and players", () => {
  const database = new DatabaseSync(":memory:"); database.exec("PRAGMA foreign_keys = ON"); runMigrations(database);
  const now = Date.now(); database.prepare("INSERT INTO users (id,display_name,username,password_hash,is_admin,created_at,updated_at) VALUES ('owner','Owner','owner','hash',1,?,?)").run(now,now);
  const campaign = createV6CampaignRepository(database).create("owner", { name: "Original", notes: "World" });
  const content = createContentRepository(database); const encounters = createEncounterRepository(database);
  content.createPlayer(campaign.id,"owner",{name:"Hero",race:"Human",className:"Fighter",level:2,hitPoints:20,armorClass:16,notes:""});
  const session = content.createSession(campaign.id,"owner",{title:"Finale",date:"2026-09-29",notes:"Climax",status:"happened",sortOrder:0});
  encounters.createPrepared(campaign.id,"owner",session.id,{name:"Boss",notes:"Tactics",sortOrder:0,monsters:[]});
  content.createStoryBeat(campaign.id,"owner",{title:"Reveal",chapter:"III",details:"Truth",status:"happened",sortOrder:0,sessionIds:[session.id]});
  const copied = copyV6Campaign(database,campaign.id,"owner","template");
  assert.equal(content.listPlayers(copied.id,"owner").length,0);
  const copiedSession = content.listSessions(copied.id,"owner")[0]!; assert.equal(copiedSession.status,"planned"); assert.equal(encounters.listPrepared(copied.id,"owner",copiedSession.id).length,1);
  const beat = content.listStory(copied.id,"owner")[0]!; assert.equal(beat.status,"planned"); assert.deepEqual(beat.sessionIds,[copiedSession.id]);
  database.close();
});
