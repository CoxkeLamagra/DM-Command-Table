# Changelog

The supported DM Command Table release history starts at v11.

## 11.8.2 — 2026-10-15

- Match Administration tabs to the application theme: dark tab bar, yellow active tab with black text, and gray inactive labels with readable hover/focus states.

## 11.8.1 — 2026-10-15

- Divide Administration into Update Application, Server Settings, Account Administration and Screenshot Library tabs.
- Preserve unsaved fields and update monitoring when switching sections, with keyboard navigation and a two-column mobile tab layout.
- Keep all current administration controls and document the new navigation.

## 11.8.0 — 2026-10-15

- Canonicalize API routes once before rate and package-work admission; reject ambiguous import/export aliases.
- Set secure HTTPS browser cookies across an internal HTTP proxy hop while retaining HTTP LAN operation. Apply nonce CSP to prefetch responses.
- Update vulnerable development dependencies and locally patch excessive braces nesting with a verified, narrowly scoped audit exception.
- Strengthen new password hashes, upgrade legacy credentials after successful login, and retain bounded password work and reset-race protection.
- Add configurable database growth and account budgets plus administrator storage metrics.
- Bound build stages and updater service resources; include the root updater installer in verified runtime packages. Existing hosts need one root installer run to apply OS-level caps.
- Preserve existing user/admin workflows and offline local runtime; no database migration or new runtime dependency is required.

## 11.7.0 — 2026-10-14

- Split encounter persistence into prepared, combat command and combat storage modules behind the existing facade; share indexing/audit/revision helpers across content, Bestiary and encounters.
- Scope failed revision lookups to the requested campaign so errors do not expose other campaigns’ record metadata.
- Batch Bestiary tags in one campaign query and sanitize monster rich text once at the persistence boundary, including ability-score media references.
- Share authenticated local image URL rules across browser/server sanitizers and token handling.
- Centralize fixed-origin catalogue fetches and bounded stream reading; cancel rejected bodies, reject credential URLs, keep transient token failures retryable, and bound token caching by both entry count and 16 MiB of stored image bytes.
- Preserve offline local runtime, current user/admin functionality, catalogue imports, token sections, preparation replacement, captured combat state/undo and GUI updates. No new dependencies or schema migration are required.

## 11.6.0 — 2026-10-14

- Give monster token images a separate saved `token` field and Bestiary Token section, keeping Actions & traits free of imported token images.
- Automatically move existing marked Bestiary tokens into the new field during schema migration 2. Preserve captured Combat images, local media permissions/references and campaign packages.
- Store newly imported tokens separately and retain token images when editing actions or saving snapshots. Update schema/API/user documentation and add regressions.

## 11.5.2 — 2026-10-14

- Show the actual deletion error for monsters used by prepared encounters, including how to remove the dependency. Reserve the workspace save-conflict banner for genuine revision conflicts.
- Verify unlinked monster deletion, atomic rollback when a selected monster is referenced, and client classification of conflict responses. No database migration is required.

## 11.5.1 — 2026-10-14

- Import available catalogue monster tokens into authenticated local image storage and show them in the upper right of visual stat blocks, including captured Combat snapshots.
- Make Combat stat blocks collapsible; both Bestiary and Combat start expanded. Preserve existing media permissions, reference tracking, campaign packages and offline display.
- Preview token images without uploading them; unavailable images do not prevent monster imports. Reimport older monsters to add their tokens.

## 11.5.0 — 2026-10-14

- Add a shared local visual monster stat block with a parchment layout, core stats and ability-score modifiers in import previews, Bestiary details and Combat snapshots.
- Preserve catalogue saves, skills, damage/condition defenses, senses, languages, alignment, armor/HP details and complete spell lists during import.
- Keep stat blocks editable through existing Bestiary fields, available offline and captured independently in combat snapshots. Existing records use their saved fields; reimport adds newly preserved catalogue details.
- Add conversion/display/persistence regressions and update catalogue, Bestiary and Combat documentation. No database migration is required.

## 11.4.0 — 2026-10-13

- Refactor browser requests into focused API clients with shared transport/errors; split Player, Session and Story persistence into composed repositories with shared transactional helpers.
- Share storage resolution between the server and packaged operational commands, and use one runtime inventory/link validation implementation.
- Remove obsolete password upgrading, ineffective registration-mode configuration and pre-v11 changelog history. Keep the v11 database/password baseline and current user/admin functionality.
- Standardize Node 24 and pinned pnpm; verify formatting across current source/configuration/docs, exclude generated output and provide a safe clean-build command.
- Reorganize documentation around the current v11 application, installer/GUI updates, catalogue, preparation and combat behavior.

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
