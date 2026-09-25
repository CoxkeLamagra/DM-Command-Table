# Changelog

All notable DM Command Table releases are documented here.

## Unreleased

## 4.0.1 — 2026-09-25

### Fixes

- Replaced source blobs that were corrupted while the original v4.0 release commit was assembled.
- Restored valid UTF-8 source files so Turbopack can parse and build the application.
- Updated the visible application version to v4.0.1.

## 4.0.0 — 2026-09-25

### Version 4 refactor

- Replaced backward-compatible campaign normalization with one strictly validated v4 campaign model and export format.
- Replaced incremental runtime database alterations with one canonical local SQLite schema.
- Removed legacy single-campaign adoption, optional local-account columns, and old campaign-state migration paths.
- Renamed campaign membership storage around usernames instead of the obsolete invite-email terminology.
- Extracted the application header, sidebar, focused-record navigation, player editor, combat HP/condition editors, and monster stat block into focused components.
- Centralized story/session relationship updates and remove story references when a linked session is deleted.
- Added the package version to the bottom-left corner of the application interface.
- Retained local SQLite, local filesystem screenshots, IndexedDB caching, local authentication, and all current user-facing functionality.
- Increased domain and storage regression coverage to 26 tests.

### Compatibility

- Version 4 intentionally does not load v3-or-earlier SQLite databases or campaign export files. Start it with a fresh database.

## 3.0.0 — 2026-09-24

### Internal architecture

- Centralized local API request, JSON error, authentication, administrator, and same-origin handling.
- Moved local account registration, legacy adoption, initial administrator assignment, and starter-campaign creation into a dedicated authentication service.
- Added a shared transaction helper for administration and campaign repository operations.
- Consolidated all screenshot consumers behind one authenticated client-side library provider.
- Extracted pure Combat, Session, Bestiary import, remote catalogue, and screenshot-token operations from their screen components.
- Split Combat selection dialogs and campaign sharing into focused interface components.
- Expanded regression coverage from 9 to 21 tests, including local registration, administrator operations, screenshot persistence, combat sequencing, prepared encounters, Bestiary duplicate decisions, and screenshot tokens.
- Preserved all existing API routes, campaign payloads, permissions, SQLite storage, filesystem uploads, IndexedDB caching, and deployment behavior.

## 2.4.0 — 2026-09-24

### Screenshot notes

- Added local screenshot uploads and reusable inline screenshot references to Campaign, Session, and Story notes.
- Added responsive in-browser rendering that scales screenshots to the available layout.
- Added an administrator screenshot library for uploading and deleting stored images.
- Kept uploads in persistent server-local storage beside the SQLite database by default.
- Added authenticated screenshot delivery, file-type validation, and an 8 MB upload limit.

### Administration

- Added a local user-administration interface for changing usernames and display names, resetting passwords, deleting accounts, and managing administrator permissions.
- Made the first registered local account the default administrator.
- Added automatic administrator assignment for existing installations that do not yet have an administrator.
- Added server-side authorization and final-administrator safeguards to every user-management operation.
- Made password resets revoke the affected account's active sessions.

### Internal architecture

- Split the application into feature-focused Auth, Campaign, Combat, Bestiary, Session, and Story modules.
- Centralized the campaign domain model and backward-compatible payload normalization.
- Added typed local API clients and a dedicated campaign workspace synchronization hook.
- Separated local authentication, session, campaign repository, and validation concerns from the API route adapters.
- Added compatibility tests for legacy campaigns, prepared encounters, Bestiary conversion, duplicate detection, and campaign payload validation.
- Preserved the local-only SQLite, IndexedDB, local-account, Docker, and Debian LXC architecture.

## 2.3.0 — 2026-09-24

### Encounter selection

- Added typeahead search to the Combat Bestiary picker.
- Added multi-select support when adding Bestiary monsters or campaign players to Combat.

### Bestiary importing

- Added typeahead search and multi-select importing to the external monster catalogue dialog.
- Positioned the **Import selected** action directly below **Select all visible**.
- Added duplicate detection by monster name and source.
- Added explicit **Replace existing** and **Discard import** actions while preserving linked monster IDs on replacement.

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
