# Security and efficiency review — v12

This is a source-backed engineering review with executed regressions recorded in [release assessment](release-assessment.md). The managed Codex Security scan could not start because its required preflight reference was unavailable; no completed managed scan or exhaustive vulnerability-free claim is made. No production credentials, live mutations or live deployment were used for this refactor.

## Local trust boundaries

Accounts, permissions, campaign records, search and history remain in local SQLite. Images, verified backups and runtime packages remain on host storage. Bundled libraries support offline runtime. Optional browser catalogue imports contact only the fixed dnd5e.lamagra.link origin without application cookies/referrers; local JSON imports remain available. Explicit GUI updates use the fixed project Git repository and package sources. Development/build telemetry remains disabled.

Authorization is evaluated against current campaign membership on each operation. Owners control sharing/deletion; editors write content; viewers read. Browser and persistence sanitizers retain the supported rich text and authenticated local image references. Screenshot reads authorize cache validation and stream via one file handle. Package imports validate their exact image inventory before decoding and stage changes transactionally. Backup hashes use bounded chunks.

## Request boundary improvements

The router now checks a central path/method contract before dispatch. Previously malformed nested paths could fall through to a parent's create/delete/update branch. They now return 404 without mutation. Prepared encounter PATCH/DELETE additionally checks that the record belongs to the session named in the URL. This improves request/data integrity; the review did not demonstrate a bypass of existing campaign authorization.

Origin checks and secure-cookie selection share HTTP/HTTPS origin and Host parsing. Credential-bearing, path-bearing and non-web origins reject. Mutating adapters reject browser `Sec-Fetch-Site: cross-site` even without Origin; ordinary local API clients that omit browser metadata remain supported. This is additional CSRF hardening, not a claim that a prior cross-site exploit was established. HTTPS secure-cookie auto behavior through an internal HTTP hop and plain HTTP LAN behavior remain supported. Explicit cookie settings retain precedence.

Canonical segment parsing still controls package concurrency and import rate limits, including encoded aliases. Malformed encodings/decoded separators and extra import/package components reject before dispatch. Ordinary and prefetch HTML receive nonce CSP. Authentication budgets persist in SQLite; password work has a four-operation process ceiling. Package import/export admission is bounded to two operations before body reading.

## Persistence and rendering efficiency

Prepared encounter state, save/reconcile logic, ordering and preview behavior live in a dedicated controller hook. The view renders cards and actions. Combat HP, conditions, live resources and stat-block rendering are separate components, preserving the current right-pane order and left initiative overview. The unused legacy HP helper was removed; domain combat runtime remains authoritative for adjustments and temporary HP.

A memoized Bestiary map replaces repeated full-array searches in prepared rows and summaries. Unchanged summaries can skip rendering; summaries build at most five preview names. Sorted encounter order is memoized by data. These changes reduce repeated work without caching permissions or authoritative records.

Non-growing transactions now read SQLite page usage without main-file/WAL/free-space statistics. Growing transactions still perform the existing budget/reserve check; full Administration metrics remain available on demand. Reorder/quota SQL reuses the per-connection statement cache. Prepared writes validate each distinct Bestiary reference once; a regression with 100 repeated references confirms one validation query. Notes/child notes are sanitized once at persistence and those normalized values drive media-reference tracking. These are source-backed operation-count improvements, not deployment-hardware latency benchmarks.

## Credentials, quotas and dependencies

New hashes use salted scrypt-v2 (N=32768, r=8, p=3); legacy scrypt-v1 upgrades after successful login with compare-and-swap protection against concurrent resets. Verification performs both supported work profiles. Password changes revoke sessions and administrator account mutations recheck current authority. The prior runner benchmark was about 0.135 seconds for four legacy derivations versus 0.962 seconds for four new derivations; this is historical runner evidence, not a new v12 hardware capacity measurement. New derivation memory is roughly 32 MiB per active operation plus runtime overhead.

Database page ceilings, transactional growth reserves and account budgets remain documented in [operations](operations.md). They are not filesystem quotas: WAL, backups, media, retained releases and concurrent host processes still require monitoring and host limits. Existing over-budget data remains readable/removable.

`pnpm audit:dependencies` audits all dependencies and verifies the tracked braces3.0.3 parser nesting mitigation for development-only GHSA-vfj7-8cjw-p6xm. Only that exact version/advisory is permitted; unrelated findings or registry failures fail verification. Raw audit may still report the upstream advisory. Production dependencies are unchanged by this refactor; there are no new libraries. Exact executed results are in the release assessment.

## Executable updates and recovery

The administrator API accepts start/status, never arbitrary repositories, commands, paths or environments. Root helpers are independently installed; candidate source executes as dmct-build with production storage/bootstrap settings removed. Build stages and overall preparation have deadlines; systemd caps the updater at 2 GiB, 200% CPU and 512 tasks. The running application is separate. Root verifies immutable packages, takes a stopped-storage backup, switches releases and checks the exact expected version. Failed preparation leaves the old application running; failed deployment restores matching code/data.

The v12 helper selects stable v12 tags and excludes prereleases/v13 by default. v11 helpers deliberately exclude v12, so existing LXC hosts need the documented one-time [helper upgrade](upgrading-to-v12.md). This preserves executable authority instead of allowing an unprivileged application to replace root code. Fixed-repository trust remains the executable-source trust model; manifests detect corruption and are not release signatures. Docker lifecycle remains host-managed.
