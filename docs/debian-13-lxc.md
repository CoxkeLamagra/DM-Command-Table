# Debian 13 LXC installation and recovery

This guide starts with a bare Debian 13 LXC and ends with a running application, local administrator account, scheduled backups and optional automatic administrator-triggered updates. Debian 13 LXC is the primary deployment target.

The default path builds the approved release inside the LXC. Initial OS/tool/dependency installation and browser downloads need Internet access. Once packaged, ordinary application use is local; automatic updates contact source/package hosts only when started. A separate-build-machine alternative is included below for keeping build tools off the runtime host. Bundled npm libraries are retained.

## Recommended: complete installation script

For a **fresh, dedicated Debian 13 LXC**, open its console as **root**. The container must already have systemd as PID 1, an amd64/arm64 CPU, a LAN address, working DNS and Internet routing. Allocate at least 2 CPU cores, 4 GiB RAM and 12 GiB disk, with additional space for data, backups, retained builds and releases. The script does not configure the LXC host's networking or firewall.

Run these commands in the console. The first two supply the download tool and trusted CA certificates missing from some bare templates:

```bash
set -euo pipefail
apt-get update
apt-get install -y ca-certificates curl
curl --fail --show-error --silent --location \
  https://raw.githubusercontent.com/CoxkeLamagra/DM-Command-Table/v11.3.2/deploy/debian-13/install-dm-command-table \
  --output /root/install-dm-command-table
bash /root/install-dm-command-table
```

The [standalone installer](../deploy/debian-13/install-dm-command-table) defaults to the pinned v11.3.2 release. It installs signed Debian prerequisites and Chromium, signed NodeSource Node 24, pnpm 11.25.0, separate `dmct`/`dmct-build` accounts, fresh local storage, frozen application dependencies, the verified standalone runtime, Nginx, the daily backup timer and the automatic GUI updater. It runs audit/format/lint/type/unit/build/browser checks before deployment, then checks direct/proxy health, protected endpoint behavior and the updater socket **as the runtime account**, validates storage and takes an initial backup. No separate updater installation or manual build is needed. Keep the console open while these checks run; installation time depends on network/CPU resources.

On success the console displays the installed version, LXC addresses and **Initial install token**. Open `http://<LXC-IP>/` in a LAN browser, choose **Register**, and enter that token in **Initial setup token** along with your username, display name and password. The first account becomes administrator and public registration closes automatically. The token is printed deliberately for the person installing the application; keep the console output private. It is also retained in root-only mode `0600` in `/etc/dm-command-table.env`. After registration the token cannot create another account. You can optionally clear it and restart:

```bash
sed -i 's/^DM_COMMAND_TABLE_BOOTSTRAP_TOKEN=.*/DM_COMMAND_TABLE_BOOTSTRAP_TOKEN=/' /etc/dm-command-table.env
systemctl restart dm-command-table.service
```

For future versions use **Administration → Update application**. Existing installations must use their updater; the default fresh installer refuses existing accounts, data, releases, service files and partial installations without overwriting them. A failed installation stops without printing a completion token and retains files for diagnosis. For a failure before runtime deployment, download the corrected installer and run it with `--resume`. This accepts only empty runtime/data directories and matching installer accounts, retains previous build checkouts, and starts a fresh build. It refuses existing files, links, runtime configuration or services; later installation failures require manual inspection. Never delete existing application data just to rerun it. Concurrent installers are prevented by `/run/lock/dm-command-table-install.lock`; after a forced interruption, remove that empty lock directory only after confirming no installer remains running. Run `bash /root/install-dm-command-table --help` for usage; `--release v11.MINOR.PATCH` can select a different approved stable release from v11.3.0 onward.

### Recover from the pnpm permission error

Installers before v11.3.2 could install global pnpm with private root-only permissions, causing `env: '/usr/bin/pnpm': Permission denied` when the build account starts dependency installation. Version 11.3.2 sets public tool permissions, repairs a previously private global pnpm installation and verifies execution as `dmct-build` before fetching/building. The root-only bootstrap environment remains private.

For the reported failure at **Install locked application dependencies**, run as root in the same LXC:

