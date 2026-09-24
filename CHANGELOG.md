# Changelog

All notable DM Command Table releases are documented here.

## 2.2.0 — 2026-09-24

### Prepared encounters

- Added multiple prepared encounters to every session.
- Added editable encounter names and reusable Bestiary monster selection.
- Allowed multiple instances of the same monster in one prepared encounter.
- Added loading from a prepared encounter into Combat while preserving players and NPCs, replacing existing monsters, applying the prepared name, and resetting combat to round 1.
- Made the Prepared Encounters section collapsible and added an encounter-count indicator.
- Added backward-compatible defaults so existing sessions receive an empty encounter list without a database migration.

### Combatant numbering

- Added optional numeric identifiers for Monster and NPC combatants.
- Displayed numbers beside combatant names in the initiative list and current-turn banner.
- Added editable numbers to Combat details and prepared-monster entries.
- Added automatic per-monster numbering when monsters are added to a prepared encounter.
- Preserved prepared monster numbers when loading encounters into Combat.

## 2.1.0 — 2026-09-24

### Campaign overview

- Renamed the former **Campaign** player-management navigation entry to **Players**.
- Added a dedicated **Campaign** screen with an editable campaign name and general campaign notes.
- Added a chronological timeline generated automatically from the campaign's session entries.
- Made timeline entries clickable so they open, scroll to, focus, and highlight the corresponding entry in **Sessions**.
- Added backward-compatible defaults so existing campaigns receive an empty general-notes field without a database migration.

## 2.0.0 — 2026-09-24

### Local hosting and storage

- Replaced Cloudflare D1 with a server-local SQLite database.
- Added Node.js, Docker Compose, and Debian 13 LXC deployment options.
- Added a hardened systemd service, Nginx reverse-proxy template, persistent data directory, backup instructions, and one-command GitHub updater.
- Retained IndexedDB campaign caching and JSON import/export.

### Accounts and collaboration

- Added local username/password registration and login.
- Added salted `scrypt` password hashes and server-side sessions with HttpOnly cookies.
- Added multiple campaigns with private ownership and username-based Viewer or Editor sharing.
- Added an editable example campaign for every newly registered account.
- Added automatic adoption of the sole legacy user and campaigns by the first registered v2 account.

### Combat tracker

- Added editable encounter names, reusable campaign players, and bestiary monsters with linked stat blocks.
- Added downed styling at 0 HP and automatic skipping of downed combatants during turn advancement.
- Added round reset, complete combat reset, and **Clear monsters** while preserving players and NPCs.

### Campaign players

- Added race, class, level, optional HP, optional AC, and notes.
- Added card and list views, individual deletion, and multi-select bulk deletion.

### Bestiary

- Added editable monster names and full editable stat blocks.
- Added card and list views, individual deletion, and multi-select bulk deletion.
- Added 5etools-compatible monster search and import with source, CR, type, HP, and AC previews.
- Imported monsters are copied into the campaign and remain editable without depending on the remote catalogue.

## 1.0.0 — 2026-09-23

- Initial DM Command Table release.
