# v12.1.0 release validation

This release separates campaign monster entries from immutable shared/private definitions. Unchanged catalogue imports reuse full-content SHA-256/equality matches; content edits permanently fork campaign-private definitions. Favorites/tags and stable entry IDs remain campaign-specific. Token imports reuse identical normalized WebP bytes owned by the importing account, including legacy same-size file lookup and concurrent upload coalescing. No new runtime dependencies or external services were added.

Schema migration 3 `shared-bestiary-definitions` preserves IDs, revisions, tags, prepared/Combat links, edited content and image references. Source-bearing revision-1 entries may share; revised or unknown-provenance records remain private. Campaign copies reuse shared definitions and independently clone private variants. Portable campaign imports remain private. Existing duplicate image handles/files are retained, and shared definitions are collected only after the last campaign entry is removed. The definition/binding/asset separation supports future explicit Bestiary/Player sharing; Player sharing is not enabled by this release.

## Executed v12.1 checks

- Dependency audit gate, formatting, ESLint, TypeScript, all **148 unit/integration tests** and production build passed. No dependency/lockfile changes were needed.
- All **19 browser tests** passed using system Chromium. The extended catalogue flow imports the same monster in two campaigns, checks the shared token URL and unchanged Screenshot Library count, edits one monster and verifies the other remains unchanged, then verifies saved stat blocks/tokens with external requests blocked.
- Regressions cover full-content reuse, permanent private variants after edits/reversion/reimport, metadata isolation, revised source data, scope/immutability constraints, rollback on invalid metadata, authorization, stale revisions, shared/private campaign copy behavior, self-contained exports/private imports, deletion/foreign keys, legacy token lookup beyond 64 same-size candidates, quota-free reuse, differing-account image isolation and concurrent upload coalescing.
- The final runtime package passed manifest verification. Mounted read-only in an existing Node 24 container with networking disabled, fresh registration/admin/auth, campaigns/sessions, tokens, prepared loading, Combat save/undo, export/import, screenshot WebP storage/read, storage checks, backup verification, restore and maintenance passed.
- A separate offline test created accounts, campaigns, token images, edited monsters and prepared links with the packaged **v12.0.0 schema-2 runtime**, stopped it and started v12.1.0 against the same data directory. Login, IDs/revisions, edited variants and prepared links survived migration. A new campaign reused an unchanged definition and the legacy token, leaving one stored screenshot. Editing/deleting the original campaign left the other intact; foreign-key checks passed.

## v12.1 upgrade and limits

Supported v11/v12 storage migrates automatically on startup. Retain the pre-update backup with the previous runtime: schema 3 cannot be opened by older releases. The Debian GUI updater takes its stopped-service backup and retains its existing deployment rollback behavior; Docker/manual deployments must follow the documented backup procedure. The installer/deployment tests simulate OS/package/systemd behavior; no production host was deployed or modified during validation. Same-account token deduplication preserves existing media permissions; no cross-account image grant or global-library browsing endpoint was added. Legacy token matching reads candidates one file at a time; existing duplicate images are not bulk-deleted.

Earlier release assessments below retain their original release scope and schema statements.

# v12.0.2 release validation

Prepared loading now asks whether to preserve active Players/NPCs. Preservation retains their IDs, HP, conditions and resources, removes all active monsters and loads only prepared monsters. Full replacement loads every prepared combatant. Both modes reset round/turn, enforce resulting-roster capacity before expansion and retain revision checks and undo. No schema migration or runtime dependency change is required.

The dependency audit, formatting, ESLint, TypeScript, all **143 unit/integration tests** and production build passed. Regressions cover preserved live state, custom monsters, skipped prepared allies, full replacement, retained-roster capacity before allocation, preview counts, stale revision rejection and undo. All **19 browser tests** passed using system Chromium, including explicit Yes/No selection, preservation of an active NPC’s conditions and their reset on full replacement. Earlier release assessments below retain their original scope.

# v12.0.1 release validation

This patch fixes Combat initiative summaries for independent prepared player copies. A unique roster match by name and type supplies race/class; missing or ambiguous matches still show the correct Player/NPC/Monster type. Combat values remain independent and no schema migration is required.