```bash
set -euo pipefail
curl --fail --show-error --silent --location \
  https://raw.githubusercontent.com/CoxkeLamagra/DM-Command-Table/v11.3.2/deploy/debian-13/install-dm-command-table \
  --output /root/install-dm-command-table
bash /root/install-dm-command-table --resume
```

No account removal or data deletion is required. If resumption reports existing data/configuration, stop and inspect that later-stage installation manually. On successful completion, use the printed initial token to register the first administrator normally.

The default endpoint uses trusted-LAN HTTP. For access outside that network, apply the HTTPS section below before entering credentials. Allow port 80 (or your configured HTTPS port) through the LXC host firewall; Node port 3000 stays on loopback. Initial installation and subsequent GUI updates require access to Debian/NodeSource repositories, GitHub and npm package registries. Local application use and local JSON imports remain usable offline.

The numbered sections below are the **manual alternative** and troubleshooting reference. After a successful scripted installation, continue with administrator registration and the optional HTTPS/recovery guidance rather than repeating the manual setup.

## 1. Prepare the container and root shell

Create a Debian 13 container using your LXC host's supported template and give it a LAN address, working DNS and a default gateway. Use at least 2 CPU cores, 4 GiB RAM and 12 GiB disk for building/testing locally, plus space for campaign data, images, releases and backups. A runtime-only container can use fewer resources. Standard unprivileged LXC is sufficient; Docker, nesting and a privileged container are not required. The LXC host manages networking and any host firewall.

Open the container console as root. If logged in as another account, run `su -`; these commands do not assume `sudo` is installed. Run all sections in the same Bash shell unless instructed otherwise. Stop and fix any failing command before continuing; these commands are for a new, dedicated container and must not overwrite an existing installation.

```bash
set -euo pipefail
test "$(id -u)" = 0
(. /etc/os-release; test "$ID" = debian; test "$VERSION_ID" = 13)
test "$(cat /proc/1/comm)" = systemd
getent hosts deb.debian.org
```

If PID 1 is not systemd or DNS/default routing is missing, fix the LXC template/network configuration on the host first. The application does not configure the LXC host itself.

## 2. Install Debian prerequisites

```bash
apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git nginx openssl \
  build-essential python3 util-linux iproute2 procps xz-utils nano
ip -brief address
ip route
```

These supply TLS verification, Git, Nginx, password-token generation, native dependency build tools, `runuser`/`flock`, diagnostics and an editor. Apply any required container reboot after OS upgrades, then reopen the root shell and repeat the root/Debian/systemd checks. Do not disable APT signature or TLS verification to resolve download errors.

## 3. Install Node 24 and pinned pnpm system-wide

The systemd units call `/usr/bin/node`. Install Node system-wide rather than into root's nvm shell. Configure NodeSource's signed Node 24 repository:

```bash
install -d -m 0755 /etc/apt/keyrings
curl --fail --show-error --silent --location \
  https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  --output /tmp/dmct-nodesource-key
gpg --batch --dearmor --output /etc/apt/keyrings/nodesource.gpg /tmp/dmct-nodesource-key
chmod 0644 /etc/apt/keyrings/nodesource.gpg
cat > /etc/apt/sources.list.d/nodesource.sources <<EOF
Types: deb
URIs: https://deb.nodesource.com/node_24.x
Suites: nodistro
Components: main
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/nodesource.gpg
EOF
apt-get update
apt-get install -y nodejs
/usr/bin/node --version
/usr/bin/npm --version
/usr/bin/npm install --global --prefix /usr pnpm@11.25.0
/usr/bin/pnpm --version
```

Node must report `v24.x`; pnpm must report `11.25.0`. NodeSource's supported architectures are amd64 and arm64. The `.gpg.key` suffix is intentional. If an existing Node/pnpm/Corepack installation conflicts with these paths, inspect it before replacing anything; a bare installation should have no pnpm shim. Global installation is run as root here, so no `sudo` is needed.

