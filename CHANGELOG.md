# Changelog

All notable DM Command Table releases are documented here.

## 11.3.2 — 2026-10-13

- Fix global pnpm installation under the installer's private file mask: use public shared-tool permissions, repair prior private pnpm files and verify execution as the unprivileged build account.
- Apply the same permission/access repair to the GUI updater installer without changing private token/data permissions.
- Add guarded `--resume` for pre-deployment installation failures, retaining existing build checkouts and matching accounts while refusing existing data, executable releases or configuration.
- Cover shared-tool masks and successful guarded resumption in installer regressions; document recovery from the reported dependency-installation error.

## 11.3.1 — 2026-10-13

- Replace the entire current combat roster when loading a prepared encounter, including existing Players/NPCs; loading an empty encounter clears Combat.
- Keep one Player per trimmed, case-insensitive name using the last prepared entry. Preserve duplicate Monsters and NPCs and reject duplicate Player names on direct combat saves.
- Update the load preview and capacity checks to match replacement semantics. Retain revision checks, fresh combat resources and Undo recovery; add regression coverage and update documentation.

## 11.3.0 — 2026-10-13

- Add a standalone fresh Debian 13 LXC installer that provisions signed OS prerequisites, Node 24, pinned pnpm, separate build/runtime accounts, locked dependencies, verified application runtime, Nginx and scheduled backups.
- Enable the automatic GUI updater during installation, check application/proxy health and updater access as the runtime account, and print the initial administrator setup token only after successful verification.
- Protect the token in root-only configuration, refuse existing or partial installations, serialize installers, and preserve files for diagnosis on failure.
- Add installer, readiness and administrator-token regressions and document the complete bare-LXC quick start. Existing v11 data remains compatible; existing installations use Admin updates rather than the fresh installer.

## 11.2.1 — 2026-10-13

- Automatically connect to the remote Bestiary when opening Import monsters; remove the Connect button and show a small connecting/connected/unavailable status.
- Accept valid 5etools null ability sections and choice creature types, preventing a single record from blocking searches throughout its source file.
- Retain local-file imports when the catalogue is unavailable, validate malformed input, and update catalogue usage/privacy documentation. Existing v11 data remains compatible.

## 11.2.0 — 2026-10-13

- Restore automatic Admin updates: fetch the latest stable v11 release, install frozen dependencies, verify/test/build, run Chromium regressions, package, verify, back up and deploy with expected-version health and rollback.
- Use a separate unprivileged build account and fresh checkout without application storage/settings/bootstrap variables; preserve the active application on preparation failures.
- Add a one-time installer to upgrade the root-owned staged-only broker/updater and provision system prerequisites. Routine application updates need no manual build/staging; retain explicit staged mode for offline hosts.
- Show complete update progress and retain bounded logs/reconnection. Add build/deployment regression checks and update installation, architecture, operations and API documentation. Existing v11 data remains compatible.

## 11.1.0 — 2026-10-13

- Restore explicit optional remote catalogue connection, name/source search, monster previews, multi-selection and import from dnd5e.lamagra.link alongside offline local JSON imports.
- Validate catalogue source/file indexes and monster payloads, cache decoded files and cancel outdated requests; omit cookies and referrers when contacting the fixed catalogue host.
- Keep imported monsters as editable local campaign copies, including existing duplicate replacement/discard behavior. Retain the v11 data baseline and local administrator update workflow.
- Update catalogue usage, architecture, privacy, API and deployment documentation.

## 11.0.2 — 2026-10-13

- Prevent informational notifications from intercepting clicks on underlying Save controls. Retain actionable notification buttons and add an explicit dismiss button.
- Exercise saving with a notification positioned over the Save button, without forced clicks or waiting for expiry, and verify manual dismissal.
- Keep the v11 database baseline and existing data compatible.

## 11.0.1 — 2026-10-13

- Support `DM_COMMAND_TABLE_TEST_CHROMIUM_PATH` for running the unchanged browser regression suite with a local Chromium executable; retain Playwright's pinned browser by default.
- Complete the bare Debian 13 LXC installation guide and use signed Debian Chromium packages by default to avoid blocked Chrome-for-Testing downloads.
- This patch keeps the v11 database baseline and application functionality; existing v11 installations retain their data. Earlier major versions still require separate fresh storage.

## 11.0.0 — 2026-10-13

