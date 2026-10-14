# v11.5.1 release validation

Catalogue tokens are copied into the existing local image library and carried by the monster abilities media field, so existing permission checks, reference tracking, campaign packages, backups and Combat snapshots apply without a database migration. The renderer extracts the marked token image from the ability text and places it in the upper right. Both Bestiary and Combat blocks default to expanded and can be collapsed.

Token fetches use the fixed catalogue origin, omit credentials, reject redirects, time out and limit accepted raster responses to 2 MiB. The existing upload service decodes and re-encodes images before storage. Missing images leave stat blocks available.

Validation passed: production dependency audit, formatting, lint, TypeScript, all 118 unit/integration tests, the production build and all 17 browser tests using system Chromium. Browser checks cover token preview/import, local token URLs, Bestiary/Combat collapse and expansion, and image decoding after saved Combat reload with catalogue requests blocked. The Bestiary layout was inspected in a screenshot. All 4,560 cached live catalogue records passed parser validation. Runtime packaging and integrity verification passed for v11.5.1.

These checks do not establish a complete Debian LXC deployment or host proxy/TLS acceptance. System Chromium differs from Playwright’s pinned browser.
