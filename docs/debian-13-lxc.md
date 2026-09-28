# Deploy DM Command Table in a Debian 13 LXC

This guide installs DM Command Table directly in a Debian 13 (Trixie) LXC container. It uses:

- Node.js 22 and pnpm 11
- A systemd service for automatic startup and recovery
- Nginx as a reverse proxy
- A server-local SQLite database
- A reusable update command based on `git pull --ff-only`

The application checkout and persistent data are deliberately separated:

| Purpose | Location |
| --- | --- |
| Git checkout | `/opt/dm-command-table/app` |
| SQLite data | `/var/lib/dm-command-table` |
| Runtime environment | `/etc/dm-command-table.env` |
| systemd service | `/etc/systemd/system/dm-command-table.service` |
| Nginx site | `/etc/nginx/sites-available/dm-command-table` |
| Update command | `/usr/local/sbin/update-dm-command-table` |

Pulling or rebuilding the Git repository does not overwrite the SQLite database.

This guide applies to DM Command Table **v5.0.0**.

## 1. Create the LXC

Create a Debian 13 LXC in Proxmox or another LXC host. Recommended minimum resources for a small private deployment:

- 1 CPU core
- 1 GB RAM
- 8 GB disk
- A static IP address or DHCP reservation
- Unprivileged container where possible

Start the container and open its console or connect over SSH. All commands below are run as `root` inside the LXC.

Confirm the operating system:

```bash
cat /etc/os-release
```

The output should identify Debian 13 / Trixie.

## 2. Update Debian and install system packages

```bash
apt update
apt full-upgrade -y
apt install -y ca-certificates curl git nginx sqlite3
```

Reboot the LXC if the upgrade installed a new kernel-facing userspace or systemd update:

```bash
reboot
```

Reconnect after the container starts.

## 3. Install Node.js 22 and pnpm

The project requires Node.js 22.13 or newer. Install the NodeSource Node.js 22 repository and package:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh
apt install -y nodejs
rm /tmp/nodesource_setup.sh
```

Enable Corepack and activate the pnpm version used by the repository:

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
```

Verify the installed tools:

```bash
node --version
pnpm --version
command -v pnpm
git --version
```

Node must report `v22.13.0` or newer, and pnpm should report `11.25.0`. The pnpm path can be `/usr/bin/pnpm` or `/usr/local/bin/pnpm`; the supplied service resolves it through the configured system PATH.

## 4. Create the service account and persistent directories

```bash
useradd --system --user-group --home-dir /opt/dm-command-table --shell /usr/sbin/nologin dmct
mkdir -p /opt/dm-command-table /var/lib/dm-command-table
chown -R dmct:dmct /opt/dm-command-table /var/lib/dm-command-table
chmod 750 /var/lib/dm-command-table
```

The `dmct` account cannot log in interactively and owns only the application and database directories.

## 5. Clone and build the application

Clone the `main` branch as the service account:

```bash
runuser -u dmct -- git clone --branch main --single-branch \
  https://github.com/CoxkeLamagra/DM-Command-Table.git \
  /opt/dm-command-table/app
```

Install exactly the dependencies recorded in the lockfile and create the production build:

```bash
cd /opt/dm-command-table/app
runuser -u dmct -- /usr/bin/env HOME=/opt/dm-command-table pnpm install --frozen-lockfile
runuser -u dmct -- /usr/bin/env HOME=/opt/dm-command-table pnpm build
test -f /opt/dm-command-table/app/.next/BUILD_ID
```

The final command must succeed. It verifies that Next.js produced the build required by the systemd service.

## 6. Configure SQLite and local authentication

Install the supplied environment template:

```bash
cp /opt/dm-command-table/app/deploy/debian-13/dm-command-table.env.example \
  /etc/dm-command-table.env
chmod 640 /etc/dm-command-table.env
chown root:dmct /etc/dm-command-table.env
```

Review the configuration:

```bash
nano /etc/dm-command-table.env
```

