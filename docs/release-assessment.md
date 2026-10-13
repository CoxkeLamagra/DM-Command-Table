# Fresh-install refactor assessment

Version 11.0.0 introduces the fresh-install baseline. This refactor retains local accounts, administrator account/settings/media management, campaign ownership/sharing/copy/templates/import/export, Players/NPCs, Bestiary, Stories/Sessions and links, prepared encounters, live combat/conditions/resources/undo, local search, rich text/screenshots, responsive navigation and backup/restore/maintenance.

Catalogue search/import uses local JSON rather than an external source. Administrator application updates retain GUI controls, progress, logs, auditing and recovery while installing a fixed root-approved host-staged package. Runtime libraries remain bundled. Package-registry and browser downloads are preparation activities, not runtime requirements.

## v11.0.2 notification fix

The success notification could cover a Save control. When the pointer stayed over it during a retry, its auto-dismiss timer paused and the save remained blocked. Informational notification bodies now allow pointer clicks through to the workspace, while explicit close/action buttons remain interactive. An added close control supports manual dismissal. The prepared-encounter browser regression deliberately places a live toast over Save and uses an ordinary click with a two-second deadline, then checks dismissal and persisted edits; it neither forces clicks nor waits for notification expiry. The patch keeps existing v11 data compatible. Verification passed all 94 unit/API tests, production audit, formatting, lint, TypeScript and production build. All 16 system-Chromium browser tests passed, including the deliberate notification-over-Save regression and manual dismissal.

## v11.0.1 installation patch

The patch adds a browser-test-only local Chromium executable override, `DM_COMMAND_TABLE_TEST_CHROMIUM_PATH`. The Debian guide now defaults to signed Debian Chromium packages rather than requiring a Chrome-for-Testing download. CI and other environments retain Playwright's pinned browser when the variable is unset. The existing browser assertions and application production configuration are unchanged.

Version 11.0.1 retains the v11 database baseline and data; it requires no fresh storage for existing v11 installations. Local verification passed all 94 unit/API tests, lint, formatting, TypeScript, audit and the production build. All 16 browser tests passed using the documented environment override through the standard `pnpm test:browser` command. The Playwright-pinned browser download remains blocked by this cloud environment's network policy.

## Database and architecture

The SQLite schema is initialized directly from one version-1 baseline named `offline-runtime-baseline`. Historical conversion SQL is removed. Earlier database identities are rejected without modifying their records. Use separate new storage; no earlier database or export compatibility is promised. Keep old installations and backups with matching code.

Campaign resource handlers are split into content, Bestiary, combat and search modules. A typed request context and shared revision schemas connect them to a single error boundary. Repository authorization and transactional session/prepared-encounter saves remain intact.

## Validation

Validated locally on Node 24.19.0:

- Frozen-lockfile installation and repeat installation passed; production audit reported no known vulnerabilities. Dependency/lockfile verification remained enabled.
- Formatting, ESLint and TypeScript passed. All 94 unit/API tests passed without skips, including fresh-schema rejection, catalogue validation, broker progress and package integrity.
- Development startup with separate fresh storage passed home/readiness/authentication-boundary checks. The production build passed. All 16 browser regression tests passed using system Chromium 154 through an ignored local launch override (the pinned Playwright browser download is blocked by environment policy). This includes catalogue search/preview/import/replacement with external browser requests denied. Admin progress/reconnection tests use a mocked broker; unit tests exercise the real local broker protocol.
- A self-contained packaged runtime passed fresh administrator registration, admin access, home/readiness/authentication boundaries, campaigns, sessions, combat, portable export/import, storage checks and verified backup/restore/maintenance.
- `Dockerfile.runtime` built with build-step networking disabled using the cached Node 24.21.0 base. Its image passed functional checks under `--network none` with a read-only root filesystem, including local screenshot upload, WebP encoding/read, accounts/campaigns and backup/restore. No external network interface was available to those application checks.
- The standard source Dockerfile build was attempted but blocked by npm DNS resolution inside Docker's build network, including a host-network/proxy-forwarding retry. This is separate from the successfully verified offline runtime-only image path.

Prior-release CI results do not establish acceptance for this refactor. System Chromium differs from the Playwright-pinned browser. No remote release, deployment or publication is claimed.

## Deployment limits

Debian LXC systemd/Nginx installation, successful update and failed-health rollback must be exercised on a disposable host. Docker runtime-image build and isolated functional checks passed; the standard source image build remains blocked as above. Actual host proxy/TLS, image replacement and recovery acceptance still require the target deployment host. Do not treat shell syntax or broker tests as a complete updater deployment test.

## Acceptance and retention

Approve build sources and artifacts before staging executable packages. Manifest hashes detect damage but do not replace root approval. Retain prior releases and backups until recovery is accepted. Verify actual proxy/cookie behavior, disk quotas, screenshot access, retention and offline backup recovery on the deployment host. Current guides describe offline runtime deployment; historical release details remain in [CHANGELOG](../CHANGELOG.md).
