# Local runtime security and efficiency notes

This document describes the current fresh-install refactor. It is a source-backed engineering description, not a completed security scan or penetration-test claim. See [release assessment](release-assessment.md) for executed checks and platform limits.

## Trust and data boundaries

SQLite stores local accounts, campaign authorization, settings, rate limits, search and history. Screenshot bytes, verified backups and runtime packages remain on local storage. There are no hosted database, identity, media or campaign-search requests. Optional remote Bestiary imports fetch JSON directly from `https://dnd5e.lamagra.link` in the browser when the import window opens; application cookies, referrers and campaign/account records are not sent. Browser CSP permits only the application origin and that catalogue origin for connections. Local JSON import and other workflows remain offline. Development/build entry points and deployment templates disable telemetry. Bundled libraries remain necessary to run the application; their locked preparation is distinct from offline runtime operation.

The fresh baseline contains all combat runtime, snapshot and condition columns directly. Schema identities are validated before initialization. Unsupported storage is rejected rather than converted.

## Preserved safeguards

Prepared SQL statements use a bounded per-connection LRU; returned records, bindings and authorization are always evaluated afresh. Authentication budgets are charged transactionally. The supported credential format is salted `scrypt-v1`. Password verification and session grants recheck credential evidence after asynchronous work. Administrator account mutations recheck current rights. Password work has a four-operation process limit; package import/export has a two-operation limit admitted before body reading. Busy requests return 503; persistent rate limits return 429.

Focused content repositories share indexing/audit/revision helpers. Content routes keep session/prepared-encounter saves transactional and expected revisions protect against stale changes. The split API handlers use one shared HTTP error boundary and shared schemas. Owners control sharing/deletion; editors modify content; viewers read. Account administration, server settings, quotas, audit, undo retention and screenshot management remain local.

Rich text is sanitized at persistence/render boundaries. Screenshot reads authorize even conditional requests and stream through one file handle. Campaign-package imports validate the exact referenced asset inventory before image decoding, stage assets transactionally and clean up failures. Backup hashes use bounded chunks rather than whole-file buffers.

## Administrator-triggered executable updates

The administrator-only browser API accepts start/status, not repository names, paths, commands or environments. An independent root-owned broker invokes a fixed updater with a validated root-configured target. Default `latest` resolves the newest stable v11 tag from the fixed project Git repository; prereleases and newer majors are excluded. Pinning is host configuration, not browser input.

Git/dependency installation, checks, build, browser regression and packaging execute as `dmct-build` in a fresh checkout. Application storage/settings/bootstrap variables are excluded from build subprocesses; no candidate application code executes as root. The old service keeps running until preparation and root verification of the copied immutable artifact succeed. Runtime releases are root-owned, while `dmct` only writes application data.

The independently installed verifier checks the baseline, file inventory/hashes and contained links. Manifests detect corruption; automatic mode's executable-source trust comes from the fixed project repository, not a manifest signature. A stopped-service backup and expected-version health check guard the release switch. Failed deployment restores the prior code and data to separate storage; original data, failures, backups and prior releases remain available. Preparation failures never stop the application. Manual root-approved staged packages remain an explicit offline option.

The root installer provisions the automatic broker and prerequisites. Application updates cannot replace root-owned helpers; those remain host maintenance. Build subprocesses can reach the required source/package hosts. Application privileges and Unix-socket access restrictions remain unchanged. Do not replace installed helpers during an update. Routine application updates run entirely from Admin; privileged helper changes remain host maintenance.

## Limits

SQLite supports one application instance per data directory. Revisions do not provide live cursor/presence collaboration. Backups and release retention are host-managed. LXC service/proxy/update/rollback acceptance and Docker image lifecycle acceptance require disposable hosts. Browser validation here uses system Chromium; other browsers and actual deployment TLS remain separate acceptance work.

## Repository boundaries

Release history begins at v11. Obsolete password upgrading and ineffective registration-mode configuration are removed; initial registration closes automatically and administrators control later registration through SQLite settings. Node 24 is the shared build/runtime line. Focused browser API modules share one transport; content repositories share transactional persistence helpers; the server and operational commands share storage path resolution. Clean builds leave data/credentials/dependencies intact. Packaging uses one contained-link/inventory traversal.

## Visual monster stat blocks

Import results offer **View stat block** before selection. Opening a Bestiary monster shows the same local parchment-style block with AC, HP, speed, ability scores/modifiers, traits/actions and spellcasting. Core fields and rich text remain editable through the existing Bestiary controls. Combat displays the independently captured encounter snapshot, so later Bestiary edits do not change a live encounter's block. All views render locally and remain available offline.

New imports retain alignment, armor/HP formula details, saving throws, skills, damage/condition defenses, senses, passive Perception, languages and full spell lists in the existing ability/spell fields. Existing saved records render their available fields immediately; reimport with replacement adds catalogue details that older imports did not retain. Existing combat snapshots keep their captured values. Stat blocks render locally without embedding the catalogue webpage.

The separate monster `token` field uses the existing rich-text sanitizer and local media reference permissions. Combat snapshots include token media in reference tracking. Schema migration 2 moves existing leading marked Bestiary token images without changing their media URLs.