```bash
test "$(/usr/bin/node -p 'process.versions.node.split(".")[0]')" = 24
test "$(/usr/bin/pnpm --version)" = 11.25.0
/usr/bin/node -e 'const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(":memory:"); db.exec("CREATE TABLE readiness(id INTEGER)"); db.close(); console.log("Local SQLite is available.")'
```

## 4. Create separate runtime and build accounts

The runtime account writes data but cannot modify executable releases. A separate unprivileged account owns the build checkout and dependency caches. These names and paths must not already belong to a different installation:

```bash
useradd --system --user-group --home-dir /var/lib/dm-command-table --shell /usr/sbin/nologin dmct
useradd --system --user-group --home-dir /var/cache/dm-command-table-build --shell /usr/sbin/nologin dmct-build
install -d -o root -g root -m 0755 /opt/dm-command-table
install -d -o root -g root -m 0755 /opt/dm-command-table/releases
install -d -o root -g root -m 0755 /opt/dm-command-table/incoming
install -d -o dmct -g dmct -m 0700 /var/lib/dm-command-table
install -d -o dmct -g dmct -m 0700 /var/lib/dm-command-table/uploads
install -d -o dmct -g dmct -m 0700 /var/lib/dm-command-table/backups
install -d -o dmct-build -g dmct-build -m 0755 /var/cache/dm-command-table-build
install -d -o root -g root -m 0755 /usr/local/lib/dm-command-table
cd /var/cache/dm-command-table-build
runuser -u dmct-build -- /usr/bin/node --version
runuser -u dmct-build -- /usr/bin/pnpm --version
```

Use separate fresh data for version 11; pre-v11 databases and exports are not a supported upgrade contract. Keep earlier installations and backups with their matching application code. Never delete old data to resolve an unsupported-format error.

## 5. Check out, build and test the release

From the build directory, clone the source and select the release explicitly. A clone alone selects the moving default branch:

```bash
cd /var/cache/dm-command-table-build
runuser -u dmct-build -- git clone https://github.com/CoxkeLamagra/DM-Command-Table.git source
cd /var/cache/dm-command-table-build/source
runuser -u dmct-build -- git checkout --detach v11.3.2
runuser -u dmct-build -- git rev-parse HEAD
runuser -u dmct-build -- /usr/bin/pnpm install --frozen-lockfile
runuser -u dmct-build -- /usr/bin/pnpm verify
```

`verify` includes the production dependency audit, formatting, lint, TypeScript, unit/API tests and production build. Installation keeps the lockfile and supply-chain checks intact. The working directory is deliberately accessible to the build account; running `runuser` from `/root` can cause permission failures.

For the default Debian LXC installation, use Debian's packaged Chromium. This avoids a separate Chrome-for-Testing download and obtains the browser and its shared-library dependencies through signed APT packages:

```bash
apt-get install -y chromium
/usr/bin/chromium --version
cd /var/cache/dm-command-table-build/source
runuser -u dmct-build -- /usr/bin/env DM_COMMAND_TABLE_TEST_CHROMIUM_PATH=/usr/bin/chromium /usr/bin/pnpm test:browser
runuser -u dmct-build -- /usr/bin/pnpm package:runtime
runuser -u dmct-build -- /usr/bin/node scripts/runtime-integrity.mjs dist/runtime
```

`DM_COMMAND_TABLE_TEST_CHROMIUM_PATH` selects a local executable for browser tests only; it does not affect application startup. This option is available from v11.0.1 onward. Without it, Playwright continues using its pinned Chromium for CI and other environments. System Chromium may differ from that pinned version; the test assertions remain unchanged.

If you specifically need the Playwright-pinned browser and its download endpoint is reachable, use this alternative instead:

```bash
cd /var/cache/dm-command-table-build/source
/usr/bin/pnpm exec playwright install-deps chromium
runuser -u dmct-build -- /usr/bin/pnpm exec playwright install chromium
runuser -u dmct-build -- /usr/bin/pnpm test:browser
```

The OS-library step runs as root; the browser download and tests run as `dmct-build`. A failed download must be resolved or replaced with the signed Debian Chromium option before running tests. Do not continue after `Failed to install browsers` or disable verification. If the download fails, preserve the preceding URL/HTTP/network error to diagnose the blocked destination.

