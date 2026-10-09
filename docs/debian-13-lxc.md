# Debian 13 LXC deployment

This is the primary deployment target. Use a Debian 13 container with at least 2 CPU cores, 2 GB RAM for builds, and sufficient local disk for data, releases, and backups. The application runs without external services. Install Node 24 LTS and the pinned pnpm version system-wide using the commands below. Do not use a root-only nvm installation for the systemd service.

## Fresh installation

Run these commands as root. Install Git, Nginx, curl, and the build tools required by native dependencies:

```sh
apt update
apt install -y git nginx curl ca-certificates build-essential python3
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/dmct-nodesource-setup.sh
bash /tmp/dmct-nodesource-setup.sh
apt install -y nodejs
/usr/bin/npm install --global --prefix /usr pnpm@11.25.0
/usr/bin/node --version
/usr/bin/pnpm --version
useradd --system --home-dir /opt/dm-command-table --shell /usr/sbin/nologin dmct
install -d -o dmct -g dmct -m 0755 /opt/dm-command-table
install -d -o dmct -g dmct -m 0700 /var/lib/dm-command-table
runuser -u dmct -- git clone https://github.com/CoxkeLamagra/DM-Command-Table.git /opt/dm-command-table/source
```

Check out the approved release or commit in `source`. The current assessed release is `v9.2.0`. Check it out explicitly; cloning alone selects the moving main branch. Build the initial runtime as the service user:

```sh
cd /opt/dm-command-table/source
runuser -u dmct -- git checkout --detach v9.2.0
runuser -u dmct -- /usr/bin/node --version
runuser -u dmct -- /usr/bin/pnpm --version
runuser -u dmct -- /usr/bin/pnpm install --frozen-lockfile
runuser -u dmct -- /usr/bin/pnpm test
runuser -u dmct -- env NEXT_TELEMETRY_DISABLED=1 /usr/bin/pnpm build
install -d -o dmct -g dmct /opt/dm-command-table/releases
runuser -u dmct -- /usr/bin/node scripts/package-runtime.mjs /opt/dm-command-table/releases/initial
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
ln -sfn /etc/nginx/sites-available/dm-command-table /etc/nginx/sites-enabled/dm-command-table
# On this dedicated application container, disable Debian's welcome site.
# Its configuration remains available in sites-available/default.
if [ -L /etc/nginx/sites-enabled/default ]; then
  unlink /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl daemon-reload
systemctl enable --now dm-command-table.service dm-command-table-backup.timer
systemctl reload nginx
# systemctl can return before Node is listening; retry during startup.
curl --fail --show-error --retry 30 --retry-connrefused --retry-delay 1 --max-time 5 \
  http://127.0.0.1:3000/api/health
```

The health response should be `{"status":"ready","version":"9.2.0"}` for v9.2.0. Open `http://<LXC-IP>/` or your configured hostname from your computer. Port 3000 is loopback-only; Nginx serves the application on port 80.

If health checks fail after the retries, inspect the service rather than rebuilding immediately:

```sh
systemctl status dm-command-table.service --no-pager -l
journalctl -u dm-command-table.service -b -n 80 --no-pager
readlink -f /opt/dm-command-table/current
ls -l /opt/dm-command-table/current/server.js
ss -ltnp 'sport = :3000'
```

If you see **Welcome to nginx**, confirm that the application site is enabled and the default welcome-site symlink is disabled, then run `nginx -t && systemctl reload nginx` and refresh the page. Check `ls -l /etc/nginx/sites-enabled/` if the welcome page remains. On a host serving other applications, configure the application's actual `server_name` and preserve those other sites.

Configure the Nginx server name and TLS for your local network. The Node service listens only on loopback. Nginx overwrites forwarded host/protocol headers; do not blindly trust client-supplied headers. If another trusted TLS proxy sits in front of Nginx, configure its exact addresses and the forwarded scheme explicitly. Verify login and cookie behavior through your actual HTTPS endpoint.

## Updates and rollback

For the current release, run `update-dm-command-table v9.2.0`. Existing v9 installations use their current data; only pre-v9 installations need separate fresh storage.

Run `update-dm-command-table <approved-tag-or-commit>` as root. The default target is `origin/main`. A clean source checkout is required. The updater locks concurrent updates, builds and tests a detached worktree while the old service runs, packages an immutable candidate, stops the service, creates a consistent database-and-image backup, then atomically switches the `current` symlink. It checks `/api/health` after starting.

If the candidate fails, the updater restores the matching backup into a new directory, updates storage paths in the environment file, switches back to the previous code, and checks health again. Original data and failed-release files are retained for inspection. Never manually copy only the SQLite main file while its WAL is active.

The v9 baseline is intentionally incompatible with earlier versions. Deploy it into a fresh data directory; this updater is for subsequent releases using the new baseline. Earlier JSON exports are not a supported migration contract.

## Backups and recovery

The daily timer runs `scripts/backup-local.mjs` and then maintenance. Backups include a SQLite snapshot, image files, and checksums. Monitor timer status and available disk space. Backups are retained; choose a retention policy appropriate to your disk and keep an additional offline copy.

To verify a backup:

```sh
cd /opt/dm-command-table/current
/usr/bin/node scripts/restore-local.mjs /var/lib/dm-command-table/backups/BACKUP
```

To recover, stop the service and restore into an empty, service-owned destination:

```sh
systemctl stop dm-command-table
runuser -u dmct -- /usr/bin/node scripts/restore-local.mjs /var/lib/dm-command-table/backups/BACKUP /var/lib/dm-command-table/recovered
```

Set `DM_COMMAND_TABLE_DB_PATH` to the recovered `dm-command-table.sqlite` and `DM_COMMAND_TABLE_UPLOAD_PATH` to its `uploads` directory. Start the matching application release and verify health, login, campaign records, and embedded images. Check `journalctl -u dm-command-table` and `systemctl list-timers dm-command-table-backup.timer` when diagnosing failures.

## Missing node or pnpm

If `runuser` reports that `node` or `pnpm` does not exist, the prerequisites were not installed system-wide or were installed only in root's shell environment. Run the NodeSource and pnpm installation commands above as root, then verify `/usr/bin/node` and `/usr/bin/pnpm` as `dmct` before retrying the build. The systemd units explicitly use `/usr/bin/node`.

Do not copy root's nvm binaries or root-owned package-manager caches into the service account. If npm reports an existing Corepack pnpm shim, inspect `/usr/bin/pnpm` and remove that shim using `/usr/bin/corepack disable pnpm`, then repeat the pinned pnpm installation.

## Configuration and maintenance

See [operations](operations.md) for every environment setting, live backup and storage-check commands, media quarantine, retention and safe removal of old build/release directories. The updater and systemd use `/etc/dm-command-table.env`; a `.env.local` in the source checkout does not configure the service. If you move writable storage outside `/var/lib/dm-command-table`, update the service's `ReadWritePaths` before restarting.

The updater installs new application code and operational scripts in each runtime. It does not replace the installed updater, Nginx configuration, environment file or systemd units. Review changes under `deploy/debian-13/` separately when upgrading and reinstall approved templates without overwriting your local settings.