- Refactor campaign resource routing into focused content, Bestiary, combat and search handlers, retaining transactional saves and authorization boundaries.
- Consolidate live combat resources, snapshots and condition timing directly into a fresh SQLite baseline. Reject earlier database formats without migrating them; new installations require separate fresh storage.
- Replace external catalogue connections with validated local-file catalogue search, previews, multi-selection and duplicate replacement. Limit browser connections to the application origin and disable telemetry in development/build entry points.
- Retain administrator update controls, progress, logs, backups and rollback using a root-approved, host-staged standalone runtime. Verify package inventories, checksums and contained dependency links; remove Git fetches and package installation from the updater.
- Add a runtime-only Docker build path using a prepared package and cached Node base image without package-manager or build-step network access.
- Keep bundled libraries and all account, admin, campaign, planning, combat, media and backup workflows. Update current architecture, API, deployment, operations and assessment documentation.

## 10.2.0 — 2026-10-13

- Add optional administrator-triggered Debian LXC updates with executed-step status, bounded local logs and reconnection after application restart. Use a separate root-owned Unix-socket service with a fixed update target; retain backup and rollback behavior without granting the web service root privileges. Document setup and Docker host-managed updates.

- Fix the Debian updater's runtime checks when launched from root's home directory, and document recovery and updater reinstallation.

## 10.1.0 — 2026-10-12

- Recheck verified credentials before session issuance and use conditional password updates so concurrent resets cannot be overwritten or bypassed by a pending login.
- Recheck administrator rights after asynchronous account work and bound all password derivations, including reset/self-service paths.
- Reuse up to 256 prepared SQL statements per connection without caching rows or authorization results; update compound rate limits in one transaction.
- Stream authorized screenshots with private conditional caching and fresh authorization on cache validation. Preserve sole image references after uploader deletion and make failed reference replacements atomic.
- Validate campaign packages before image decoding, reject malformed asset manifests, bound concurrent package work before body reading, and enforce export size incrementally.
- Hash backup files in fixed-size chunks to avoid loading whole databases into memory. Preserve the backup format, schema 2, local-only deployment and all existing features.
- Add security/efficiency regression coverage and update architecture, API, deployment and operations documentation.

## 10.0.0 — 2026-10-12

- Track temporary HP, concentration, death saves, spell slots, legendary actions and configurable ability-use counters independently for each live combatant.
- Capture Bestiary stat blocks when creatures enter Combat, preserve snapshots after source edits/deletion, and include runtime state and embedded images in saves, undo and campaign exports.
- Add start/end-of-own-turn condition timing, persistent/manual effects, saving-throw prompts and manual overrides.
- Migrate existing v9 storage locally, capturing current linked stat blocks and preserving existing duration semantics.

- Recover unsaved campaign, roster, Bestiary, Story, Session, prepared encounter and Combat drafts after refresh, with account-scoped browser storage, restore/download/discard controls and original revision protection.
- Add a Session play view combining notes, linked story details, prepared encounters and searchable Player/NPC references.
- Preview prepared encounter loads, including retained and replaced records, additions, possible duplicates, capacity and revision checks.
- Choose whether turn advancement skips everyone at 0 HP, retains Player turns, or retains all turns.

This release contains batches 1 and 2. Batch 3 was reverted; unfinished batch 4 is excluded. Existing v9 installations migrate locally to schema 2. Installations already using batch 3/4 schema require a matching pre-batch-3 backup; a source rollback does not downgrade their database.

## 9.3.0 — 2026-10-09

- Group general Campaign screen activities in a Campaign actions dropdown, retaining a separate Save button.
- Prevent rejected authentication attempts from draining shared login capacity, limit username rotation per source, validate required credentials and bound concurrent authentication work.
- Check campaign edit access and aggregate combatant counts before expanding prepared encounters; reject oversized encounters with a client error.
- Add regression coverage for authentication admission, encounter limits and Viewer authorization.

## 9.2.0 — 2026-10-09

- Remove unused starter images and retain the active favicon under its canonical name.
- Remove obsolete hosted-workspace package-manager configuration and unused build approvals.
- Exclude generated artifacts and all default local data from source control and Docker build contexts.
- Package only operational scripts, excluding build tools and the disposable browser-test server from deployed runtimes.
- Consolidate architecture documentation and add current API, Docker, operations and release-assessment guides.
- Correct release checkout, runtime environment and validation guidance.

## 9.1.0 — 2026-10-09

