import * as bestiary from "./bestiary-routes.ts";
import * as campaigns from "./campaign-routes.ts";
import * as combat from "./combat-routes.ts";
import * as content from "./content-routes.ts";
import { createRouteTable, route } from "./route-table.ts";
import { searchCampaign } from "./search-routes.ts";

const campaign = "campaigns/:campaignId";
const sessions = `${campaign}/sessions`;
const encounters = `${sessions}/:sessionId/encounters`;

/**
 * Every route served by the catch-all `/api/[...path]` handler. This list is
 * the only place that decides which path/method pairs exist, which campaign
 * role each needs and which handler serves it.
 */
export const apiRoutes = createRouteTable([
  // Account-level session templates
  route("GET", "templates", "user", campaigns.listTemplates),
  route("POST", "templates", "user", campaigns.saveTemplate),
  route("DELETE", "templates/:id", "user", campaigns.deleteTemplate),

  // Campaigns
  route("GET", "campaigns", "user", campaigns.listCampaigns),
  route("POST", "campaigns", "user", campaigns.createCampaign),
  route("POST", "campaigns/import", "user", campaigns.importCampaignRoute),
  route("GET", campaign, "read", campaigns.getCampaign),
  route("PATCH", campaign, "edit", campaigns.updateCampaign),
  route("DELETE", campaign, "owner", campaigns.deleteCampaign),
  route("GET", `${campaign}/export`, "read", campaigns.exportJson),
  route("GET", `${campaign}/package`, "read", campaigns.exportPackage),
  route("POST", `${campaign}/copy`, "read", campaigns.copy),
  route("GET", `${campaign}/search`, "read", searchCampaign),

  // Members (owner only)
  route("GET", `${campaign}/members`, "owner", campaigns.listMembers),
  route("POST", `${campaign}/members`, "owner", campaigns.grantMember),
  route(
    "POST",
    `${campaign}/members/transfer`,
    "owner",
    campaigns.transferOwnership,
  ),
  route(
    "DELETE",
    `${campaign}/members/:userId`,
    "owner",
    campaigns.revokeMember,
  ),

  // Live combat
  route("GET", `${campaign}/combat`, "read", combat.getCombat),
  route("PUT", `${campaign}/combat`, "edit", combat.saveCombat),
  route("POST", `${campaign}/combat/command`, "edit", combat.combatCommand),
  route("POST", `${campaign}/combat/undo`, "edit", combat.undoCombat),
  route(
    "POST",
    `${campaign}/combat/load-prepared`,
    "edit",
    combat.loadPreparedEncounter,
  ),

  // Players and NPCs
  route("GET", `${campaign}/players`, "read", content.listPlayers),
  route("POST", `${campaign}/players`, "edit", content.createPlayer),
  route(
    "POST",
    `${campaign}/players/bulk-delete`,
    "edit",
    content.bulkDelete("players"),
  ),
  route("PATCH", `${campaign}/players/:id`, "edit", content.updatePlayer),
  route("DELETE", `${campaign}/players/:id`, "edit", content.deletePlayer),

  // Bestiary
  route("GET", `${campaign}/monsters`, "read", bestiary.listMonsters),
  route("POST", `${campaign}/monsters`, "edit", bestiary.createMonster),
  route(
    "POST",
    `${campaign}/monsters/bulk-delete`,
    "edit",
    content.bulkDelete("monsters"),
  ),
  route("GET", `${campaign}/monsters/:id`, "read", bestiary.getMonster),
  route("PATCH", `${campaign}/monsters/:id`, "edit", bestiary.updateMonster),
  route("DELETE", `${campaign}/monsters/:id`, "edit", bestiary.deleteMonster),

  // Sessions
  route("GET", sessions, "read", content.listSessions),
  route("POST", sessions, "edit", content.createSession),
  route("PATCH", `${sessions}/:sessionId`, "edit", content.updateSession),
  route("DELETE", `${sessions}/:sessionId`, "edit", content.deleteSession),
  route(
    "POST",
    `${sessions}/:sessionId/save`,
    "edit",
    content.saveSessionWithEncounters,
  ),

  // Prepared encounters of a session
  route("GET", encounters, "read", content.listEncounters),
  route("POST", encounters, "edit", content.createEncounter),
  route("POST", `${encounters}/reorder`, "edit", content.reorderEncounters),
  route("PATCH", `${encounters}/:encounterId`, "edit", content.updateEncounter),
  route(
    "DELETE",
    `${encounters}/:encounterId`,
    "edit",
    content.deleteEncounter,
  ),

  // Story beats
  route("GET", `${campaign}/story`, "read", content.listStory),
  route("POST", `${campaign}/story`, "edit", content.createStoryBeat),
  route("PATCH", `${campaign}/story/:id`, "edit", content.updateStoryBeat),
  route("DELETE", `${campaign}/story/:id`, "edit", content.deleteStoryBeat),
]);