The dependency audit, formatting, ESLint, TypeScript, all **141 unit/integration tests** and production build passed. New coverage loads a prepared player and checks its race/class summary, removed or ambiguous roster fallback, linked renamed players, and NPC/Monster separation. All **3 targeted browser tests** for prepared encounter loading/drafts and mixed-source combatants passed using system Chromium. The preceding major-release assessment is retained below with its original scope.

# v12.0.0 release validation

v12 refactors the current application while retaining local storage and existing user/admin workflows. Prepared encounter state/persistence is separate from rendering; Combat composes dedicated HP, condition, resource and stat-block components. Memoized ordering/indexed summaries, cached SQL, distinct-reference validation and cheaper transaction growth checks reduce repeated work. The obsolete unused HP helper is removed.

The API rejects unsupported method/path aliases before parent operations and enforces prepared encounter parent-session scope. Origin/cookie selection shares web-origin validation and browser cross-site mutations reject even without Origin. Existing campaign authorization, payload bounds, revisions, sanitization, local media permissions and package admission remain in place. These are request-integrity and CSRF-hardening changes; no new campaign-authorization bypass or high-severity remote exploit was established.

## Executed checks

- Frozen dependency installation and all-dependency audit gate passed. The known development-only upstream braces advisory retains its tracked, behavior-verified local mitigation; raw audit can still report it. No runtime dependencies were added or changed.
- Formatting, ESLint, TypeScript, all **140 unit/integration tests** and the production build passed. After generated-output cleanup, frozen installation and a fresh production build passed again.
- All **19 browser tests** passed using system Chromium, including draft/in-flight-save preservation, prepared numbering/drag-and-drop/persistence/collapsed actions, Combat HP thresholds/conditions/resources/undo, Administration, local/remote catalogue imports, tokens, navigation, HTTPS cookie/prefetch CSP and import-rate behavior. Desktop/mobile Combat and prepared views were visually inspected.
- New regressions verify malformed nested paths cannot mutate parent records, wrong-session prepared mutations reject, cross-site/non-web/malformed origins reject, non-growing transactions omit filesystem metadata queries, and 100 repeated Bestiary references require one validation query while content remains sanitized.
- Runtime packaging and manifest verification passed for **12.0.0**. With the new package mounted read-only into an existing Node 24 runtime container and networking disabled, registration/admin/auth, campaigns/sessions, local tokens, prepared loading, Combat save/undo, export/import, media encoding/read, storage checks, backup verification, restore and maintenance passed.
- A separate offline upgrade test created accounts/campaign/session/prepared data with the packaged **v11.8.1** runtime, stopped it, and started v12 against the same data directory. Administrator login, IDs and content were retained without conversion/re-registration; v12 prepared creation/reordering and malformed-path rejection passed.
- Installer/deployment fixtures cover the v12 fresh-install version, expected health/bootstrap behavior, stable-v12 tag selection excluding prereleases/v13, bounded build work and deployment rollback. OS packages, systemd and remote preparation are simulated in those fixtures.

## Upgrade path

The database remains schema version 2 on the supported v11 baseline. v12 introduces no data migration. Existing v11 automatic-update helpers select only v11 tags; they cannot discover v12 until the host administrator performs the one-time [v12 helper upgrade](upgrading-to-v12.md). The application cannot replace root-owned executables itself. Once updated, routine v12 preparation/deployment remains available through Administration → Update Application. Existing data/settings stay in place; fresh installations use the pinned v12 installer. Offline staged packages and host-managed Docker upgrades remain supported.

## Coverage limits

The managed Codex Security scan could not start because its required preflight reference was unavailable. Security work used source review and focused regressions; this is not a completed managed scan, exhaustive audit or vulnerability-free guarantee. No live-host deployment, production-data mutation or new live penetration assessment was performed.

The checks do not establish a fresh bare Debian 13 installation, actual production TLS/proxy acceptance or deployment-hardware latency/capacity. The offline check uses an existing container image plus newly packaged artifacts, not a fresh source-image build against registry availability. System Chromium differs from Playwright's pinned browser. Efficiency evidence is reduced operation/allocation counts, not a hardware benchmark. See [security notes](security-efficiency-review.md) and [operations](operations.md) for trust boundaries, quotas, known advisory handling and recovery requirements.
