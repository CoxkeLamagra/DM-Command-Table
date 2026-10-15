# Configuration and operations

Keep one application instance and persistent local storage. Debian LXC is primary; Docker is secondary. [LXC](debian-13-lxc.md) and [Docker](docker.md) describe deployment-specific commands. Nothing here requires an external database, media store or identity provider.

## Environment reference

| Variable                                      | Default                              | Purpose                                                                                                                  |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `DM_COMMAND_TABLE_DB_PATH`                    | `data/dm-command-table.sqlite`       | SQLite file; use an absolute production path                                                                             |
| `DM_COMMAND_TABLE_UPLOAD_PATH`                | `uploads` beside the database        | Local screenshot directory                                                                                               |
| `DM_COMMAND_TABLE_BACKUP_PATH`                | `backups` beside the database        | Verified backup destination                                                                                              |
| `DM_COMMAND_TABLE_BOOTSTRAP_TOKEN`            | empty                                | Required for initial administrator registration in production                                                            |
| `DM_COMMAND_TABLE_TRUST_PROXY`                | `false`                              | Accept forwarded client address and HTTPS scheme from a trusted proxy                                                    |
| `DM_COMMAND_TABLE_SECURE_COOKIES`             | `auto`                               | `true` always secure, `false` never secure, `auto` recognizes trusted forwarded HTTPS or a matching HTTPS browser Origin |
| `DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB`        | `100`                                | Per-account media quota in MiB                                                                                           |
| `DM_COMMAND_TABLE_SCREENSHOT_GLOBAL_QUOTA_MB` | `1024`                               | Server-wide media quota in MiB                                                                                           |
| `DM_COMMAND_TABLE_COMBAT_HISTORY_LIMIT`       | `100`                                | Maximum retained undo snapshots per encounter                                                                            |
| `DM_COMMAND_TABLE_AUDIT_EVENT_LIMIT`          | `10000`                              | Maximum retained audit events                                                                                            |
| `PORT`                                        | `3000` in deployment templates       | HTTP listener port                                                                                                       |
| `HOSTNAME`                                    | loopback in LXC; `0.0.0.0` in Docker | Standalone server listener address                                                                                       |
| `DM_COMMAND_TABLE_BIND_ADDRESS`               | `127.0.0.1`                          | Bind override for `pnpm start` only                                                                                      |
| `DMCT_BIND_ADDRESS`                           | `127.0.0.1`                          | Compose host port bind; not an application setting                                                                       |
| `NEXT_TELEMETRY_DISABLED`                     | `1` in deployment templates          | Disable Next.js telemetry                                                                                                |

The first account becomes administrator and closes public registration. Administration stores registration and server settings in SQLite. Saved cookie, quota, undo and audit settings take precedence over their environment defaults. Session lifetime defaults to 30 days and upload size to 8 MiB; both are changed in Administration, not via an environment variable. Screenshot upload size can be 1–50 MiB; set proxy body limits accordingly. Campaign package imports have their own size limit.

The development server uses Next.js environment loading. Standalone startup and Node maintenance scripts should receive exported variables. On LXC, systemd and the updater read `/etc/dm-command-table.env`. Compose interpolates `.env` into the service environment. Keep these files private; do not assume a source `.env.local` configures production commands.

## Database and account budgets

The host can set these positive integer environment values in `/etc/dm-command-table.env` (or the container environment), then restart the application:

| Variable                                 | Default  | Meaning                                                                                                |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `DM_COMMAND_TABLE_DATABASE_LIMIT_MB`     | `1024`   | Main SQLite page budget in MiB                                                                         |
| `DM_COMMAND_TABLE_MIN_FREE_SPACE_MB`     | `128`    | Minimum filesystem free space for transactional database growth                                        |
| `DM_COMMAND_TABLE_CAMPAIGNS_PER_ACCOUNT` | `100`    | Campaigns owned by one account                                                                         |
| `DM_COMMAND_TABLE_RECORDS_PER_ACCOUNT`   | `100000` | Owned players, monsters, sessions, story beats, prepared encounters, tags and saved templates combined |

Administration shows used database pages, main/WAL file bytes, filesystem free space and configured limits. Growth beyond a budget returns HTTP 413 and rolls back. Existing databases above the page budget are retained, with further page allocation blocked; deletion and shrinking operations remain possible. Account limits are charged to the campaign owner, including imports, copies and ownership transfers. Encounter child rows remain subject to existing encounter capacity limits and the global database budget, rather than the account record count.