The browser suite uses disposable data and port 3100; do not have another service using that port. `package:runtime` refuses an existing destination, so preserve an earlier package or choose a new absolute destination when rebuilding. Keep using the same build account so browser caches and permissions remain consistent.

## 6. Install the approved runtime and templates

Stay in the source checkout. Copy the complete package, including dependencies, assets, relative symlinks and its manifest. The release destination and `current` link must not already exist:

```bash
cd /var/cache/dm-command-table-build/source
test ! -e /opt/dm-command-table/releases/initial
test ! -e /opt/dm-command-table/current
test ! -L /opt/dm-command-table/current
install -o root -g root -m 0644 scripts/runtime-integrity.mjs /usr/local/lib/dm-command-table/runtime-integrity.mjs
cp -a dist/runtime /opt/dm-command-table/releases/initial
chown -R root:root /opt/dm-command-table/releases/initial
chmod -R a+rX,go-w /opt/dm-command-table/releases/initial
/usr/bin/node /usr/local/lib/dm-command-table/runtime-integrity.mjs /opt/dm-command-table/releases/initial --trusted-staging
ln -s /opt/dm-command-table/releases/initial /opt/dm-command-table/current
install -o root -g root -m 0600 deploy/debian-13/dm-command-table.env.example /etc/dm-command-table.env
install -o root -g root -m 0644 deploy/debian-13/dm-command-table.service /etc/systemd/system/
install -o root -g root -m 0644 deploy/debian-13/dm-command-table-backup.service /etc/systemd/system/
install -o root -g root -m 0644 deploy/debian-13/dm-command-table-backup.timer /etc/systemd/system/
install -o root -g root -m 0644 deploy/debian-13/nginx-dm-command-table.conf /etc/nginx/sites-available/dm-command-table
```

The independent root-owned verifier checks package integrity and staging ownership before any executable update. Manifest checksums detect transfer damage; approve the source/build yourself rather than treating the manifest as a publisher signature.

## 7. Configure storage and initial registration

Generate a bootstrap token directly into the private environment file:

```bash
DMCT_BOOTSTRAP_TOKEN=$(openssl rand -hex 32)
sed -i "s/^DM_COMMAND_TABLE_BOOTSTRAP_TOKEN=.*/DM_COMMAND_TABLE_BOOTSTRAP_TOKEN=$DMCT_BOOTSTRAP_TOKEN/" /etc/dm-command-table.env
unset DMCT_BOOTSTRAP_TOKEN
nano /etc/dm-command-table.env
```

Keep these template settings for the default layout:

```ini
DM_COMMAND_TABLE_DB_PATH=/var/lib/dm-command-table/dm-command-table.sqlite
DM_COMMAND_TABLE_UPLOAD_PATH=/var/lib/dm-command-table/uploads
DM_COMMAND_TABLE_BACKUP_PATH=/var/lib/dm-command-table/backups
DM_COMMAND_TABLE_TRUST_PROXY=true
DM_COMMAND_TABLE_SECURE_COOKIES=auto
DM_COMMAND_TABLE_REGISTRATION_MODE=first-user
```

Leave the generated bootstrap token in its existing line; do not replace it with the example placeholder. Read it privately in the editor when registering the first account, and never paste it into chat or logs. Preserve root ownership and mode `0600`. The file uses shell-compatible `KEY=value` assignments; quote values containing spaces.

Proxy trust is safe here because Node binds to loopback and the installed Nginx template overwrites forwarded headers. `auto` uses non-secure cookies on trusted LAN HTTP and secure cookies when this Nginx endpoint serves HTTPS. For access outside a trusted private network, configure HTTPS before entering passwords. Production tools read this exported environment, not a source-checkout `.env.local`.

## 8. Enable Nginx and start the application

Enable the application site. On this dedicated container, disable only Debian's default welcome-site symlink; retain its file and any unrelated sites:

```bash
ln -s /etc/nginx/sites-available/dm-command-table /etc/nginx/sites-enabled/dm-command-table
if [ -L /etc/nginx/sites-enabled/default ]; then
  unlink /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl daemon-reload
systemctl enable --now nginx.service dm-command-table.service dm-command-table-backup.timer
systemctl reload nginx
curl --fail --show-error --retry 30 --retry-connrefused --retry-delay 1 --max-time 5 http://127.0.0.1:3000/api/health
curl --fail --show-error http://127.0.0.1/api/health
test "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/api/campaigns)" = 401
systemctl is-active nginx.service dm-command-table.service
systemctl list-timers dm-command-table-backup.timer --no-pager
```

Both health requests must return `status: ready` and version `11.3.2`; unauthenticated campaign access must return 401. Startup retries allow time for Node to listen. The SQLite schema is created automatically by the first API request. Nginx serves port 80; Node's port 3000 remains loopback-only. Allow the selected HTTP/HTTPS port in the LXC host's firewall for the intended LAN clients; do not open port 3000 externally.

Use `ip -brief address` to find the LAN address, then open `http://<container-LAN-IP>/` from your computer. Register the first administrator with the private bootstrap token. Keep self-registration disabled unless you intentionally enable it through Administration. Create a campaign/session, upload a screenshot, save and reload to verify the browser-facing installation.

After the administrator account exists, clear the bootstrap token and restart:

```bash
sed -i 's/^DM_COMMAND_TABLE_BOOTSTRAP_TOKEN=.*/DM_COMMAND_TABLE_BOOTSTRAP_TOKEN=/' /etc/dm-command-table.env
systemctl restart dm-command-table.service
curl --fail --show-error --retry 30 --retry-connrefused --retry-delay 1 --max-time 5 http://127.0.0.1:3000/api/health
```

## 9. Check storage and the backup schedule

Load the protected environment as root, then preserve it while running operational tools as the unprivileged runtime account:

```bash
cd /opt/dm-command-table/current
set -a
source /etc/dm-command-table.env
set +a
runuser -u dmct --preserve-environment -- /usr/bin/node scripts/check-local-storage.mjs
systemctl start dm-command-table-backup.service
journalctl -u dm-command-table-backup.service -n 30 --no-pager
systemctl list-timers dm-command-table-backup.timer --no-pager
```

The storage check must pass and the backup service must complete successfully. The daily timer also runs maintenance. Keep an additional offline copy and choose a retention policy; backups/releases are retained rather than automatically deleted. The recovery section below explains how to verify and restore a printed backup path.

## Optional: locally provisioned HTTPS

For private deployments, use a certificate issued by your local CA and trusted by client browsers. A self-signed certificate can be used for testing if you explicitly trust it on your clients. No public certificate service is required. Set a hostname that resolves to the container on your LAN; replace this example with your own:

```bash
DMCT_HOSTNAME=dmct.example.internal
install -d -o root -g root -m 0700 /etc/ssl/private
openssl req -x509 -newkey rsa:3072 -sha256 -days 365 -nodes \
  -keyout /etc/ssl/private/dm-command-table.key \
  -out /etc/ssl/certs/dm-command-table.crt \
  -subj "/CN=$DMCT_HOSTNAME" -addext "subjectAltName=DNS:$DMCT_HOSTNAME"
chmod 0600 /etc/ssl/private/dm-command-table.key
nano /etc/nginx/sites-available/dm-command-table
```

In the existing server block, replace the two `listen` lines and `server_name _;` with the following, substituting your actual hostname:

```nginx
listen 443 ssl;
listen [::]:443 ssl;
server_name dmct.example.internal;
ssl_certificate /etc/ssl/certs/dm-command-table.crt;
ssl_certificate_key /etc/ssl/private/dm-command-table.key;
ssl_protocols TLSv1.2 TLSv1.3;
```

Keep its existing locations and proxy headers. Add a separate HTTP redirect block:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dmct.example.internal;
    return 301 https://$host$request_uri;
}
```

```bash
nginx -t
systemctl reload nginx
curl --fail --show-error --cacert /etc/ssl/certs/dm-command-table.crt \
  --resolve "$DMCT_HOSTNAME:443:127.0.0.1" "https://$DMCT_HOSTNAME/api/health"
