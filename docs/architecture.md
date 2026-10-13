# Application architecture

The application uses a single fresh SQLite baseline, `offline-runtime-baseline` (schema version 1). It preserves campaign ownership and sharing, administration, Players/NPCs, local Bestiary imports, Story/Session planning and templates, prepared encounters, single-use combatants, live combat resources, conditions and undo, search, screenshots and backups. The runtime needs no external services. Browser-side remote Bestiary search is optional and connects only after explicit user action.

## Structure

| Layer                | Responsibility                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `domain`             | Shared record contracts, combat rules, aggregate limits                                                             |
| `features`           | Campaign, character, Bestiary, story, session, encounter, combat, identity, administration, search and workspace UI |
| `server`             | Authorization, persistence, HTTP validation, media access and campaign portability                                  |
| `db`                 | Fresh baseline, transaction boundaries, bounded prepared-statement cache and SQLite configuration                   |
| `scripts` / `deploy` | Shared standalone runtime, consistent backup/restore, maintenance and deployment                                    |

Prepared custom combatants are normalized rows rather than JSON blobs. Combat reads conditions in a batch and saves changed rows incrementally. Mutating commands use expected revisions; bulk character/Bestiary deletion is atomic. Combat history has a count and byte budget and retains image references needed by undo. Combatant runtime resources and stat-block snapshots are separate bounded JSON values on each combatant row; conditions remain normalized rows with start/end/manual timing and save-prompt flags. Bestiary/prepared definitions are never updated by live resource spending. Snapshot image references are retained for live Combat and undo, and portable campaign packages remap embedded images. All runtime, snapshot and condition fields are defined directly in the baseline CREATE TABLE statements. No legacy data conversion is retained.

Rich text is sanitized at persistence boundaries and when rendered or pasted. Local images retain campaign authorization after an uploader account is removed. Campaign packages include embedded images and remap their IDs on import; failed imports clean up staged uploads, and maintenance handles abandoned staging.

The workspace supports addressable campaign/section/record URLs and browser navigation, dirty-draft reconciliation, separate authorization and server availability messages, and a mobile navigation focus trap. Editor components and shared record/draft helpers are extracted from large screens. Bestiary catalogue parsing, deduplication and search are pure functions in `features/bestiary/local-catalogue.ts`; the UI loads local files and retains multi-selection, previews and duplicate replacement. Browser CSP permits the application origin and the fixed optional catalogue origin `https://dnd5e.lamagra.link`. `remote-catalogue.ts` validates source/file indexes, bounds accepted downloads, caches decoded files and aborts outdated searches; requests omit credentials and referrers. Local-file mode makes no external requests.

## Local security and resource limits

`db/statements.ts` keeps an LRU cache of at most 256 prepared SQL statements per connection using a WeakMap. It caches executable SQL only: bindings, returned rows and permission decisions are evaluated anew. Compound authentication budgets use one transaction, read all limits before any increment, and perform cleanup per connection.

Credential evidence stays in a server-only WeakMap rather than in API user objects. Login verification and hash upgrades recheck the stored password; session issuance rechecks the evidence after cookie/settings awaits. Password changes update only the hash that was verified and revoke existing sessions. Administrator account creation/reset checks current administrator rights after asynchronous hashing. All password derivations share a four-operation capacity limit, in addition to the existing sign-in admission limits.

Screenshot HTTP reads stream through a single authorized file handle. Private ETags avoid retransmitting unchanged bytes, but conditional requests still check access before returning 304. Image-reference replacement validates visibility before deleting the old reference, inside a transaction. This retains access when an uploader has been deleted and the resource's existing reference is the only remaining authorization path.

Package import validates the portable campaign and exact asset manifest before decoding images. Package routes admit at most two operations before reading request bodies, return 503 instead of queuing, and release capacity on failure. Export size is counted incrementally. Backup checksums read 64 KiB chunks; their format and restore procedure remain unchanged.

## Deployment contract

Debian 13 LXC is primary and Docker secondary. Both consume the same standalone Next.js server, static assets and operational scripts. Production storage uses absolute local paths. No hosted database, object store, cloud identity, or remote search is required. A host-staged runtime contains its dependencies and assets; no package manager runs during deployment or updates.