Generate a unique initial-account token and replace `REPLACE_WITH_A_LONG_RANDOM_VALUE` in the environment file:

```bash
openssl rand -base64 32
```

The first registration must supply this value in the **Initial setup token** field. After the administrator exists, remove or rotate the token. Later registrations are disabled by default. Administrators can enable or disable self-registration and create additional accounts from the **Administration** screen.

For the default deployment, keep automatic HTTPS detection:

```text
DM_COMMAND_TABLE_SECURE_COOKIES=auto
```

Use `false` only for a trusted plain-HTTP network where HTTPS will not be configured.

The SQLite file and account schema are created automatically on the first API request. After the service starts, open the site and use **Register** to create the initial administrator with a username, password, and the configured setup token.

Each new account receives an editable example campaign. It can be renamed, changed, exported, or deleted after the user has explored the available features.

Passwords are salted and hashed with `scrypt`. Login sessions and password hashes remain in `/var/lib/dm-command-table/dm-command-table.sqlite`; uploaded screenshots are stored in `/var/lib/dm-command-table/uploads`. No external authentication, media, or database service is used.

Screenshot files are validated and converted to WebP. The default quota is 100 MiB per account. Change `DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB` if the server has a different storage budget.

When Nginx serves HTTPS, its `X-Forwarded-Proto` header causes `auto` mode to mark session cookies secure. You may use `true` to enforce secure cookies unconditionally.

## 7. Install and start the systemd service

```bash
cp /opt/dm-command-table/app/deploy/debian-13/dm-command-table.service \
  /etc/systemd/system/dm-command-table.service
systemctl daemon-reload
systemctl enable --now dm-command-table.service
```

Check the service:

```bash
systemctl status dm-command-table.service --no-pager
journalctl -u dm-command-table.service -n 100 --no-pager
```

Test the application directly from inside the LXC:

```bash
curl -I http://127.0.0.1:3000
```

## 8. Configure Nginx

Install the supplied Nginx configuration:

```bash
cp /opt/dm-command-table/app/deploy/debian-13/nginx-dm-command-table.conf \
  /etc/nginx/sites-available/dm-command-table
ln -s /etc/nginx/sites-available/dm-command-table \
  /etc/nginx/sites-enabled/dm-command-table
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Open the LXC IP address in a browser:

```text
http://LXC-IP-ADDRESS/
```

If a firewall is enabled, allow TCP port 80. Do not expose port 3000; the Node.js server listens only on `127.0.0.1`.

### Optional hostname and HTTPS

Replace `server_name _;` in `/etc/nginx/sites-available/dm-command-table` with the DNS hostname before configuring TLS. Use your preferred certificate solution after the DNS record points to the LXC. Keep the Node.js application bound to `127.0.0.1:3000`.

For any Internet-accessible deployment, HTTPS is required. After installing the certificate, redirect port 80 to HTTPS and add this header to the TLS-enabled Nginx server block only after confirming HTTPS works:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## 9. Install the update command

```bash
cp /opt/dm-command-table/app/deploy/debian-13/update-dm-command-table \
  /usr/local/sbin/update-dm-command-table