```

Configure LAN DNS (or each client's hosts file) for this hostname, trust the certificate/local CA on clients, allow port 443 at the host firewall, and check login through HTTPS. Do not disable certificate verification. Renew the certificate before it expires. If another proxy terminates TLS ahead of Nginx, this example needs a host-specific trusted-proxy configuration; do not simply trust arbitrary incoming forwarded headers.

## Alternative: build elsewhere and transfer a runtime

To avoid retaining build tools/checkouts on the runtime LXC, provision Debian prerequisites and system-wide Node as above, then build on a trusted compatible Linux machine of the same architecture. That machine needs the same Node/pnpm/native build tools and browser prerequisites from sections 2–5. Do not use a Windows/macOS package or native dependencies from an incompatible Linux platform.

On the build machine, use the section 5 commands to check out `v11.3.2`, install frozen dependencies, verify, run browser tests and produce `dist/runtime`. Copy the complete runtime, deployment templates and independent verifier to local media or through your trusted LAN. An example bundle, created from the source checkout, is:

```bash
mkdir -p dist/lxc-bundle
cp -a dist/runtime dist/lxc-bundle/runtime
cp -a deploy/debian-13 dist/lxc-bundle/deploy
cp scripts/runtime-integrity.mjs dist/lxc-bundle/runtime-integrity.mjs
tar -C dist/lxc-bundle -czf dist/dm-command-table-v11.3.2-lxc.tar.gz .
(cd dist; sha256sum dm-command-table-v11.3.2-lxc.tar.gz > dm-command-table-v11.3.2-lxc.tar.gz.sha256)
```

Transfer both files from the approved build. Verify the checksum from that trusted transfer before extracting into a new staging directory. Checksums alone do not establish who produced the bundle. On the runtime host:

```bash
cd /path/to/transferred-files
sha256sum --check dm-command-table-v11.3.2-lxc.tar.gz.sha256
install -d -o root -g root -m 0700 /root/dmct-install
tar -xzf dm-command-table-v11.3.2-lxc.tar.gz -C /root/dmct-install
cd /root/dmct-install
```

For this path, create only the `dmct` account and runtime directories from section 4; skip the build account, source clone and pnpm/browser installation on the runtime host. Follow section 6 from `/root/dmct-install` (skip its source-checkout `cd`), using `runtime` instead of `dist/runtime`, `runtime-integrity.mjs` instead of `scripts/runtime-integrity.mjs`, and `deploy/` instead of `deploy/debian-13/`. Continue sections 7–9 normally. GUI-update installation below uses `deploy/` from this bundle too. Keep the root-only bundle staging directory separate from the root-owned `/opt` release path.

A host with no Internet access at all must receive Debian/Node packages and their dependency closure from a trusted local APT mirror or installation media before these steps. No npm registry, Git checkout, pnpm or browser installation is needed on that runtime-only host. OS and Node provisioning is still required; a runtime bundle does not contain the operating system or Node executable.

## Updates from Administration

After one-time installation of the automatic updater, **Update application** handles the complete update. It downloads the latest stable v11 release from the fixed project repository, installs frozen dependencies, performs audit/format/lint/type/unit checks, builds the production runtime, runs browser tests using Debian Chromium, packages and verifies the result, then backs up data, switches releases and checks readiness. Failed preparation leaves the running application untouched. A failed deployment restores the previous release and its matching stopped-service backup.

### One-time setup or upgrade from the staged-only updater

Run these commands once as root using an approved source checkout. On an existing installation, the root-owned staged-only updater cannot replace itself through the unprivileged web application; this installer replaces that service once. It does not require a manual application build. After installation, use the Admin button even if the currently running application is still v11.1.0.

```bash
cd /var/cache/dm-command-table-build/source
runuser -u dmct-build -- git fetch --tags origin
runuser -u dmct-build -- git checkout --detach v11.3.2
bash deploy/debian-13/install-gui-updater
```

For a fresh installation where section 5 already selected this release, only the installer command is needed. With a complete transferred LXC bundle, run `bash /root/dmct-install/deploy/install-gui-updater` instead. The installer checks system-wide Node 24, installs Git/curl/Chromium/native build tools and pnpm 11.25.0, creates the separate build account when missing, installs the root-owned broker/build helper/updater/verifier and enables the service. It refuses to replace a running update. The application itself remains running during installation. Do not modify source checkout files before running the installer.

The updater service needs outbound HTTPS access to GitHub and the npm registry (and GitHub release/CDN hosts required by dependencies), plus working DNS. Its former localhost-only network restriction is removed by this installer because it prevented automatic downloads. Custom systemd/network restrictions may still need host-specific adjustment. No GitHub token is required for this public repository, and no application credentials are passed to builds. Ordinary application operation remains local; remote Bestiary access is separately optional.

### Routine updates: Admin button only

Open **Administration → Application updates**, save open edits and confirm **Update application**. The default source is **Latest stable v11 release**. No terminal, manual dependency installation, build or runtime staging is needed for routine updates. The source is resolved to an exact Git commit and recorded in the log. The existing application keeps serving while preparation runs, then briefly stops for the consistent backup and release switch.

Progress includes prerequisites, fetch, install, verification, unit tests, production build, browser tests, packaging, backup, switch, readiness and cleanup/rollback. Browser closure and temporary application unavailability do not interrupt the independent broker. The page polls and reconnects; reload after success. Duplicate starts attach to the existing job. The final 64 KiB of output, administrator ID, timestamps, exit status and step results remain local.

Source builds use a new isolated checkout owned by `dmct-build`; the updater never resets your installation checkout or builds as root. Application storage/settings/bootstrap credentials are excluded from build subprocesses. The root-owned verifier checks the copied immutable release before the old service stops. Runtime code is root-owned, while `dmct` only writes local application data. Successful temporary build directories are removed; failed builds, prior releases and backups are retained for diagnosis and host-managed retention.

The fixed repository is `CoxkeLamagra/DM-Command-Table`. Browser requests accept only start/status, never a repository, executable, path, branch or environment override. Root can select `latest` (default, stable v11 tags), `origin/main`, a stable release tag or full commit SHA with a service drop-in:

```ini
[Service]
Environment=DM_COMMAND_TABLE_UPDATE_TARGET=latest
```

To change that setting, use `systemctl edit dm-command-table-updater.service`, then `systemctl daemon-reload` and `systemctl restart dm-command-table-updater.service` only when idle. Latest excludes prereleases and newer major-version tags; a new major baseline requires its own reviewed installation. The socket remains root-owned with group `dmct` and mode `0660`, and broker state remains root-private. Docker stays host-managed; do not install this privileged broker inside a Docker application container.

### CLI and offline alternative

The root CLI `update-dm-command-table` performs the same automatic update; an optional validated target argument can pin an approved release. CLI jobs use the same lock but show logs in the terminal rather than as broker jobs.

Offline hosts can retain manual package preparation: build and test elsewhere using the alternative installation workflow above, transfer/approve the complete runtime and stage it at `/opt/dm-command-table/incoming/runtime` with root ownership and no group/other write permissions. Stage only while no update is running and preserve any previous incoming package. Verify with the independently installed verifier, then use:

```bash
/usr/bin/node /usr/local/lib/dm-command-table/runtime-integrity.mjs /opt/dm-command-table/incoming/runtime --trusted-staging
update-dm-command-table staged
```

Root may set `DM_COMMAND_TABLE_UPDATE_TARGET=staged` for a deliberately staged-only Admin workflow. That mode still requires manual package preparation; it is not the default automatic workflow. Runtime/broker packages must already be installed before using this alternative.

### Failure and rollback

A dependency, audit, lint/type/unit/browser test or build failure occurs before stopping the application. Inspect its step/log rather than bypassing checks. The updater retains the failed build directory for diagnosis. After the old service stops, any backup/switch/startup/readiness failure triggers recovery. Candidate health must report both `ready` and the expected application version. A failed candidate restores its stopped-service backup to a separate directory, updates storage paths and switches back to the prior code. Original data and failed releases are retained.

The broker reports a recovered deployment as failed with a completed rollback. If the broker restarts mid-update, the job is interrupted; inspect health/current release/logs before retrying. Never replace installed helper files during a running update. An unexpected `current.next` path requires inspection instead of automatic deletion. Major baseline changes and privileged helper/service changes remain host configuration changes; routine application releases use the automatic workflow.

## Backups and recovery

The timer creates consistent local SQLite/image backups and runs maintenance. Choose retention and an additional offline copy. Verify a backup with the matching runtime:

```sh
cd /opt/dm-command-table/current
/usr/bin/node scripts/restore-local.mjs /var/lib/dm-command-table/backups/BACKUP
```

Stop the service and restore to an empty, service-writable destination:

```sh
cd /opt/dm-command-table/current
set -a
source /etc/dm-command-table.env
set +a
systemctl stop dm-command-table
runuser -u dmct --preserve-environment -- /usr/bin/node /opt/dm-command-table/current/scripts/restore-local.mjs /var/lib/dm-command-table/backups/BACKUP /var/lib/dm-command-table/recovered
```

Set database/uploads paths to the restored files, start the matching release and check accounts, campaigns and images. Backups from earlier baselines belong with their original release, not this fresh-install version. Never copy an active SQLite main file alone while its WAL is active.

## Troubleshooting and host acceptance

| Symptom                                             | Check and correction                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser download fails / browser executable missing | Install `chromium` with APT and use `DM_COMMAND_TABLE_TEST_CHROMIUM_PATH=/usr/bin/chromium` as in section 5. Do not run tests with a missing browser. |
| `pnpm: command not found`                           | Complete section 3; verify `/usr/bin/pnpm --version` reports `11.25.0`, then verify it through `runuser` in section 4.                                |
| Node/SQLite is missing or too old                   | Complete the signed Node 24 installation and SQLite probe in section 3; do not use Debian's older Node or a root-only nvm path for these units.       |
| Permission denied scanning `/root`                  | Change to the accessible build checkout before running commands as `dmct-build`.                                                                      |
| Welcome to nginx                                    | Enable the application site, disable only the default welcome-site symlink on a dedicated container, run `nginx -t`, then reload.                     |
| Connection refused on port 3000                     | Inspect application status/logs and the current release link; allow startup retries rather than rebuilding immediately.                               |
| LAN browser cannot connect                          | Check container IP, LXC host routing/firewall and Nginx listener; Node's loopback port is intentionally inaccessible remotely.                        |
| Bootstrap token rejected                            | Use the token from the private environment file for first registration and confirm the service was restarted after changes.                           |
| Login fails on HTTPS                                | Check the certificate trust, actual hostname, forwarded scheme and cookie/proxy settings through the real endpoint.                                   |
| Unsupported database format                         | Select separate fresh storage for version 11; retain old databases/backups with their original release.                                               |
| Package/staging verification fails                  | Use the complete same-architecture approved runtime and correct root ownership; do not bypass hashes, TLS or signature checks.                        |

```sh
systemctl status dm-command-table.service dm-command-table-updater.service --no-pager -l
journalctl -u dm-command-table.service -u dm-command-table-updater.service -b -n 100 --no-pager
readlink -f /opt/dm-command-table/current
ss -ltnp 'sport = :3000'
```

Missing Node, inaccessible runtime files, incorrect storage permissions and proxy/cookie mismatches are host setup issues. The updater requires root-owned executable directories; old service-owned installation layouts must be replaced with a separately prepared fresh installation. Review [operations](operations.md) for settings, storage checks and maintenance.

Source/unit/browser/package checks and deployment simulations do not establish systemd/Nginx update lifecycle acceptance. Validate installation, successful update, failed health rollback and recovery on a disposable Debian LXC before using the updater on live data.

## Optional online monster imports

Local JSON imports and normal application use remain offline. To search the online Bestiary, the user's browser must reach `https://dnd5e.lamagra.link`. Choose **Bestiary → Import monsters**; the catalogue connects automatically and shows **Catalogue connected** when ready; no server service, token or updater configuration is required. The downloaded monsters are saved as local campaign records. Keep local-file imports available when the remote catalogue is unreachable.