- Add complete system-wide Node 24 and pinned pnpm installation steps for Debian LXC.
- Verify runtime availability under the dmct service account and fail early in the updater when prerequisites are missing.
- Use absolute Node and pnpm paths in deployment commands.
- Disable the default Nginx welcome site on dedicated application containers.
- Retry readiness checks during startup and document service diagnostics and access through the LXC IP or hostname.

The fresh-storage requirement introduced in v9.0.0 remains unchanged. Existing v9 installations retain their data.

## 9.0.0 — 2026-10-09

- Introduce a fresh local database baseline and unversioned feature/API modules.
- Normalize prepared custom combatants, batch combat condition reads, and persist combat changes incrementally.
- Move turn/reset/clear/load actions to revision-checked server commands; make bulk deletions transactional.
- Preserve protected image references across account deletion and combat undo; add self-contained campaign packages with images.
- Sanitize persisted rich text and clipboard HTML; add offline Bestiary JSON import and opt-in remote catalogue access.
- Add addressable workspace URLs, browser navigation, mobile focus management, and shared draft reconciliation.
- Use one standalone runtime for Debian LXC and Docker, with candidate-release updates, verified backups and rollback.
- Remove earlier API/storage compatibility. Existing installations require separate fresh deployment.

## 8.1.0 — 2026-10-08

- Show the prepared-encounter count on the Session Encounters tab, matching the Linked stories count.
- Update counts after loading, creating, and deleting encounters while retaining the unsaved-change dot.
- Add browser coverage for encounter-count changes and accessible encounter deletion.

## 8.0.0 — 2026-10-08

### Combat usability

- Apply damage and healing by amount, with immediate Undo HP change and bounds at zero/maximum HP.
- Keep Save and Next turn visible while scrolling; group reset and clear operations in Encounter actions with explanations and confirmations.
- Add Initiative/Details views on smaller screens while retaining the wide split layout.

### Campaign preparation

- Use one Add combatants picker for Campaign roster, Bestiary, and Single-use records in Combat and prepared encounters.
- Retain mixed selections across sources and searches, filter Players/NPCs, show selection totals, and enter monster quantities.
- Retain single-use Players, NPCs, and Monsters and independent prepared-encounter roster copies.
- Show richer collapsed encounter summaries with type counts, quantities, combatant previews, notes, and missing Bestiary warnings.
- Focus Session preparation through Notes, Encounters, and Linked stories tabs, retaining drafts and saving hidden encounter edits.

### Records and navigation

- Show Saved, Saving, and Unsaved changes across editors; protect unsaved navigation and preserve edits made during saves.
- Label the combined preparation action Save session & encounters and keep save controls visible while scrolling.
- Start Player/NPC creation as drafts, saving all entered fields together; cancellation leaves no placeholder records.
- Add next-session shortcuts, exact-record search navigation, match highlighting, Player/NPC result filters, and search loading/error/empty states.
- Improve roster responsiveness and secondary-text readability, and remember optional compact list spacing locally.
- Fix New campaign navigation and clear stale record targets during general navigation.

### Validation and storage

- Pass dependency audit, formatting, lint, TypeScript, production build, 52 unit/integration tests, and nine browser tests on Node 22 and 24.
- Retain server-local SQLite and uploaded-file storage. No new database migration is required for this release.

## 7.4.0 — 2026-10-08

- Add Collapse menu / Expand menu controls for an icon-only desktop sidebar with more space for the active screen.
- Retain accessible navigation labels, hover titles, active-section highlighting, campaign selection and creation, archived campaign restoration, and sign-out.
- Remember the sidebar preference locally in the browser; mobile navigation retains full labels.
- Add browser regression coverage for sidebar layout, icon navigation, preference persistence and mobile behaviour.

## 7.3.0 — 2026-10-08

- Update Next.js and its lint configuration to patched version 16.3.8.

- Add reusable campaign NPCs alongside Players in the renamed Players / NPC’s section.
- Add editable Player/NPC type tags with green Player and blue NPC colours.
- Import campaign Players and NPCs into Combat with duplicate protection and their saved notes, HP and AC.
- Import editable copies of campaign Players and NPCs into prepared encounters without changing the campaign roster.
- Retain single-use Player, NPC and monster creation in Combat and prepared encounters.
- Preserve NPC types in campaign copies and portable exports/imports with automatic local SQLite migration 5; existing records remain Players.

## 7.2.2 — 2026-10-07

