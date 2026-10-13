# Local runtime security and efficiency notes

This document describes the current fresh-install refactor. It is a source-backed engineering description, not a completed security scan or penetration-test claim. See [release assessment](release-assessment.md) for executed checks and platform limits.

## Trust and data boundaries

SQLite stores local accounts, campaign authorization, settings, rate limits, search and history. Screenshot bytes, verified backups and runtime packages remain on local storage. There are no hosted database, identity, media or campaign-search requests. Optional remote Bestiary imports fetch JSON directly from `https://dnd5e.lamagra.link` in the browser after explicit connection; application cookies, referrers and campaign/account records are not sent. Browser CSP permits only the application origin and that catalogue origin for connections. Local JSON import and other workflows remain offline. Development/build entry points and deployment templates disable telemetry. Bundled libraries remain necessary to run the application; their locked preparation is distinct from offline runtime operation.

The fresh baseline contains all combat runtime, snapshot and condition columns directly. Earlier migration identities are rejected before executing migration SQL. No historical data rewrite is retained. Preserve old storage and use matching old code for its backups; startup errors are never an instruction to delete data.

## Preserved safeguards

Prepared SQL statements use a bounded per-connection LRU; returned records, bindings and authorization are always evaluated afresh. Authentication budgets are charged transactionally. Password verification and session grants recheck credential evidence after asynchronous work. Administrator account mutations recheck current rights. Password work has a four-operation process limit; package import/export has a two-operation limit admitted before body reading. Busy requests return 503; persistent rate limits return 429.

Content routes keep session/prepared-encounter saves transactional and expected revisions protect against stale changes. The split API handlers use one shared HTTP error boundary and shared schemas. Owners control sharing/deletion; editors modify content; viewers read. Account administration, server settings, quotas, audit, undo retention and screenshot management remain local.

Rich text is sanitized at persistence/render boundaries. Screenshot reads authorize even conditional requests and stream through one file handle. Campaign-package imports validate the exact referenced asset inventory before image decoding, stage assets transactionally and clean up failures. Backup hashes use bounded chunks rather than whole-file buffers.

## Offline executable updates

The browser can request only start/status through an administrator-only API. A separate root-owned broker executes a fixed updater with no browser-selected arguments, credentials or environment. The fixed candidate path is `/opt/dm-command-table/incoming/runtime`. Its ancestor directories and contents must be root-owned and not writable by other users. An independently installed verifier checks the package baseline, exact file inventory, SHA-256 checksums and contained relative dependency links before the service is stopped.

The manifest detects transfer corruption; it is not a publisher signature. Root must approve the source/build and stage the artifact. Candidate application code never executes as root for verification. Runtime releases are root-owned; `dmct` writes only application data. Successful updates and failed-candidate recovery retain prior code, backups and logs. The broker's systemd network policy limits IP access to localhost; the application uses the local Unix socket.

Do not replace staging or broker/updater/verifier files while an update runs. Root installation and executable-artifact approval are operational prerequisites. Same-baseline packages are eligible for local updates; different baselines require separate installations.

## Limits

SQLite supports one application instance per data directory. Revisions do not provide live cursor/presence collaboration. Backups and release retention are host-managed. LXC service/proxy/update/rollback acceptance and Docker image lifecycle acceptance require disposable hosts. Browser validation here uses system Chromium; other browsers and actual deployment TLS remain separate acceptance work.
