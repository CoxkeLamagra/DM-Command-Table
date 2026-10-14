# v11.5.2 release validation

The client now emits a workspace save-conflict event only for HTTP 409 responses with `code: "revision_conflict"`. Deleting a monster referenced by a prepared encounter retains the existing transactional safeguard and presents the dependency error with recovery instructions. Unreferenced monsters remain deletable, and failed bulk deletions roll back the entire selection. No database migration is required.

Validation passed: production dependency audit, formatting, lint, TypeScript, all 120 unit/integration tests, the production build and all 17 browser tests using system Chromium. Tests cover successful unlinked deletion, dependency errors and atomic rollback, release of the dependency followed by successful deletion, and preservation of genuine revision-conflict events. Browser checks verify the dependency toast without a save-conflict banner and successful actual deletion through the same UI. Runtime packaging and integrity verification passed for v11.5.2.

These checks do not establish a complete Debian LXC deployment or host proxy/TLS acceptance. System Chromium differs from Playwright’s pinned browser.
