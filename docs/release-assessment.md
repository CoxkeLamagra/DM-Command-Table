# v10.2.0 release assessment

The 2026-10-13 minor release adds administrator GUI updates and the root-home updater fix to v10.1.0. The feature CI run `38359587201` passed 92 tests (including real Unix-socket integration) and all 15 Chromium browser tests on Node 22/24, plus Docker startup/storage/backup checks. Debian service installation and lifecycle acceptance remain host-specific. Existing features, schema 2 and local-only storage are preserved. GUI updates require the documented one-time root installation; Docker remains host-managed.

# v10.1.0 technical assessment

Reviewed on 2026-10-12 against the v10.0.0 feature set. The released refactor's findings, changes, regression evidence and limits are recorded in [security and efficiency review](security-efficiency-review.md). Application behavior remains at batches 1 and 2, storage remains local-only, and the schema remains version 2. v10.1.0 packages the refactor from PR #25; the earlier v10.0.0 release tag remains immutable.

The release notes and earlier assessment below are historical context.

## v10.0.0 release scope

Prepared on 2026-10-12 from the restored batch 2 application tree (`92e6de9deef848db952ac5858529b28294ec7a44`), now on main after PR #23. Version and installation examples are updated to v10.0.0. No batch 3 or batch 4 functionality is included.

The restored tree passed Node 22/24 verification and browser CI, Docker readiness/storage/backup checks, and a local production build. The release metadata changes also passed CI before tagging. Deployment remains local-only, with Debian 13 LXC primary and Docker secondary. No live deployment or database rollback is performed by publication.

This release expects schema 2. Normal v9 installations migrate locally while retaining their data. A database already migrated by batch 3/4 must be restored from a matching pre-batch-3 backup; do not run this release against the newer schema. Back up current data before any recovery operation.

The assessment below is historical and describes the earlier cleanup work.

## Historical v9.1.0 release assessment

Assessed on 2026-10-09 against GitHub tag `v9.1.0`, commit `e67d9c41dcd9b415ba0d85774c26d2bb336ec764`. This assessment covers source organization, feature boundaries, runtime packaging, deployment templates and documentation. It is not a penetration test or a proof that every browser or LXC host configuration works.

## Findings and changes

| Finding                                                                                             | Action                                                                                                                  | Functional impact                              |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Unreferenced starter SVGs and obsolete favicon alongside active artwork                             | Remove file/globe/window assets; preserve active artwork as `public/favicon.svg` and update layout and proxy references | Same application icon                          |
| Hosted-workspace pnpm store/cache paths and unused Cloudflare override/build approvals              | Use the standard pnpm store; remove miniflare override and approvals for absent esbuild/fsevents/workerd packages       | Same locked installed dependency versions      |
| Generated reports/runtime folders could enter Docker context; default data exclusion was incomplete | Align exclusions for data, builds, reports and tool state                                                               | Prevent accidental inclusion; no data deletion |
| README still described a refactor branch and old API/layout details                                 | Describe released v9.1.0 and current source boundaries                                                                  | Documentation only                             |
| LXC guide named v9.0.0 without an executable checkout step                                          | Pin v9.1.0 explicitly, update health example and distinguish application updates from template updates                  | Repeatable installation guidance               |
| Browser/Docker validation history was contradictory                                                 | Replace historical notes with a verification contract and explicit evidence/limits                                      | Documentation only                             |
| Docker updates, recovery and environment precedence were incomplete                                 | Add Docker and operations guides with consistent backup and separate-directory restore                                  | Documentation only                             |
| Prepared encounters were described as top-level CRUD resources                                      | Document Session-nested routes, transactional save, Combat commands, sharing, media and templates                       | Documentation only                             |
| README promised example data for new accounts; current account creation does not seed campaigns     | Correct initial account expectations                                                                                    | Existing behavior retained                     |

All eight retained UI primitives have source consumers. The vendor stylesheet is imported by `app/globals.css` and its license remains. The backup helper is used by both backup and restore commands and by tests. Domain, feature, server, database, deployment and test directories are active; they are retained. Renaming working feature modules merely for aesthetics would add churn without improving this release.

Runtime packaging now includes only the five operational script files: backup, restore, storage check, maintenance and the shared backup helper. Development/build commands and the disposable browser-test server remain available in the source checkout but are not shipped in production. The packaging regression test verifies this boundary alongside relative dependency links.

## Retained feature set

The source retains local accounts and administration; campaign creation, copying, portable exports and image-inclusive packages; ownership and sharing; reusable Players/NPCs; editable Bestiary and offline JSON imports; opt-in remote catalogue; Story and Session planning and linking; prepared encounters and single-use combatants; active Combat, conditions, HP controls and undo; local search; rich-text notes and screenshots; revision conflict handling; local backups and recovery; responsive navigation and collapsible sidebar.

No schema change, API alias, external service, dependency upgrade or feature removal is introduced by this cleanup. Existing v9 data remains valid. Pre-v9 data still requires separate fresh storage under the major-release contract.

## Validation evidence

The assessed v9.1.0 release passed GitHub CI: verification and 10 browser regression tests on Node 22 and 24, plus Docker startup, authentication boundary, storage and backup checks. Local v9.1.0 verification also passed. These results precede the cleanup; cleanup validation is recorded separately below.

Cleanup verification: frozen-lockfile installation, production dependency audit (no known vulnerabilities), formatting, ESLint, TypeScript, all 60 unit/API tests and production build pass locally. Documentation links, deleted-asset references and default-data/generated-output ignore rules pass. A real packaged-runtime smoke test passes readiness, canonical favicon serving, storage checks, verified backup/restore and maintenance. Local browser execution was blocked by a failed Chromium download. Cleanup GitHub CI run `37926423289` subsequently passed verification and browser regressions on Node 22 and 24, and the Docker startup, authentication, storage and backup checks. The install used the workspace’s existing dependency store through a command-line override; the committed configuration uses pnpm’s standard store.

Debian systemd/Nginx installation and rollback cannot be reproduced in this workspace. The user reported that the corrected deployment worked; this is not an automated lifecycle test. Docker is unavailable in this workspace; its cleanup build and smoke checks passed in GitHub CI. No old runtime, uploaded image, live database, backup or failed deployment directory has been deleted.

## Remaining operational work

- Periodically restore a verified backup into separate storage and test accounts, campaigns and images.
- Set a manual retention policy for backups, quarantine and immutable releases; monitor disk space.
- Verify trusted proxy, cookie and actual browser-facing Host behavior on the LXC endpoint.
- Keep deployment templates and installed updater/units under review when application releases change.
- Add Debian lifecycle automation when a disposable systemd/Nginx test host is available.

The application already has useful boundaries and regression coverage. Future improvements should target concrete behavior or operational gaps rather than another directory-wide rewrite.
