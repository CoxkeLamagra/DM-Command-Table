import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const campaignStates = sqliteTable("campaign_states", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_users_email").on(table.email),
]);

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_campaigns_owner_id").on(table.ownerId),
]);

export const campaignMembers = sqliteTable("campaign_members", {
  campaignId: text("campaign_id").notNull(),
  userId: text("user_id"),
  inviteEmail: text("invite_email").notNull(),
  role: text("role", { enum: ["viewer", "editor"] }).notNull(),
  addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.campaignId, table.inviteEmail] }),
  index("idx_campaign_members_user_id").on(table.userId),
  index("idx_campaign_members_invite_email").on(table.inviteEmail),
]);
