# v11.8.0 release validation

This release implements fixes and hardening from the October 15 source/live assessment. API admission now shares canonical route parsing; HTTPS browser sessions receive Secure cookies through an internal HTTP proxy hop; prefetch HTML receives CSP. Development dependencies are updated, with a tracked and verified local mitigation for the remaining upstream braces advisory. Passwords use stronger new hashes and conditional legacy upgrades. Local database/account budgets, administrator metrics, build deadlines and updater service caps are included.

Schema version 2, local storage, current permissions, user/admin workflows, optional catalogue imports, Token sections, preparation replacement, Combat snapshots/undo and GUI updates remain supported. No new runtime dependency or database migration is required. Existing HTTP LAN clients remain supported.

## Executed checks

Frozen dependency installation, full dependency audit with local mitigation verification, formatting, ESLint, TypeScript, all 136 unit/integration tests and the production build passed. Regressions cover route aliases and package admission, cookie selection, transactional storage/account rejection and rollback, SQLite direct-write page limits, legacy password upgrades/reset races, runtime packaging and build descendant termination. The original occupied-package-slots proof now returns 503 for both canonical and encoded imports.

All 19 browser tests passed using system Chromium, including HTTPS-edge Secure cookies, working HTTP LAN login, CSP on both prefetch header variants, and canonical/encoded imports sharing the strict rate bucket.

The v11.8.0 runtime package passed manifest verification. Mounted read-only into an existing Node 24 runtime container with networking disabled, it passed fresh registration/admin, readiness/authentication, campaigns/sessions, separate local token media, preparation loading, Combat save/undo, export/import, screenshot upload/WebP encoding/access, storage checking, backup verification, restore and maintenance. Its temporary data volume provided 512 MiB to accommodate the default 128 MiB free-space reserve.

A read-only boundary investigation and independent candidate review were completed. Review identified older-source audit-command compatibility and tag budget coverage; the final change uses a full audit fallback for older targets and includes transactional tag accounting. Encounter child rows retain their existing capacity limits and the global database budget, as documented.

## Deployment and validation limits

Apply the application release through Administration → Update, then sign in again for updated HTTPS cookie attributes. Existing hosts must run the documented [one-time root helper installer](operations.md#applying-v118-updater-resource-limits-to-an-existing-host) to apply OS-level updater caps; fresh installs already include them. The application cannot replace those root-owned helpers itself. No live deployment, production data mutation or live re-assessment was performed for these fixes.

Raw `pnpm audit` continues to report development-only braces GHSA-vfj7-8cjw-p6xm. The gate permits only that exact patched version/advisory and probes the installed nesting guard; it fails unrelated findings. See [security notes](security-efficiency-review.md) and [operations](operations.md) for password benchmark evidence, storage-budget semantics, WAL/backup monitoring and build ceilings.

These checks do not establish a fresh bare Debian LXC installation, acceptance through the actual hosted TLS/proxy chain or deployment-hardware capacity. Browser verification uses system Chromium because the pinned Playwright browser download is unavailable in this environment. The offline check uses an existing container image with the new runtime mounted into it; it does not validate a fresh source-image build against registry availability.