chmod 750 /usr/local/sbin/update-dm-command-table
chown root:root /usr/local/sbin/update-dm-command-table
```

Update the site at any time with:

```bash
update-dm-command-table
```

The updater performs these actions:

1. Refuses to continue if the Git checkout contains local or staged changes.
2. Stops the application service.
3. Runs `git pull --ff-only` from GitHub.
4. Installs the exact locked dependencies.
5. Builds the new production version.
6. Starts the service and displays its status.

If pulling, installing, or building fails, the updater leaves the service stopped so the failure is visible and an incomplete build is not started. After resolving the error, rerun `update-dm-command-table` or start the existing build manually with:

```bash
systemctl start dm-command-table.service
```

## 10. Manual update commands

The same update can be performed manually:

```bash
systemctl stop dm-command-table.service
runuser -u dmct -- git -C /opt/dm-command-table/app pull --ff-only
cd /opt/dm-command-table/app
runuser -u dmct -- /usr/bin/env HOME=/opt/dm-command-table pnpm install --frozen-lockfile
runuser -u dmct -- /usr/bin/env HOME=/opt/dm-command-table pnpm build
systemctl start dm-command-table.service
systemctl status dm-command-table.service --no-pager
```

Ensure `/etc/dm-command-table.env` contains:

```text
DM_COMMAND_TABLE_DB_PATH=/var/lib/dm-command-table/dm-command-table.sqlite
DM_COMMAND_TABLE_UPLOAD_PATH=/var/lib/dm-command-table/uploads
DM_COMMAND_TABLE_SECURE_COOKIES=auto
DM_COMMAND_TABLE_REGISTRATION_MODE=first-user
DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB=100
NODE_ENV=production
PORT=3000
```

Retain a securely generated `DM_COMMAND_TABLE_BOOTSTRAP_TOKEN` until the first administrator has registered. Automatic cookie mode uses Nginx's forwarded protocol; `true` can enforce HTTPS-only cookies after TLS is active.

## 11. Back up and restore server data

Create a consistent live backup:

```bash
mkdir -p /var/backups/dm-command-table
sqlite3 /var/lib/dm-command-table/dm-command-table.sqlite \
  ".backup '/var/backups/dm-command-table/dm-command-table-$(date +%F).sqlite'"
tar -C /var/lib/dm-command-table -czf \
  "/var/backups/dm-command-table/uploads-$(date +%F).tar.gz" uploads
```

List available backups:

```bash
ls -lh /var/backups/dm-command-table
```

To restore a backup, stop the service first:

```bash
systemctl stop dm-command-table.service
cp /var/backups/dm-command-table/dm-command-table-YYYY-MM-DD.sqlite \
  /var/lib/dm-command-table/dm-command-table.sqlite
tar -C /var/lib/dm-command-table -xzf \
  /var/backups/dm-command-table/uploads-YYYY-MM-DD.tar.gz
chown -R dmct:dmct /var/lib/dm-command-table
systemctl start dm-command-table.service
```

## Troubleshooting

### Service does not start

```bash
systemctl status dm-command-table.service --no-pager
journalctl -u dm-command-table.service -n 200 --no-pager
```

Verify that pnpm can be resolved and that a production build exists:

```bash
command -v pnpm
cd /opt/dm-command-table/app
runuser -u dmct -- /usr/bin/env HOME=/opt/dm-command-table pnpm --version
test -f /opt/dm-command-table/app/.next/BUILD_ID
```

If the build check fails, recreate it before restarting the service:

```bash
cd /opt/dm-command-table/app
runuser -u dmct -- /usr/bin/env HOME=/opt/dm-command-table pnpm install --frozen-lockfile
runuser -u dmct -- /usr/bin/env HOME=/opt/dm-command-table pnpm build
systemctl restart dm-command-table.service
```

If the journal mentions `Failed to set up mount namespacing` for `.next`, update the repository and reinstall the service template so `.next` is not required before the process starts.

If an update reports `EACCES: permission denied, open '/root/.corepack.env'`, reinstall the updater. It runs from `/opt/dm-command-table/app` and sets `HOME=/opt/dm-command-table` before pnpm and Corepack start.

### Nginx reports `502 Bad Gateway`

Confirm that the application is running and listening locally:

```bash
systemctl status dm-command-table.service --no-pager
ss -lntp | grep ':3000'
curl -I http://127.0.0.1:3000
```

### SQLite permission error

```bash
chown -R dmct:dmct /var/lib/dm-command-table
chmod 750 /var/lib/dm-command-table
systemctl restart dm-command-table.service
```

### Update is rejected because the checkout is dirty

Inspect the changes instead of discarding them automatically:

```bash
runuser -u dmct -- git -C /opt/dm-command-table/app status --short
```

Commit, move, or deliberately remove those changes before running the updater again.
