# Application architecture

The v9 application uses a fresh SQLite schema and removes version-prefixed application/API modules. It preserves campaign ownership and sharing, administration, characters and NPCs, Bestiary imports, story links, sessions and templates, prepared encounters, single-use combatants, combat conditions and undo, search, screenshots, and backups.

## Structure

| Layer                | Responsibility                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `domain`             | Shared record contracts, combat rules, aggregate limits                                                             |
| `features`           | Campaign, character, Bestiary, story, session, encounter, combat, identity, administration, search and workspace UI |
| `server`             | Authorization, persistence, HTTP validation, media access and campaign portability                                  |
| `db`                 | Fresh baseline, transaction boundaries and SQLite configuration                                                     |
| `scripts` / `deploy` | Shared standalone runtime, consistent backup/restore, maintenance and deployment                                    |

Prepared custom combatants are normalized rows rather than JSON blobs. Combat reads conditions in a batch and saves changed rows incrementally. Mutating commands use expected revisions; bulk character/Bestiary deletion is atomic. Combat history has a count and byte budget and retains image references needed by undo.

Rich text is sanitized at persistence boundaries and when rendered or pasted. Local images retain campaign authorization after an uploader account is removed. Campaign packages include embedded images and remap their IDs on import; failed imports clean up staged uploads, and maintenance handles abandoned staging.

The workspace supports addressable campaign/section/record URLs and browser navigation, dirty-draft reconciliation, separate authorization and server availability messages, and a mobile navigation focus trap. Editor components and shared record/draft helpers are extracted from large screens. Offline Bestiary JSON imports do not contact external services; connecting to the catalogue is opt-in.

## Deployment contract

Debian 13 LXC is primary and Docker secondary. Both consume the same standalone Next.js server, static assets and operational scripts. Production storage uses absolute local paths. No hosted database, object store, cloud identity, or remote search is required. Keep the optional remote catalogue disconnected for fully offline operation.

This is a breaking baseline, not an in-place data migration. Previous API aliases, cookies and database formats are removed. Preserve older installations and backups separately. v9.0.0 introduced this baseline; v9.1.0 bundles deployment corrections without changing the schema.

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

Run `pnpm verify`, then `pnpm exec playwright install chromium` and `pnpm test:browser`. CI runs unit/API checks, production builds and browser regression tests on Node 22 and 24, plus Docker startup, authentication-boundary, storage and backup checks. See [release assessment](release-assessment.md) for observed results and [API reference](api.md) for the route contract.

SQLite serves a single application instance with persistent local storage. Revision checks prevent stale writes but do not provide live presence or cursor sharing. Health checks exercise readiness, not complete disaster recovery. Backup retention is manual. Debian systemd/Nginx lifecycle acceptance requires the actual LXC host and is not established by Docker CI. The rich-text editor remains a contenteditable implementation; major editor changes need cross-browser acceptance testing.
