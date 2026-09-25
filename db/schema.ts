import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_users_username").on(table.username),
]);

export const localSessions = sqliteTable("local_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_local_sessions_user_id").on(table.userId),
  index("idx_local_sessions_expires_at").on(table.expiresAt),
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
  memberUsername: text("member_username").notNull(),
  role: text("role", { enum: ["viewer", "editor"] }).notNull(),
  addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.campaignId, table.memberUsername] }),
  index("idx_campaign_members_user_id").on(table.userId),
  index("idx_campaign_members_username").on(table.memberUsername),
]);

export const screenshots = sqliteTable("screenshots", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_screenshots_created_at").on(table.createdAt),
]);
