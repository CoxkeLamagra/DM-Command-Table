import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const campaignStates = sqliteTable("campaign_states", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
