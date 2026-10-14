# v11.6.0 release validation

Monster images now have a separate Token section and persisted `token` rich-text field, retained in Combat snapshots and tracked through existing authenticated local media references. Schema migration 2 automatically moves leading marked token images out of existing monster abilities. Existing captured snapshots can still display their original marked image. The migration does not change image URLs or saved combat state.

Validation passed: production dependency audit, repository formatting, lint, TypeScript, all 123 unit/integration tests, the production build and all 17 browser tests using system Chromium. Regression checks cover schema-1 token migration, independent token/action persistence and media references, captured Combat tokens, separate Token/Actions editor contents, action edits followed by save/reopen, and offline token display after Combat reload. Runtime packaging and integrity verification passed for v11.6.0.

These checks do not establish a complete Debian LXC deployment or host proxy/TLS acceptance. System Chromium differs from Playwright’s pinned browser.
