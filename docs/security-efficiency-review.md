# v10 security and efficiency review

Reviewed 2026-10-12. The target is the v10.0.0 application after the batch 3/4 rollback. Changes preserve the existing feature set, schema 2, local SQLite/media/identity storage, Debian 13 LXC as primary deployment and Docker as secondary. This is a source review with regression and runtime validation; no live penetration test was performed. The automated Codex Security skill's supporting resources were unavailable, so this is not presented as a completed automated scan.

## Findings and implemented changes

| Finding | Change | Evidence |
| --- | --- | --- |
| Login verification awaits scrypt while password resets may change the stored credential; session creation also awaits cookie settings | Compare the stored hash after verification/upgrades and again immediately before inserting a session; keep credential evidence outside serialized user objects | Tests invalidate an in-flight login and a pending session grant after a reset |
| A self-service password change could overwrite a concurrent reset after verifying the earlier hash | Conditional update against the verified hash inside the session-revocation transaction | Concurrent reset remains unchanged; successful change revokes old grants/sessions |
| Administrator account work can complete after hashing even if the actor was demoted meanwhile | Recheck administrator rights inside the account mutation boundary | Tests reject pending account creation and reset after demotion |
| Non-login password operations did not share sign-in's work-capacity guard | Bound all password derivations to four concurrent jobs; retain sign-in admission limits | Excess work returns 503; capacity is released and usable afterward |
| Resaving an image resource removed its only reference before checking visibility | Resolve visibility first and replace references transactionally | Images remain readable after uploader deletion; failed replacements retain earlier references |
| Screenshot reads buffered and copied whole files; short-lived cache entries could skip new authorization checks | Stream one file handle with backpressure and private conditional ETags; authorize before 304 | Tests verify exact bytes, cache validation and denial after sharing revocation, plus abort behavior |
| Image-package import processed assets before validating the campaign; export size was checked after accumulating everything | Validate normalized campaign/asset relationships first, bound route admission to two operations before body reading, and check export size incrementally | Malformed/unused-asset packages leave no staged writes; busy work never enters its body operation |
| Repositories repeatedly prepared identical SQL; compound rate limiting used nested transactions | Connection-scoped LRU for at most 256 prepared statements; one atomic compound-budget transaction | Cache isolation/eviction and fresh-row tests; existing authorization/conflict and rate-limit suites |
| Backup checksum hashing read entire database/image files into memory | Read 64 KiB chunks while retaining SHA-256 and file-close guarantees | Existing WAL/image/tamper/restore regression tests retain the backup contract |

The credential and privilege races require overlapping requests during asynchronous work. Image-reference loss is a correctness/availability defect. Package/derivation changes reduce authenticated resource-exhaustion exposure. Prepared-statement and checksum changes improve bounded resource use; they are not claims that every runtime path is faster.

## Validation contract

Local `pnpm verify` passes dependency audit, formatting, lint, type checks, 87 unit/API regressions and a production build. Production HTTP smoke checks cover login, password change, session invalidation, protected screenshot upload/stream/cache, campaign package export/import and backup/runtime behavior. CI additionally runs verification and Chromium browser regressions on Node 22/24 and Docker startup, authentication-boundary, persistent storage and backup checks before merging.

No new database migration is introduced. Normal v9/v10 schema-2 data remains usable. Installations that previously deployed reverted batch 3/4 schemas still require a matching pre-batch-3 restore, as documented for v10.0.0.

## Limits and deployment acceptance

A clean dependency audit means no advisories were reported for the locked production dependencies at verification time; it is not a guarantee of absence of vulnerabilities. Review focused on local authentication/account boundaries, authorization, request limits, media access, campaign portability, SQLite hot paths and backup hashing. This is not an exhaustive formal proof or browser/host penetration test.

Browser and Docker execution depend on CI when unavailable locally. Actual Debian LXC systemd/Nginx lifecycle and independent disaster recovery must be checked on the deployment host. Existing optional remote catalogue access remains opt-in; no campaign data is sent to an external database, media store or identity provider. Reverted batch 3/4 functionality is not reintroduced.
