# v11.5.0 release validation

This release adds a shared local visual monster stat block to import previews, Bestiary details and captured Combat snapshots. The parchment-style display uses saved fields, an ability-score/modifier grid and sanitized rich text; current editing, offline import, campaign copies/packages and combat snapshot isolation remain supported without changing the database baseline.

New imports preserve catalogue metadata and complete spell lists in the existing abilities/spells fields. Parser checks cover actual catalogue field variants such as proficiency-based passive Perception expressions. All 4,560 monster records in the cached live catalogue source files passed the extended parser. Existing imports use their current saved fields; replacement imports can populate newly retained details.

Validation passed: production dependency audit, repository formatting, lint, TypeScript, all 116 unit/integration tests and the production build. All 17 browser tests passed using system Chromium, including remote import preview, Bestiary display and saved Combat stat-block persistence after reload. The rendered Bestiary block was inspected in a browser screenshot. Runtime packaging and manifest/integrity verification passed for v11.5.0.

## Deployment limits

Installer/deployment tests run actual shell workflows in disposable filesystems, simulating identities, OS packages, systemd and remote build infrastructure. Real HTTP/Unix-socket probes validate readiness contracts. The pnpm permission error/repair was also reproduced with a real package install and unprivileged execution in a disposable container.

These checks do not establish a complete Debian LXC deployment or host proxy/TLS/firewall acceptance. System Chromium differs from Playwright's pinned browser. An offline runtime image is distinct from a source-image build needing registries. Retain releases/backups until host recovery is accepted. Repository cleanup does not rewrite Git history or delete saved application data.
