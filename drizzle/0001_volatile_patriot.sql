CREATE TABLE `campaign_members` (
	`campaign_id` text NOT NULL,
	`user_id` text,
	`invite_email` text NOT NULL,
	`role` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`campaign_id`, `invite_email`)
);
--> statement-breakpoint
CREATE INDEX `idx_campaign_members_user_id` ON `campaign_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_campaign_members_invite_email` ON `campaign_members` (`invite_email`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_campaigns_owner_id` ON `campaigns` (`owner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);