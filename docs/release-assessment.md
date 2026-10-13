# v11.4.0 release validation

This release refactors the current application and cleans repository/documentation around the v11 baseline. Current functionality remains: accounts/admin settings/media, campaign sharing/copy/templates/import/export, Players/NPCs, remote and offline catalogue imports, Story/Session preparation, full combat roster replacement, live resources/conditions/Undo, local search, screenshots, backups, the complete Debian installer/resume and automatic GUI updates.

## Refactor scope

- Focused browser API clients share one transport/error model; current callers use the new entry point.
- Player, Session and Story repositories share transactional indexing, audit, timestamps and revisions through a composed facade.
- The server and packaged storage/backup/maintenance commands share path resolution; package inventory provides the single link validator.
- Obsolete password upgrading and ineffective registration-mode configuration are removed. v11 passwords and schema remain supported.
- Node 24/pinned pnpm define the build contract. Formatting covers current source/configuration/docs and excludes generated/vendor output. Cleanup preserves data, credentials, dependencies and symlink targets.
- History starts at v11. README, user guide, architecture, API, operations, Debian, Docker and security/runtime docs describe current behavior.

## Evidence

Validated locally on Node 24.19.0 using the supported Node 24 line:

- Safe output cleanup followed by frozen-lockfile installation and full verification passed. Production audit found no known vulnerabilities; repository formatting, ESLint and TypeScript passed.
- All **112 unit/API tests** and **17 system-Chromium browser tests** passed, with no skips. This includes authorization/revisions, first-admin token and guarded installer resume, deployment/Undo recovery, remote/offline imports, full prepared replacement, cleanup preservation and shared storage resolution.
- The separately packaged v11.4.0 runtime passed exact manifest/inventory/link verification. Live requests checked readiness/version, unauthenticated access, production first-admin registration, administration, Player/Session/Story persistence, campaign copy/export/import and screenshot upload/WebP/access. Packaged storage, backup/restore with screenshot references and maintenance commands passed using the new shared storage module.
- The same package mounted over the application directory in an existing Node 24 test image passed readiness, authentication, admin registration, campaign creation, storage and backup/restore with Docker networking disabled and a read-only root filesystem. This validates packaged offline runtime behavior; a new image/source build was not claimed because the pinned base image was unavailable locally.
- Local documentation links resolve; no generated builds, dependencies, private data or credentials are tracked. Changelog history begins at v11. Git history and saved application data are preserved.

## Deployment limits

Installer/deployment tests run actual shell workflows in disposable filesystems, simulating identities, OS packages, systemd and remote build infrastructure. Real HTTP/Unix-socket probes validate readiness contracts. The pnpm permission error/repair was also reproduced with a real package install and unprivileged execution in a disposable container.

These checks do not establish a complete Debian LXC deployment or host proxy/TLS/firewall acceptance. System Chromium differs from Playwright's pinned browser. An offline runtime image is distinct from a source-image build needing registries. Retain releases/backups until host recovery is accepted. Repository cleanup does not rewrite Git history or delete saved application data.