These are application safeguards, not filesystem quotas. WAL files, backups, retained releases, media and failed builds need separate disk monitoring and host storage limits. The free-space reserve is checked when wrapped transactions grow used pages; it cannot guarantee free space against concurrent processes or every direct SQLite write. SQLite's page ceiling also protects direct database allocations. Use a data volume larger than the default 128 MiB reserve.

## LXC manual operations

Run as root to load the private environment, then execute as the service user:

```sh
set -a
. /etc/dm-command-table.env
set +a
cd /opt/dm-command-table/current
runuser -u dmct --preserve-environment -- /usr/bin/node scripts/check-local-storage.mjs
runuser -u dmct --preserve-environment -- /usr/bin/node scripts/backup-local.mjs
# Verify the actual path printed by backup:
runuser -u dmct -- /usr/bin/node scripts/restore-local.mjs /var/lib/dm-command-table/backups/BACKUP
```

The backup script captures a consistent SQLite snapshot and recorded images, then verifies checksums and database constraints. Never copy only the live SQLite main file while WAL is active. Verification without a destination does not restore. Supplying a new empty destination restores without changing the running service's paths. Stop the service before switching paths and start the matching release afterward.

```sh
systemctl list-timers dm-command-table-backup.timer
journalctl -u dm-command-table-backup.service -n 80 --no-pager
```

The timer performs backup followed by maintenance. Monitor failures, disk space and backup copies outside the container. Timer and Docker health success alone do not establish disaster recovery; periodically restore into separate storage and check login, campaign content and images.

## Maintenance and retention

`node scripts/maintenance.mjs` uses the exported database/uploads paths. It deletes expired login sessions and rate-limit rows, and quarantines unreferenced media from removed accounts and abandoned imports older than 24 hours. It also quarantines unmatched WebP files older than 24 hours. Referenced campaign and undo images remain available. Quarantine is `media-quarantine` beside the uploads directory; files are moved, not permanently purged.

Backups, media quarantine, failed releases and restored directories have no automatic retention policy. Inspect them before removing anything. Keep a verified backup and the corresponding release outside the host. Do not delete live data, a current release, or backups needed to recover retained releases.

The LXC updater removes successful temporary build worktrees but retains releases and failed builds. Before pruning old folders:

```sh
readlink -f /opt/dm-command-table/current
runuser -u dmct -- git -C /opt/dm-command-table/source worktree list
```

Remove an obsolete build using `git worktree remove` as `dmct` after inspecting it. Keep the current release and a verified rollback release. Remove other release directories only after confirming they are neither current nor required for recovery. No repository cleanup command should touch `/var/lib/dm-command-table` or Docker's named volume.

## Troubleshooting

