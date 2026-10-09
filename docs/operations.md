# Configuration and operations

Keep one application instance and persistent local storage. Debian LXC is primary; Docker is secondary. [LXC](debian-13-lxc.md) and [Docker](docker.md) describe deployment-specific commands. Nothing here requires an external database, media store or identity provider.

## Environment reference

| Variable                                      | Default                              | Purpose                                                                             |
| --------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| `DM_COMMAND_TABLE_DB_PATH`                    | `data/dm-command-table.sqlite`       | SQLite file; use an absolute production path                                        |
| `DM_COMMAND_TABLE_UPLOAD_PATH`                | `uploads` beside the database        | Local screenshot directory                                                          |
| `DM_COMMAND_TABLE_BACKUP_PATH`                | `backups` beside the database        | Verified backup destination                                                         |
| `DM_COMMAND_TABLE_BOOTSTRAP_TOKEN`            | empty                                | Required for initial administrator registration in production                       |
| `DM_COMMAND_TABLE_REGISTRATION_MODE`          | `first-user`                         | Initial registration mode; `open` enables additional registration                   |
| `DM_COMMAND_TABLE_TRUST_PROXY`                | `false`                              | Accept forwarded client address and HTTPS scheme from a trusted proxy               |
| `DM_COMMAND_TABLE_SECURE_COOKIES`             | `auto`                               | `true` always secure, `false` never secure, `auto` uses HTTPS only with proxy trust |
| `DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB`        | `100`                                | Per-account media quota in MiB                                                      |
| `DM_COMMAND_TABLE_SCREENSHOT_GLOBAL_QUOTA_MB` | `1024`                               | Server-wide media quota in MiB                                                      |
| `DM_COMMAND_TABLE_COMBAT_HISTORY_LIMIT`       | `100`                                | Maximum retained undo snapshots per encounter                                       |
| `DM_COMMAND_TABLE_AUDIT_EVENT_LIMIT`          | `10000`                              | Maximum retained audit events                                                       |
| `PORT`                                        | `3000` in deployment templates       | HTTP listener port                                                                  |
| `HOSTNAME`                                    | loopback in LXC; `0.0.0.0` in Docker | Standalone server listener address                                                  |
| `DM_COMMAND_TABLE_BIND_ADDRESS`               | `127.0.0.1`                          | Bind override for `pnpm start` only                                                 |
| `DMCT_BIND_ADDRESS`                           | `127.0.0.1`                          | Compose host port bind; not an application setting                                  |
| `NEXT_TELEMETRY_DISABLED`                     | `1` in deployment templates          | Disable Next.js telemetry                                                           |

Administration stores registration and server settings in SQLite. Saved cookie, quota, undo and audit settings take precedence over their environment defaults. Session lifetime defaults to 30 days and upload size to 8 MiB; both are changed in Administration, not via an environment variable. Screenshot upload size can be 1–50 MiB; set proxy body limits accordingly. Campaign package imports have their own size limit.

The development server uses Next.js environment loading. Standalone startup and Node maintenance scripts should receive exported variables. On LXC, systemd and the updater read `/etc/dm-command-table.env`. Compose interpolates `.env` into the service environment. Keep these files private; do not assume a source `.env.local` configures production commands.

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

Prepared encounters may expand to at most 10,000 combatants, including custom Players/NPCs and any Players/NPCs retained in the current combat. Oversized encounters are rejected before expansion. Loading a prepared encounter requires campaign editor or owner access.
