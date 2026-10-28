# v12.1.3 security-fix validation — 2026-10-28

This release remediates the follow-up assessment's authenticated validation and Bestiary read memory-exhaustion findings. Next.js and matching lint configuration are locked to 16.4.1 and Zod to 4.6.6. The dependency audit passes with no unmitigated advisories; no advisory suppression was added. Schema remains version 3, portable formats remain supported, and local storage and all user/admin workflows are retained.

## Enforcement and behavior

The shared JSON boundary checks nesting, container width and total values before JSON allocation and again before validation. Input byte limits reserve V8 heap headroom. Server schemas first run a compiled predicate that stops at the first failing check, including nested nonfatal constraints; only valid input enters the transforming/defaulting parse. Public validation diagnostics are bounded. Campaign authorization precedes expensive body parsing, including every combat mutation. The supported 10,000-combatant and 20,000-record structural capacities remain admitted.

Bestiary summaries arrive in pages of 100 without rich text. Detail requests remain campaign-scoped and precede editing, favoriting, import replacement and snapshot creation. Notes search uses the same plain-text conversion as the browser. Full repository reads have SQLite byte/allocation preflights before `.all()` or JSON parsing; every shared binding and tag is charged. Prepared loading and implicit snapshot creation additionally charge quantities and select only needed definitions. Oversized operations return 413, with transactional copy/save rollback. Conservative heap reserves can reject some legitimate full-detail operations on small hosts; paged summaries, individual details and full-server backups remain the paths for larger data.

An independent boundary investigation identified the shared read and parse callers. A separate candidate review identified two newly introduced asynchronous edit races. Combat now locks mutations while fetching details; prepared customization resolves the latest source entry and updates current arrays. Delayed-request browser regressions exercise both cases.

## Executed checks

- Frozen-lockfile installation, dependency audit gate, formatting, ESLint and TypeScript passed. The production build passed on Next.js 16.4.1.
- All **163 unit/integration tests** passed. New tests cover encoded pre-parse limits (including duplicate keys and escaped delimiters), wide/deep/oversized JSON, nested invalid constraints, authorization before body consumption, bounded diagnostics, full supported combat capacity, summary pagination, plain-text note search, campaign-scoped details, favorite/content preservation, shared-definition read amplification, copy rollback, weighted snapshot rejection and combat rollback.
- All **21 browser tests** passed using system Chromium. These include the two delayed-detail regressions, existing campaign and NPC workflows, prepared loading, Combat, local/remote imports, stat blocks/tokens, navigation, cookies/CSP and Administration/update controls.
- Constrained **128 MiB old-space** subprocesses reject the original large collection input and an alternate 500,000-invalid-string nested collection without aborting. An owned malformed combat request returns 413 or 400 as appropriate with a small response; a valid 10,000-combatant schema still parses. The 85-binding shared-payload list case returns a handled size rejection while summaries and one full detail remain usable.
- The v12.1.3 runtime package passed manifest verification. A separately started packaged production server with **384 MiB old space**, synthetic standard-user authentication and isolated storage returns **413** for the original 7.5 MB malformed combat request, an encoded 500,000-key campaign-package object and a 300-binding oversized full Bestiary. All 300 summaries page correctly, the selected 900,000-character full detail survives intact, and subsequent health remains ready. This was local loopback validation, not a network-isolated container or live-host stress test.

No live deployment or host configuration was changed during remediation. Existing v12 GUI updaters can install the patch without a new root helper or schema migration. Host memory/CPU limits remain deployment-specific containment and are not a replacement for these controlled application rejections. Earlier assessments below retain their original scope and versions.

# v12.1.2 dependency-fix validation — 2026-10-21

The newly published GHSA-c9rx-x947-fp3h affects sanitize-html 2.18.0. This release locks 2.18.1, which fixes discarded-iframe fallback recursion without changing the application's restrictive rich-text policy. The dependency audit remains enabled and passes; the existing development-only braces mitigation remains behavior-verified.

Frozen-lockfile installation, formatting, ESLint, TypeScript, all **155 unit/integration tests**, the production build and all **19 browser tests** passed. New regressions exercise 2,000 and 20,000 nested iframe tags without stack exhaustion while preserving ordinary rich text. Discarded fallback markup is safely escaped. The runtime package passed manifest verification and a constrained-heap production smoke test covering registration, nested-iframe sanitization, ordinary export/import and oversized export rejection with continued server health.

No schema migration or updater-helper change is required. The live deployment was not changed during validation. Retry Administration → Update Application after this release is published. Earlier assessments below retain their original scope and dependency versions.

# v12.1.1 security-fix validation — 2026-10-21

This patch addresses the manual assessment's export memory-exhaustion issue and the three current sanitize-html dependency advisories. The sanitizer is locked to 2.18.0; the restrictive rich-text policy is unchanged. Schema remains version 3 and the portable export/import formats remain supported.

The shared raw-JSON/package export loader now authorizes first and computes SQLite row byte budgets before loading content into JavaScript. Counting includes UTF-8, JSON escaping, repeated shared definitions, relationship/tag expansion, preparation, combat snapshots and resources. A structural reserve and available V8 heap headroom supplement the maximum 50 MiB budget. Package image reads are size-checked and capped incrementally before base64 allocation. Large exports receive 413; full-server backups remain the path for larger data. Conservative budgets can reject some exports below the format maximum on memory-constrained hosts.

## Executed v12.1.1 checks

- Frozen-lockfile installation, dependency audit gate, formatting, ESLint, TypeScript, all **154 unit/integration tests** and the production build passed. The three sanitize-html advisories no longer fail the gate; the existing development-only braces mitigation remains behavior-verified.
- All **19 browser tests** passed with system Chromium, including authentication/cookies/CSP, import throttling, local and remote catalogue imports, rich text/stat blocks, preparation, Combat and Administration.
- The original 85-monster / 76.5 MB reproducer was rerun unchanged: both **128 MiB and 384 MiB old-space heap** subprocesses now exit normally with a handled size-budget rejection. The earlier abort at 128 MiB no longer reproduces.
- New regressions cover both raw/package paths, below-format-limit rejection on constrained heaps, legitimate small exports, repeated shared payloads, escaped controls, UTF-8 prepared notes, combat snapshot/runtime data, access-before-content checks, actual image size versus metadata, capped reads and advisory payloads. Existing full round-trip, image remapping and Combat export tests passed.
- Independent read-only investigation and candidate review found no confirmed surviving bypass/regression. The review's concurrency question was checked separately: two simultaneous image package exports, each containing a 10 MiB asset, completed through final JSON response serialization under a constrained heap.
- The v12.1.1 runtime package passed manifest verification. Running the packaged production server with a constrained heap, registration/sanitization and ordinary raw/package export/import worked; both oversized HTTP export routes returned **413** and subsequent health remained ready. This was a local loopback smoke test, not a network-isolated container test.

The live site was not updated or stress-tested during remediation. Deploy the published release through Administration → Update Application or the documented host-managed procedure. No new schema migration is required from v12.1.0. Earlier release assessments below retain their original scope and dates.

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