This is a fresh-install baseline. Existing database migration metadata must exactly match this baseline before any migration SQL runs. Earlier versions require separate storage and matching application code; no compatibility aliases or historical upgrade path are promised.

The API router owns campaign and template entry points and one HTTP error boundary. It delegates content, Bestiary, combat and search to focused modules in `server/api/`, using a typed request context and shared revision schemas. Repositories retain authorization, transaction boundaries and expected-revision checks; session/prepared-encounter saves remain atomic.

## Source layout

| Directory           | Contents                                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| `app/`              | Next.js pages, layout, styles and thin API route adapters                              |
| `components/ui/`    | Used interface primitives                                                              |
| `domain/`           | Record types, limits and combat/encounter rules                                        |
| `features/`         | Screen components, shared draft helpers, API client and workspace navigation           |
| `server/`           | Local authentication, authorization, validation, repositories and media handling       |
| `db/`               | SQLite initialization, schema baseline and transaction helpers                         |
| `lib/`              | Styling utilities and the package-derived application version                          |
| `scripts/`          | Build packaging, development test server, storage, backup, restore and maintenance     |
| `deploy/debian-13/` | systemd, Nginx, environment and updater templates                                      |
| `tests/`            | Domain, repository, HTTP, storage and runtime tests; browser tests in `tests/browser/` |
| `public/`           | Application favicon                                                                    |
| `vendor/`           | Required shadcn stylesheet and retained upstream license                               |

`pnpm build` produces `.next/standalone` and copies static assets. `pnpm package:runtime` creates a separate, self-contained runtime under `dist/runtime` by default; it refuses existing destinations and dependency links escaping the package. Both deployment targets use this artifact. Packaged `scripts/` contains only backup, restore, storage-check and maintenance commands and their shared helper; build tools and the browser test server stay in the source checkout. Dependencies stay locked; pnpm uses its standard store rather than a hosted-workspace-specific path.

## Verification and operational limits

Optional Debian GUI updates use a root-owned broker outside application releases. Administrator-only API routes send bounded start/status messages over a local Unix socket. The fixed target is `/opt/dm-command-table/incoming/runtime`; browser input never supplies paths or commands. Root approves and stages the package, with no writable application access to its ancestors or contents. The installed verifier checks a manifest containing the baseline, application version, SHA-256 file hashes and relative dependency links. Checksums establish transfer integrity, not publisher authenticity; host approval supplies trust. The updater uses only local files, takes a consistent stopped-service backup, switches releases and checks readiness, and restores the previous release/data on failure. The broker retains progress and bounded logs across application restarts. Its systemd unit limits IP traffic to localhost. Docker replacement remains host-managed.

`package:runtime` writes the runtime manifest. The independent root-owned verifier is installed from an approved source checkout, not executed from the staged candidate as root. `next-command.mjs` disables telemetry for development and builds; `start-runtime.mjs` disables it for standalone startup. Local application dependencies are bundled rather than removed.

Run `pnpm verify`, then `pnpm exec playwright install chromium` and `pnpm test:browser`. On Debian, the documented alternative installs `chromium` through APT and runs `DM_COMMAND_TABLE_TEST_CHROMIUM_PATH=/usr/bin/chromium pnpm test:browser`; without the override, the pinned Playwright browser remains the default. CI runs unit/API checks, production builds and browser regression tests on Node 22 and 24, plus Docker startup, authentication-boundary, storage and backup checks. See [release assessment](release-assessment.md) for observed results and [API reference](api.md) for the route contract.

SQLite serves a single application instance with persistent local storage. Revision checks prevent stale writes but do not provide live presence or cursor sharing. Health checks exercise readiness, not complete disaster recovery. Backup retention is manual. Debian systemd/Nginx lifecycle acceptance requires the actual LXC host and is not established by Docker CI. The rich-text editor remains a contenteditable implementation; major editor changes need cross-browser acceptance testing.

See [the technical review](security-efficiency-review.md) for source-backed findings, regression evidence and review limits.
