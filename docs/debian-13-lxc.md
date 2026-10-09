# Debian 13 LXC deployment

This is the primary deployment target. Use a Debian 13 container with at least 2 CPU cores, 2 GB RAM for builds, and sufficient local disk for data, releases, and backups. The application runs without external services. Install a supported Node 24 LTS runtime and enable Corepack before continuing. Pin and review your runtime version in your own provisioning process.

## Fresh installation

Run these commands as root. Install Git, Nginx, curl, and the build tools required by native dependencies:

```sh
apt update
apt install -y git nginx curl ca-certificates build-essential python3
corepack enable
useradd --system --home-dir /opt/dm-command-table --shell /usr/sbin/nologin dmct
install -d -o dmct -g dmct -m 0755 /opt/dm-command-table
install -d -o dmct -g dmct -m 0700 /var/lib/dm-command-table
runuser -u dmct -- git clone https://github.com/CoxkeLamagra/DM-Command-Table.git /opt/dm-command-table/source
```

Check out the approved release or commit in `source`. The refactor branch is not a published release. Build the initial runtime as the service user:

```sh
cd /opt/dm-command-table/source
runuser -u dmct -- pnpm install --frozen-lockfile
runuser -u dmct -- pnpm test
runuser -u dmct -- env NEXT_TELEMETRY_DISABLED=1 pnpm build
install -d -o dmct -g dmct /opt/dm-command-table/releases
runuser -u dmct -- node scripts/package-runtime.mjs /opt/dm-command-table/releases/initial
ln -s /opt/dm-command-table/releases/initial /opt/dm-command-table/current
install -m 0600 deploy/debian-13/dm-command-table.env.example /etc/dm-command-table.env
```

Edit `/etc/dm-command-table.env`. Set a long random bootstrap token, absolute local storage paths, and your cookie policy. This file must use shell-compatible `KEY=value` assignments because both systemd and the updater read it. Quote values containing spaces. Keep it root-owned and private. The first account requires the bootstrap token. Disable registration after setup unless you intend to allow other local accounts.

Install the service, backup schedule, updater, and reverse proxy:

```sh
install -m 0644 deploy/debian-13/dm-command-table.service /etc/systemd/system/
install -m 0644 deploy/debian-13/dm-command-table-backup.service /etc/systemd/system/
install -m 0644 deploy/debian-13/dm-command-table-backup.timer /etc/systemd/system/
install -m 0755 deploy/debian-13/update-dm-command-table /usr/local/sbin/
install -m 0644 deploy/debian-13/nginx-dm-command-table.conf /etc/nginx/sites-available/dm-command-table
ln -s /etc/nginx/sites-available/dm-command-table /etc/nginx/sites-enabled/dm-command-table
nginx -t
systemctl daemon-reload
systemctl enable --now dm-command-table.service dm-command-table-backup.timer
systemctl reload nginx
curl --fail http://127.0.0.1:3000/api/health
```

Configure the Nginx server name and TLS for your local network. The Node service listens only on loopback. Nginx overwrites forwarded host/protocol headers; do not blindly trust client-supplied headers. If another trusted TLS proxy sits in front of Nginx, configure its exact addresses and the forwarded scheme explicitly. Verify login and cookie behavior through your actual HTTPS endpoint.

## Updates and rollback

Run `update-dm-command-table <approved-tag-or-commit>` as root. The default target is `origin/main`. A clean source checkout is required. The updater locks concurrent updates, builds and tests a detached worktree while the old service runs, packages an immutable candidate, stops the service, creates a consistent database-and-image backup, then atomically switches the `current` symlink. It checks `/api/health` after starting.

If the candidate fails, the updater restores the matching backup into a new directory, updates storage paths in the environment file, switches back to the previous code, and checks health again. Original data and failed-release files are retained for inspection. Never manually copy only the SQLite main file while its WAL is active.

The v9 baseline is intentionally incompatible with earlier versions. Deploy it into a fresh data directory; this updater is for subsequent releases using the new baseline. Earlier JSON exports are not a supported migration contract.

## Backups and recovery

The daily timer runs `scripts/backup-local.mjs` and then maintenance. Backups include a SQLite snapshot, image files, and checksums. Monitor timer status and available disk space. Backups are retained; choose a retention policy appropriate to your disk and keep an additional offline copy.

To verify a backup:

```sh
cd /opt/dm-command-table/current
node scripts/restore-local.mjs /var/lib/dm-command-table/backups/BACKUP
```

To recover, stop the service and restore into an empty, service-owned destination:

```sh
systemctl stop dm-command-table
runuser -u dmct -- node scripts/restore-local.mjs /var/lib/dm-command-table/backups/BACKUP /var/lib/dm-command-table/recovered
```

Set `DM_COMMAND_TABLE_DB_PATH` to the recovered `dm-command-table.sqlite` and `DM_COMMAND_TABLE_UPLOAD_PATH` to its `uploads` directory. Start the matching application release and verify health, login, campaign records, and embedded images. Check `journalctl -u dm-command-table` and `systemctl list-timers dm-command-table-backup.timer` when diagnosing failures.
