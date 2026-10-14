# v11.7.0 release validation

This refactor separates prepared encounter and live Combat persistence behind the same repository facade, centralizes resource helpers and local-image rules, batches Bestiary tag reads, sanitizes Bestiary rich text once and shares bounded catalogue downloads. Catalogue token caching has entry and byte budgets, and transient failures remain retryable.

Schema version 2, local storage, existing API shapes, campaign permissions, user/admin features, optional imports, Token sections, preparation replacement, Combat snapshots/undo and GUI updates remain supported. No new dependencies or database migration are required.

Validation passed: production dependency audit, repository formatting, lint, TypeScript, all 128 unit/integration tests, the production build and all 17 browser tests using system Chromium. New regressions cover constant Bestiary tag-query count, direct persistence sanitization, campaign-scoped failed revision lookups, streamed-size enforcement, rejected-body cancellation, URL origin/credential validation and coalesced/retryable token downloads.

Runtime packaging and integrity verification passed for v11.7.0. The packaged application was mounted read-only into an existing Node 24 runtime container with external networking disabled. Fresh registration/admin, readiness/authentication, campaigns/sessions, separate local token media, prepared loading, Combat save/undo, export/import, screenshot upload/WebP encoding/access, storage checking, backup verification, restore and maintenance passed.

## Validation limits

This is an engineering refactor with focused security regressions, not a complete security audit or penetration test. Tests do not establish a full Debian LXC installation, host proxy/TLS acceptance or deployment-hardware benchmarks. System Chromium differs from Playwright’s pinned browser. The offline check uses an existing runtime container image with the new package mounted into it; it does not validate a new source-image build against registry availability.
