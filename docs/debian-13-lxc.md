# Debian 13 LXC installation and recovery

Debian 13 LXC is the primary deployment target. Provision Node 24 system-wide at `/usr/bin/node`, Nginx, curl, util-linux (`runuser`, `flock`) and standard shell tools on the host. They may be installed from local Debian packages on an offline host. No Git checkout, npm registry, pnpm installation or Internet connection is required on the runtime host. Use one application instance with enough disk space for data, runtime releases and backups.

## Prepare the runtime

On a trusted build machine, use an approved source revision, Node 22.13+ (Node 24 recommended) and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm exec playwright install chromium
pnpm test:browser
pnpm package:runtime
node scripts/runtime-integrity.mjs dist/runtime
```

These preparation steps can download dependencies and browsers. Transfer `dist/runtime` and the approved `deploy/debian-13/` templates plus `scripts/runtime-integrity.mjs` using local media or your trusted local network. Include dependencies and relative symlinks; do not copy only `server.js`. Keep `runtime-manifest.json` with the package. Checksums detect damage but do not prove authenticity: approve the source/build and transfer before installation. Check out `v11.0.0` for this release and record its exact commit before building.

## Fresh installation

As root, create the local account and directories. If they exist, inspect and preserve their contents first. Use separate fresh storage for this baseline; earlier databases are rejected.

```sh
useradd --system --home-dir /var/lib/dm-command-table --shell /usr/sbin/nologin dmct
install -d -o root -g root -m 0755 /opt/dm-command-table
install -d -o root -g root -m 0755 /opt/dm-command-table/releases
install -d -o root -g root -m 0755 /opt/dm-command-table/incoming
install -d -o dmct -g dmct -m 0700 /var/lib/dm-command-table
install -d -o root -g root -m 0755 /usr/local/lib/dm-command-table
install -o root -g root -m 0644 scripts/runtime-integrity.mjs /usr/local/lib/dm-command-table/runtime-integrity.mjs
```

From the directory containing the transferred, approved `runtime/`, install an initial release. The destination must not already exist:

```sh
test ! -e /opt/dm-command-table/releases/initial
cp -a runtime /opt/dm-command-table/releases/initial
chown -R root:root /opt/dm-command-table/releases/initial
chmod -R a+rX,go-w /opt/dm-command-table/releases/initial
node /usr/local/lib/dm-command-table/runtime-integrity.mjs /opt/dm-command-table/releases/initial --trusted-staging
ln -s /opt/dm-command-table/releases/initial /opt/dm-command-table/current
install -m 0600 deploy/debian-13/dm-command-table.env.example /etc/dm-command-table.env
```

Edit `/etc/dm-command-table.env`: use absolute fresh database/uploads/backup paths and a locally generated random bootstrap token. The first production account requires that token; rotate/remove it afterwards. Keep this file root-owned and private, using shell-compatible `KEY=value` assignments. Configure proxy trust and secure cookies for the actual endpoint. No credentials leave the server.

Install approved templates:

```sh
install -m 0644 deploy/debian-13/dm-command-table.service /etc/systemd/system/
install -m 0644 deploy/debian-13/dm-command-table-backup.service /etc/systemd/system/
install -m 0644 deploy/debian-13/dm-command-table-backup.timer /etc/systemd/system/
install -m 0644 deploy/debian-13/nginx-dm-command-table.conf /etc/nginx/sites-available/dm-command-table
ln -s /etc/nginx/sites-available/dm-command-table /etc/nginx/sites-enabled/dm-command-table
nginx -t
systemctl daemon-reload
systemctl enable --now dm-command-table.service dm-command-table-backup.timer
systemctl reload nginx
curl --fail --show-error --retry 30 --retry-connrefused --retry-delay 1 --max-time 5 http://127.0.0.1:3000/api/health
```

On a dedicated container, disable Debian's welcome-site symlink if necessary; preserve unrelated sites. Configure Nginx's server name and locally provisioned TLS. Node listens on loopback. Nginx must overwrite forwarded headers; enable proxy trust only where clients cannot bypass the proxy. Check login, cookie behavior and screenshots through your actual endpoint. A healthy response reports `status: ready` and the package's version.

## Updates from Administration

Install the optional independent root-owned broker and offline updater once:

```sh
install -o root -g root -m 0644 deploy/debian-13/update-broker.mjs /usr/local/lib/dm-command-table/update-broker.mjs
install -o root -g root -m 0755 deploy/debian-13/update-dm-command-table /usr/local/sbin/update-dm-command-table
install -o root -g root -m 0644 deploy/debian-13/dm-command-table-updater.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now dm-command-table-updater.service
```

Before every update, build, test and approve a self-contained package on the build machine. When no update is running, preserve any previous incoming package elsewhere, then copy the approved package to `/opt/dm-command-table/incoming/runtime`. The path and its ancestors must be real, root-owned directories without group/other write permission. The staged files must be root-owned and not writable by other users. Make code readable by `dmct` while leaving data private:

```sh
test ! -e /opt/dm-command-table/incoming/runtime
cp -a runtime /opt/dm-command-table/incoming/runtime
chown -R root:root /opt/dm-command-table/incoming/runtime
chmod -R a+rX,go-w /opt/dm-command-table/incoming/runtime
node /usr/local/lib/dm-command-table/runtime-integrity.mjs /opt/dm-command-table/incoming/runtime --trusted-staging
```

Open **Administration → Application updates**, save open edits, then confirm **Update application**. The fixed source is the staged directory. The browser cannot select paths, upload executable packages, specify commands or change environment values. Root staging supplies executable-code approval; application administrators trigger installation of that approved package. Neither the broker nor updater fetches source or installs dependencies. The systemd broker permits only localhost IP traffic.

The panel retains prerequisite, verification, packaging, backup, switch, health, cleanup and rollback progress, administrator ID, timestamps, exit status and the final 64 KiB of output. Duplicate starts attach to the running job. The browser can close or reconnect during restart; the broker remains alive independently. Reload the application after success.

The socket is `/run/dm-command-table-updater/control.sock`, root-owned with group `dmct` and mode `0660`, inside a `0750` directory. State is root-private under `/var/lib/dm-command-table-updater`. The web service remains unprivileged. Only install approved updater/broker/verifier files; an application update never replaces them automatically. Disable the broker when idle with `systemctl disable --now dm-command-table-updater.service` if GUI updates are unwanted. Docker and hosts without it retain host-managed replacement.

## CLI updates and rollback

Run `update-dm-command-table` as root with no arguments. It uses the same fixed staged package and lock as the GUI. Both current and candidate manifests must match `offline-runtime-baseline`; earlier releases need a separate fresh installation. The updater verifies the staged package and its copy before stopping the service, backs up committed database/image state using the previous release, atomically switches `current`, and checks local readiness.

On a switch/startup/readiness failure it stops the candidate, restores the backup into a separate directory, updates storage paths and returns to the previous release. Original data, candidate files, staging, prior releases and backups are retained. A recovered failed deployment remains a failed job, with completed rollback. CLI logs are shown in the terminal rather than as broker jobs. Host-managed retention is deliberate.

If the broker restarts mid-update, the job becomes interrupted. Inspect service health, `current`, logs and data before retrying. Never replace the incoming directory, broker or installed scripts during an update. An unexpected `current.next` path requires inspection rather than automatic deletion.

## Backups and recovery

The timer creates consistent local SQLite/image backups and runs maintenance. Choose retention and an additional offline copy. Verify a backup with the matching runtime:

```sh
cd /opt/dm-command-table/current
node scripts/restore-local.mjs /var/lib/dm-command-table/backups/BACKUP
```

Stop the service and restore to an empty, service-writable destination:

```sh
systemctl stop dm-command-table
runuser -u dmct -- /usr/bin/node /opt/dm-command-table/current/scripts/restore-local.mjs /var/lib/dm-command-table/backups/BACKUP /var/lib/dm-command-table/recovered
```

Set database/uploads paths to the restored files, start the matching release and check accounts, campaigns and images. Backups from earlier baselines belong with their original release, not this fresh-install version. Never copy an active SQLite main file alone while its WAL is active.

## Troubleshooting and host acceptance

```sh
systemctl status dm-command-table.service dm-command-table-updater.service --no-pager -l
journalctl -u dm-command-table.service -u dm-command-table-updater.service -b -n 100 --no-pager
readlink -f /opt/dm-command-table/current
ss -ltnp 'sport = :3000'
```

Missing Node, inaccessible runtime files, incorrect storage permissions and proxy/cookie mismatches are host setup issues. The updater requires root-owned executable directories; old service-owned installation layouts must be replaced with a separately prepared fresh installation. Review [operations](operations.md) for settings, storage checks and maintenance.

Source/unit/browser/package checks do not establish systemd/Nginx update lifecycle acceptance. Validate installation, successful update, failed health rollback and recovery on a disposable Debian LXC before using the updater on live data.
