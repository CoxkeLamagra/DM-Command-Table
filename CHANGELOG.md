# Changelog

All notable DM Command Table releases are documented here.

## Unreleased

- Added local administrator-managed server settings for cookie security, session lifetime, screenshot upload and storage limits, Combat undo retention, and audit retention.

## 6.2.0 — 2026-09-29

### Security hardening

- Added strict, bounded runtime validation and rich-text sanitization for portable v6 campaign imports.
- Made campaign imports fully transactional so failed imports leave no partial records.
- Persisted authentication and write-operation rate limits in local SQLite.
- Made screenshot quota allocation atomic and added a configurable server-wide storage ceiling.
- Bounded Combat undo history and campaign audit history with configurable retention limits.
- Replaced inline-script CSP allowances with per-request nonces and `strict-dynamic`.
- Retired the unused pre-v6 API endpoints with explicit `410 Gone` responses.
- Added bounded JSON request parsing and generic responses for unexpected server failures.

## 6.1.0 — 2026-09-29

### Combat tracker

- Restored the detailed v5-style Combat layout with individual initiative cards, HP bars, structured statistics, condition controls, and a 30/70 list-to-status-pane split.
- Color-coded Players in green, Monsters in red, and NPCs in blue.
- Added one-time custom Monsters that do not require or create a Bestiary record.
- Displayed complete linked Bestiary information in the status pane, including ability scores, actions, spellcasting, spell slots, notes, source, and tags.
- Added rich-text, encounter-local notes to Players, Monsters, and NPCs without modifying their source Player or Bestiary records.
- Distinguished the active turn with an amber border and the combatant shown in the status pane with a blue **Viewing** indicator.

### Interface and fixes

- Automatically expanded saved prepared encounters when reopening their Session while retaining manual collapse controls.
- Standardized all primary workspace screens on the same 1,500-pixel maximum width as Combat.
- Added a tri-state **Select all visible monsters** checkbox to the Bestiary for filtered bulk deletion.

## 6.0.0 — 2026-09-29

### Clean-slate application architecture

- Replaced the monolithic campaign snapshot with a normalized SQLite model for campaigns, memberships, players, monsters, tags, Sessions, Story beats, prepared encounters, Combat, screenshots, templates, search, and audit history.
- Made the rebuilt interface the application root and retained the complete campaign-management, planning, rich-text, screenshot, import, collaboration, administration, and Combat workflows.
- Added record revisions and explicit conflict responses so stale writes cannot silently overwrite newer changes.
- Added portable v6 campaign export/import with relationship remapping and campaign/template copying.
- Added SQLite FTS search, reusable Session templates, Bestiary tags, Combat history, and structured campaign audit events.

### Deployment and operations

- Added ordered, transactional schema migrations and a readiness endpoint that reports schema health.
- Hardened the standalone Docker image, Compose service, Debian systemd unit, and Nginx configuration while retaining one persistent local data volume.
- Updated the documentation for a single local-only v6 data model and removed the retired dual-database deployment instructions.

## 5.0.2 — 2026-09-28

### Campaign overview

- Changed the desktop Campaign layout to a 70% Campaign-details and 30% Timeline split.
- Limited Timeline Session-note previews to the first 2,000 plain-text characters.

## 5.0.1 — 2026-09-28

### Campaign navigation

- Added typeahead search and immediate filtering to the Bestiary, Story, and Sessions screens.
- Added Planned, Active now, and Happened statuses to Sessions while preserving existing completion data.
- Made Sessions individually collapsible to compact title, date, and status summaries.
- Made Story beats individually collapsible to compact title, chapter, and status summaries.
- Made collapsed entries the default and added Expand all / Collapse all controls to Story and Sessions.
- Increased contrast for the Story status and linked-Session dropdowns.
- Added Session status labels to the linked Sessions overview inside Story beats.
- Replaced the crowded linked-Session checkbox grid with a compact dropdown and a list containing only linked Sessions.
- Made linked Session names open their corresponding Session entry directly.
- Linked the application version in the sidebar to the GitHub repository.

## 5.0.0 — 2026-09-28

### Internal architecture

- Split the Bestiary catalogue importer, Bestiary views, prepared encounters, Combat initiative list, Combat details panel, administrator registration controls, and administrator account dialog into focused components.
- Moved campaign file export and import handling into a dedicated module with regression coverage.
- Centralized the rich-text allowlist and color policy so browser rendering and server-side sanitization share the same rules.
- Added shared private JSON response helpers for authenticated API routes, including explicit no-store cache controls.
- Preserved the existing local SQLite, filesystem screenshot, IndexedDB cache, authentication, API, and user-interface behavior.

### Documentation

- Updated application and deployment documentation for the v5 release.
- Removed obsolete application-upgrade instructions and legacy account-adoption guidance.
- Documented administrator-controlled registration and account creation from the Web UI.

## 4.0.5 — 2026-09-27

### Campaign copying

- Added a header menu for copying the currently selected campaign.
- Added **Copy as new campaign** to create a complete independent duplicate, including players and current progress.
- Added **Copy as template** to preserve campaign notes, Bestiary records, Story and Session content, prepared encounters, and Story–Session links.
- Template copies exclude campaign players and reset Session completion, Story status, and active Combat state.
- Automatically open the new campaign after either copy operation.

## 4.0.4 — 2026-09-27

### Combat tracker

- Made **Next turn** automatically focus the newly active combatant in the right-side details panel.
- Changed the desktop Combat layout to a 30% initiative list and 70% combatant-statistics split.
- Added purple condition indicators to affected combatants in the initiative list.
- Added distinct icons for the standard D&D conditions and a generic icon for custom conditions.
- Added condition icons to the status-condition badges in the combatant details panel.

## 4.0.3 — 2026-09-27

### Security hardening

- Added per-IP and per-account throttling for registration, login, password changes, administrator password resets, and screenshot uploads.
- Protected the first administrator registration with a production bootstrap token and disabled later public registration by default.
- Restricted screenshots to their uploader, administrators, and users with access to a campaign that references the image.
- Added a configurable per-account screenshot storage quota and server-side image decoding and WebP re-encoding.
- Added same-origin enforcement to all campaign-changing endpoints and strengthened forwarded-origin validation.
- Added server-side rich-text sanitization before campaign data is stored.
- Added Content Security Policy, frame, MIME-sniffing, referrer, permissions, and cross-origin opener response headers.
- Updated vulnerable transitive build dependencies; the production dependency audit now reports no known vulnerabilities.
- Expanded security regression coverage for rate limiting, rich-text sanitization, and screenshot authorization.

## 4.0.2 — 2026-09-25

### Combat tracker

- Prevented the same linked campaign player from being added to Combat more than once.
- Disabled campaign players already in Combat and labelled them clearly in the player picker.
- Limited **Select all players** to campaign players not yet present in Combat.
- Kept duplicate additions unrestricted for Monsters, NPCs, and unlinked ad-hoc combatants.

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