For optional [GUI updates](debian-13-lxc.md#updates-from-administration), inspect `systemctl status dm-command-table-updater.service` and `journalctl -u dm-command-table-updater.service`. The application must be able to connect to `/run/dm-command-table-updater/control.sock` as group `dmct`. The latest job is kept separately in root-only `/var/lib/dm-command-table-updater/latest.json`, surviving application restarts. Do not restart the broker mid-update; an interrupted job requires manual health/release inspection. The GUI's retained output covers only updates it starts; CLI runs use the same update lock but do not create GUI jobs.

| Symptom                                      | Check                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Node/pnpm missing under `runuser`            | System-wide `/usr/bin/node` and `/usr/bin/pnpm`; avoid root-only nvm                                               |
| Connection refused immediately after startup | Retry health, then service logs and port 3000 listener                                                             |
| Welcome to Nginx                             | Enabled application site, default-site symlink and `nginx -t`                                                      |
| Login loop through HTTPS                     | Cookie setting, proxy trust, overwritten `X-Forwarded-Proto` and Host                                              |
| Invalid request origin                       | Proxy preserves the browser-facing Host, including non-default port                                                |
| Save conflict                                | Refresh the changed record and reconcile drafts; do not retry with an invented revision                            |
| Storage unavailable                          | Ownership, writable paths, LXC `ReadWritePaths` and free space (minimum 16 MiB readiness threshold)                |
| Missing images or storage-check failure      | Configured uploads path, missing/orphan report and verified backup; do not purge files blindly                     |
| Initial token rejected                       | Production bootstrap token matches the first-registration form; later registration is controlled in Administration |

`GET /api/health` returns the application version and readiness, or an unavailable response when storage initialization fails. It is not a full feature or proxy test. New accounts start without campaign records; administrators can create additional accounts locally. Password changes require the current password; forgotten passwords are reset by another administrator. There is no external email recovery service.

### Authentication throttling

Login attempts are limited to 10 per source and normalized username, 30 per source and 300 globally in 15 minutes. Registration attempts are limited to 5 per source and username, 10 per source and 30 globally in one hour. Missing credentials are rejected before charging quotas. At most four authentication operations can run concurrently; overload returns HTTP 503 and clients can retry shortly. All budgets are checked together; rejected requests do not consume any budget. Limits persist in SQLite and return HTTP 429 with `Retry-After`.

Client addresses are read only when `DM_COMMAND_TABLE_TRUST_PROXY=true`. Use this behind a trusted reverse proxy that overwrites forwarded client-address headers, as in the Debian installation guide, and keep the application port private. With proxy trust disabled, requests share the `direct-client` source budget; users behind the same proxy-visible address also share a source budget.

Prepared loading supports at most 10,000 resulting combatants, including retained allies. The load preview asks whether to preserve active Players/NPCs. Yes retains their current state and replaces only monsters with prepared monsters; No removes everyone and loads all prepared combatants. Oversized encounters are rejected before expansion. Loading a prepared encounter requires campaign editor or owner access. Repeated Player names are compared case-insensitively after trimming and use the last prepared entry. Monsters and NPCs can repeat. Loading an empty preparation clears Combat in replacement mode or retains only Players/NPCs in preservation mode; Undo restores the previous roster.

## Local resource limits

The application uses schema version 2, built on the v11 schema-version-1 baseline named `offline-runtime-baseline`. Startup applies `monster-token-section` to move existing marked Bestiary token images into their separate field. Use separate fresh database and uploads paths for the first v11 installation; v11-to-v12 and subsequent v12 upgrades retain existing paths and data. Unsupported schema identities are rejected without conversion. Never delete existing data to resolve a format error.

Runtime hosts need no Internet access. Catalogue imports can read local browser files or optionally fetch from dnd5e.lamagra.link in the browser, and Debian GUI updates optionally fetch/build/test approved releases before installing them. Building dependencies is a separate preparation step; transfer the packaged runtime or Docker image to an offline host. Updates do not change installed systemd/Nginx templates or environment settings.

Password derivation capacity is four concurrent operations per server process across all credential paths. Package import/export capacity is two operations, admitted before request-body reading. Busy operations return 503 and should be retried; authentication rate limits still apply. Capacity limits are local safeguards, not remote services or a substitute for proxy/body limits.

Screenshot bytes stream with backpressure and private conditional caching. Every cache validation is authorized against current access. SQL statements are reused but returned records and permissions are never cached. Backup checksums use 64 KiB chunks so a large SQLite file is not copied wholesale into process memory merely for hashing; backups and restores still verify the same SHA-256 values.

Use `pnpm verify` and CI's Node 24 browser and Docker checks before accepting a source update. Host-specific systemd/Nginx and restore acceptance still require your own LXC. Review [the technical assessment](security-efficiency-review.md) for exact coverage and limits.

## Automatic and offline updates

After the one-time [Debian updater installation](debian-13-lxc.md#updates-from-administration), the Admin button fetches, installs, verifies, builds, runs browser tests and packages the latest stable v12 release. Source preparation runs as a separate build account without application storage/settings/bootstrap variables; failures leave the active release running. The root-owned deployment helper verifies the immutable candidate, takes a stopped-service backup, switches and checks the exact expected health version, restoring code/data on failure.

Automatic updates need GitHub/package-registry connectivity and preconfigured system tools, supplied by the one-time installer. The browser cannot select commands, sources or paths. Root can pin a target or deliberately choose `staged` for an offline package workflow. Manifests detect transfer corruption rather than establish publisher authenticity; automatic mode trusts the fixed project repository. Keep prior releases/backups and retain failed build output for diagnosis. Routine application updates need no manual build or staging; root-owned helper/service changes remain host maintenance.

## Optional remote Bestiary catalogue

Open **Bestiary → Import monsters**; wait for **Catalogue connected**, then type at least two characters of a monster name or source. Preview type, CR, AC and HP, select one or more results and import. Duplicate name/source records offer replacement or discard. Imported records are local campaign copies and remain usable if the catalogue becomes unavailable.

Only the browser needs HTTPS access to `dnd5e.lamagra.link`; the Node server does not proxy downloads or require new secrets/services. Requests omit cookies and referrers. Opening the dialog connects automatically and shows a small **Catalogue connected** message once the index is loaded. If connection/search fails, close and reopen the window to retry, or import a local JSON file. Check browser network/CORS errors and any reverse-proxy CSP overrides without disabling TLS or application security headers.

## Fresh LXC installation

The [complete Debian 13 installer](debian-13-lxc.md#recommended-complete-installation-script) provisions the application, proxy, backup timer and automatic GUI updater from a bare dedicated container. It prints the initial administrator token only after application/proxy/updater/storage/backup checks pass, and retains it in root-only `/etc/dm-command-table.env`. Use that token to register the first administrator, then clear it and restart the application. Existing installations use Admin updates; the fresh installer refuses prior or partial application paths and accounts by default. The `--resume` option permits only pre-deployment failures with empty runtime/data directories and matching installer accounts; it preserves old build checkouts and refuses existing data/configuration/services. See the Debian guide for pnpm permission-error recovery. Failed installations retain diagnostic files and do not print a completion token.

## Clean builds

Use Node 24 (24.19.0 or newer; `.node-version` pins 24.21.0) and pnpm 11.25.0. `pnpm clean` removes generated build/test output and TypeScript caches without deleting source, environment files, application data or dependencies. Follow with `pnpm install --frozen-lockfile`, `pnpm verify`, browser regressions and `pnpm package:runtime`. Formatting and lint ignore generated output, so a previously packaged runtime never becomes part of source verification. The server and storage/backup/maintenance commands all use `scripts/storage-config.mjs`; exported absolute paths avoid working-directory ambiguity.

## Visual monster stat blocks

Import results offer **View stat block** before selection. Opening a Bestiary monster shows the same local parchment-style block with AC, HP, speed, ability scores/modifiers, traits/actions and spellcasting. Core fields and rich text remain editable through the existing Bestiary controls. Combat displays the independently captured encounter snapshot, so later Bestiary edits do not change a live encounter's block. All views render locally and remain available offline.

New imports retain alignment, armor/HP formula details, saving throws, skills, damage/condition defenses, senses, passive Perception, languages and full spell lists in the existing ability/spell fields. Existing saved records render their available fields immediately; reimport with replacement adds catalogue details that older imports did not retain. Existing combat snapshots keep their captured values. Stat blocks render locally without embedding the catalogue webpage.

Monster token icons appear at the upper right of visual stat blocks. Available tokens are downloaded from the catalogue during import and saved to the existing local image library; Bestiary and captured Combat blocks display these images offline. Reimport older monsters with replacement enabled to add tokens. Missing/unavailable token images do not block monster import. Token previews use temporary browser images. Both Bestiary and Combat stat blocks start expanded; click **Visual stat block** to collapse or expand them.

The v11.7 refactor keeps the existing schema version 2 and requires no additional migration or dependency. Install/update, local backups, media storage and rollback workflows remain the same. The optional catalogue remains the only allowed external runtime source; imported records and images are stored locally.

## Refreshing updater helpers on a v12 host

For an existing v11 host, first follow [Upgrading to v12](upgrading-to-v12.md). Once the application is already on v12, run this as root when refreshing its independently installed broker/build helpers and systemd limits:

```sh
bash /opt/dm-command-table/current/deploy/debian-13/install-gui-updater
systemctl show dm-command-table-updater.service -p MemoryMax -p CPUQuotaPerSecUSec -p TasksMax
```

The installer is included in the integrity-verified runtime. The unprivileged application cannot replace root helpers itself. Fresh v12 installations already apply these settings. Future GUI updates still perform all preparation automatically.

The updater service caps its process group at 2 GiB, two CPU cores worth of time and 512 tasks. Build stages have 20-minute deadlines and the overall source build has a one-hour deadline; ordinary Next builds also use a 1536 MiB JavaScript heap cap. These are ceilings, not reserved resources. The running application is separate and remains available while a candidate is prepared. Smaller or heavily loaded hosts may need an administrator to adjust service resource limits. Older source targets without the verified audit script receive a full `pnpm audit` instead; vulnerable older targets can fail that gate. Deployment recovery still restores the previous verified runtime and backup without rebuilding it.

## v12 operating changes

See [Upgrading to v12](upgrading-to-v12.md) before upgrading a v11 LXC. The independently installed root build helper must be updated once because its old release selector excludes v12; application updates cannot replace root-owned helpers. A v12 helper selects only stable v12 releases by default. Explicit root-pinned tags/SHAs and staged offline deployments remain available. Existing systemd resource ceilings, storage environment/settings and schema identity are retained.

Save transactions now skip disk-stat calls when used SQLite pages do not grow. Growing transactions still enforce the database budget and free-space reserve; Administration still reads full filesystem/WAL metrics. Prepared ordering updates only order/revision/timestamps and retains other browser draft content. Wrong-session or malformed nested API requests reject without changing data.
