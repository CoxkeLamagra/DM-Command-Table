# Fresh-install refactor assessment

Version 11.0.0 introduces the fresh-install baseline. This refactor retains local accounts, administrator account/settings/media management, campaign ownership/sharing/copy/templates/import/export, Players/NPCs, Bestiary, Stories/Sessions and links, prepared encounters, live combat/conditions/resources/undo, local search, rich text/screenshots, responsive navigation and backup/restore/maintenance.

Catalogue search/import connects automatically to the remote source when opening the import window as of 11.2.1; local JSON remains available offline. Administrator application updates retain GUI controls, progress, logs, auditing and recovery; version 11.2.0 automates trusted source fetch, dependency installation, verification, build and deployment. Runtime libraries remain bundled. Package-registry and browser downloads are preparation activities, not runtime requirements.

## v11.2.1 automatic catalogue connection

The import window connects automatically and replaces the Connect button with a small connection status. The parser accepts valid null ability sections and creature type choices, which previously blocked entire source files. Local-file imports remain usable when remote requests fail; fixed-origin requests still omit cookies and referrers. All 4,560 records in the live catalogue's 110 nonempty source files passed parsing; the remaining indexed file contains no monsters. Browser fixtures cover automatic connection, previews, persisted import and offline fallback. Verification passed production audit, formatting, lint, TypeScript, all 104 unit/API tests and the production build; all 17 system-Chromium browser tests passed.

## v11.2.0 automatic Admin updates

Restores the complete Admin update workflow after one-time installation of the root-owned automatic updater: fetch the latest stable v11 release, install frozen dependencies, audit/format/lint/type/unit checks, build, browser tests, package/verify, stopped-service backup, release switch and expected-version health. Separate unprivileged builds exclude application storage/settings/bootstrap variables. Browser input cannot choose commands or sources. Manual staged-only deployment remains an explicit offline option.

An existing staged-only root service requires a one-time installer change; it cannot replace itself through the unprivileged web application. Routine application updates then need no terminal, build or staging. The default excludes prereleases/newer majors and retains v11 data compatibility.

Deployment simulations execute the real shell switch/recovery logic with real SQLite backup/restore and filesystem links, while identities/systemd/remote-build infrastructure are simulated. They cover unchanged live service on build failure, successful deployment and wrong-version health rollback preserving original data. These checks do not establish actual Debian systemd/Nginx host acceptance. Validation passed all 103 unit/API tests, production audit, formatting, lint, TypeScript and production build, plus all 17 system-Chromium browser tests. A real unprivileged automatic build against the latest published v11 tag completed Git resolution/clone, frozen dependency installation, verification, production build, 17 browser tests and runtime packaging; only tool paths/cache locations were adapted for this workspace. Actual privileged systemd/Nginx lifecycle acceptance remains a deployment-host check.

## v11.1.0 optional remote catalogue

Restores opt-in remote catalogue search and import with source/CR/type/AC/HP previews, multi-selection, duplicate replacement and local campaign copies. The browser fetches only from the fixed catalogue origin without credentials/referrers; source file names and payloads are validated. Local-file import still works with all external requests denied. Normal runtime and administrator updates remain local. Existing v11 data is compatible.

Live catalogue access and CORS headers were checked, its current source-index formats were exercised, and a real Goblin/MM search returned monster data. Browser regression uses deterministic remote JSON fixtures to verify opt-in access and persisted imports, alongside the existing offline import test. Validation passed all 96 unit/API tests, production audit, formatting, lint, TypeScript and production build. All 17 system-Chromium browser tests passed, including remote connection/import, offline imports with external requests denied and the notification-over-Save regression.

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