- Replace the Combat condition datalist with an explicit dropdown of default conditions while retaining custom text entry and duration controls. Include Exhaustion in the default list.

## 7.2.1 — 2026-10-07

- Add individual collapse controls for prepared combatant editors; existing combatants start collapsed and drafts are retained when closing the editor.

## 7.2.0 — 2026-10-07

- Upgrade Sharp to 0.35.5; block SVG decoding, verify actual image formats, cap concurrent image processing and enforce streamed upload sizes.
- Bound authentication inputs and verify a dummy password hash for unknown usernames.
- Preserve Session/encounter drafts across collapsing and filtering, retain edits made during saves, and warn before discarding unsaved preparation.
- Save Session and encounter edits in one revision-checked SQLite transaction.
- Share encounter domain types and separate prepared combatants from active combat state.
- Batch encounter reads, load screens/editors on demand and pause hidden-tab revision polling.
- Add consistent local backups with checksums, integrity validation and restore into empty destinations.
- Include prepared custom combatants in import limits; bound client imports and request duration.
- Add security, atomic-save, draft and backup regression tests plus isolated browser tests and Node 22/24 CI.

## 7.1.0 — 2026-10-07

- Prepared encounters start collapsed and support individual toggles and Expand all / Collapse all.
- Add NPCs and custom combatants directly without using the Bestiary.
- Edit encounter combatant names, types, initiative, HP, maximum HP, AC, and rich-text stat blocks and notes.
- Customize Bestiary combatants as independent encounter copies and retain their details when loading Combat.
- Preserve custom combatants in Session Save, campaign copies, and portable import/export.
- Store custom combatants locally with automatic SQLite migration 4, validation, and rich-text sanitization.

## 7.0.0 — 2026-10-06

### Architecture and security

- Removed the superseded pre-current application, API, schema, and test paths so the project has one canonical implementation.
- Reduced the production dependency graph and upgraded Next.js to a security-patched release.
- Moved password derivation off the main event loop and transparently upgrades legacy password hashes after a successful login.
- Made administrator-created accounts independent of public registration state and validated linked Combat records against their campaign.
- Enforced bounded multipart uploads before parsing and trusted forwarded client headers only when proxy trust is explicitly enabled.
- Added normalized screenshot-reference authorization, protected in-use images from deletion, and made content/index/audit writes transactional.

### Operations

- Added consistent local SQLite and screenshot backups with `pnpm backup`.
- Added `pnpm check:storage` for SQLite integrity and screenshot-file reconciliation.
- Added a single `pnpm verify` command for audit, lint, type checking, tests, and production build validation.

## 6.2.3 — 2026-10-03

### Encounters

- Added quantity controls when selecting Bestiary monsters for the Combat tracker and prepared Session encounters.
- Automatically creates and sequentially numbers the requested number of monster combatants.
- Updated prepared-encounter monster totals to include all configured quantities.

## 6.2.2 — 2026-10-03

### Fixes

- Fixed focus loss while editing Player Notes and the Bestiary rich-text fields.
- Made the Session-level **Save** action persist all prepared encounters belonging to that Session, including encounter notes and monster selections.

## 6.2.1 — 2026-09-29

### Administration

- Added local administrator-managed server settings for cookie security, session lifetime, screenshot upload and storage limits, Combat undo retention, and audit retention.

## 6.2.0 — 2026-09-29

### Security hardening

- Added strict, bounded runtime validation and rich-text sanitization for portable current campaign imports.
- Made campaign imports fully transactional so failed imports leave no partial records.
- Persisted authentication and write-operation rate limits in local SQLite.
- Made screenshot quota allocation atomic and added a configurable server-wide storage ceiling.
- Bounded Combat undo history and campaign audit history with configurable retention limits.
- Replaced inline-script CSP allowances with per-request nonces and `strict-dynamic`.
- Retired the unused pre-current API endpoints with explicit `410 Gone` responses.
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
- Added portable current campaign export/import with relationship remapping and campaign/template copying.
- Added SQLite FTS search, reusable Session templates, Bestiary tags, Combat history, and structured campaign audit events.

### Deployment and operations

- Added ordered, transactional schema migrations and a readiness endpoint that reports schema health.
- Hardened the standalone Docker image, Compose service, Debian systemd unit, and Nginx configuration while retaining one persistent local data volume.
- Updated the documentation for a single local-only current data model and removed the retired dual-database deployment instructions.

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
