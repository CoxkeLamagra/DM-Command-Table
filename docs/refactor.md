# Local-first refactor

The refactor uses a fresh SQLite schema and removes version-prefixed application/API modules. It preserves campaign ownership and sharing, administration, characters and NPCs, Bestiary imports, story links, sessions and templates, prepared encounters, single-use combatants, combat conditions and undo, search, screenshots, and backups.

## Structure

| Layer | Responsibility |
| --- | --- |
| `domain` | Shared record contracts, combat rules, aggregate limits |
| `features` | Campaign, character, Bestiary, story, session, encounter, combat, identity, administration, search and workspace UI |
| `server` | Authorization, persistence, HTTP validation, media access and campaign portability |
| `db` | Fresh baseline, transaction boundaries and SQLite configuration |
| `scripts` / `deploy` | Shared standalone runtime, consistent backup/restore, maintenance and deployment |

Prepared custom combatants are normalized rows rather than JSON blobs. Combat reads conditions in a batch and saves changed rows incrementally. Mutating commands use expected revisions; bulk character/Bestiary deletion is atomic. Combat history has a count and byte budget and retains image references needed by undo.

Rich text is sanitized at persistence boundaries and when rendered or pasted. Local images retain campaign authorization after an uploader account is removed. Campaign packages include embedded images and remap their IDs on import; failed imports clean up staged uploads, and maintenance handles abandoned staging.

The workspace supports addressable campaign/section/record URLs and browser navigation, dirty-draft reconciliation, separate authorization and server availability messages, and a mobile navigation focus trap. Editor components and shared record/draft helpers are extracted from large screens. Offline Bestiary JSON imports do not contact external services; connecting to the catalogue is opt-in.

## Deployment contract

Debian 13 LXC is primary and Docker secondary. Both consume the same standalone Next.js server, static assets and operational scripts. Production storage uses absolute local paths. No hosted database, object store, cloud identity, or remote search is required. Keep the optional remote catalogue disconnected for fully offline operation.

This is a breaking baseline, not an in-place data migration. Previous API aliases, cookies and database formats are removed. Preserve older installations and backups separately. The package version marks the new major architecture; it does not signify a published release.

## Validation and limitations

Run `pnpm verify`, then `pnpm test:browser` with Playwright Chromium installed. Deployment verification additionally requires a Debian systemd/Nginx host and Docker. Unit/API tests cover permissions, revision conflicts, import rollback, custom combatants, conditions, media ownership, rate limits, backup/restore and transaction recovery. A production build and packaged-runtime smoke check exercise the real server artifact.

Health checks are readiness checks, not substitutes for restoring backups or testing proxy/cookie behavior. The daily backup timer has no automatic retention policy. Review disk usage and retain verified backups outside the running container. The built-in rich-text editor remains a contenteditable implementation; replacing it with a structured editor needs separate cross-browser acceptance testing.

Implementation validation: 58 unit/API tests pass, TypeScript checks and ESLint pass, formatting checks pass, the production build succeeds, and the production dependency audit reports no known vulnerabilities. The packaged runtime was checked for readiness, initial account setup, authenticated campaign creation, Combat loading and campaign-package export. Frozen-lockfile installation also succeeds.

Browser regression tests are configured (10 tests), including URL reload/back-navigation coverage, but were not executed here because Chromium downloads failed. Docker and Debian systemd/Nginx lifecycle tests require their respective hosts and have not been executed in this workspace. The CI workflow includes Docker startup, authentication-boundary, storage and backup checks.
