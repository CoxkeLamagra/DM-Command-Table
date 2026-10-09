# Docker deployment

Docker is the secondary deployment target. It builds the same standalone runtime used by Debian LXC, runs one unprivileged application instance, and stores the database, screenshots and backups in a persistent named volume. Use Docker Engine with the Compose plugin.

## Install v9.3.0

```sh
git clone https://github.com/CoxkeLamagra/DM-Command-Table.git
cd DM-Command-Table
git checkout --detach v9.3.0
cp .env.example .env
chmod 600 .env
openssl rand -base64 32
```

Put the generated value in `DM_COMMAND_TABLE_BOOTSTRAP_TOKEN` in `.env`; keep it private and enter it when creating the first administrator. Compose reads `.env` for interpolation. Storage paths inside the container are fixed to `/data`; the development paths in the example do not replace these. Keep registration in `first-user` mode unless intentionally onboarding more accounts.

```sh
docker compose up --build --wait --wait-timeout 120
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

The readiness response includes version `9.3.0`. Open `http://localhost:3000` on the Docker host. For another computer, configure a local reverse proxy or explicitly set `DMCT_BIND_ADDRESS` in `.env` to the host's LAN address. The default bind is loopback. When using a reverse proxy, preserve the original Host and overwrite forwarded headers; enable `DM_COMMAND_TABLE_TRUST_PROXY=true` only if direct access cannot bypass that proxy. Use secure cookies with HTTPS.

The root filesystem is read-only; `/data` persists and temporary/cache directories use tmpfs. Do not run multiple instances against the volume. `docker compose down` retains the named volume; `down -v` destroys it and is not an update or recovery command.

## Update

Create and verify a backup first. Record the running tag or commit. Fetch and select the approved release, then rebuild:

```sh
docker compose exec -T dm-command-table node scripts/backup-local.mjs
# Verify the printed backup path, for example:
docker compose exec -T dm-command-table node scripts/restore-local.mjs /data/backups/BACKUP
git fetch --tags origin
git checkout --detach APPROVED_TAG_OR_COMMIT
docker compose up --build --wait --wait-timeout 120
curl --fail http://127.0.0.1:3000/api/health
```

Replace `BACKUP` and `APPROVED_TAG_OR_COMMIT` with actual values. Verify login, campaigns, prepared encounters, Combat and embedded images. Existing v9 installations retain their data. Pre-v9 databases require a separate fresh volume. Docker Compose has no automatic rollback equivalent to the LXC updater. If a candidate fails, stop it, use the matching previous code and verified pre-update backup, and follow the recovery procedure below.

## Backup and maintenance

```sh
docker compose exec -T dm-command-table node scripts/check-local-storage.mjs
docker compose exec -T dm-command-table node scripts/backup-local.mjs
docker compose exec -T dm-command-table node scripts/maintenance.mjs
```

Docker does not install a backup schedule. Schedule the backup command on the host, verify its result, then run maintenance. Backups inside the application volume are not an offline copy. Copy a completed directory to separate storage; use the path printed by the backup command:

```sh
install -d -m 0700 ./backup-copy
docker compose cp dm-command-table:/data/backups/BACKUP ./backup-copy/
```

Keep account data and images private. See [operations](operations.md) for retention and quarantine behavior.

## Restore to separate data

Stop the running service. Restore a verified backup into a new empty directory in the existing named volume, using the same application release that created it:

```sh
docker compose stop dm-command-table
docker compose run --rm --no-deps dm-command-table node scripts/restore-local.mjs /data/backups/BACKUP /data/recovered
```

Create `compose.recovery.yaml` beside `compose.yaml`:

```yaml
services:
  dm-command-table:
    environment:
      DM_COMMAND_TABLE_DB_PATH: /data/recovered/dm-command-table.sqlite
      DM_COMMAND_TABLE_UPLOAD_PATH: /data/recovered/uploads
```

```sh
docker compose -f compose.yaml -f compose.recovery.yaml up --wait --wait-timeout 120
```

Use both files for subsequent commands while that recovered directory is active. Original data is preserved. Validate readiness, login and embedded images before accepting the recovery. A restore never merges into or overwrites an existing directory.

## Diagnose

```sh
docker compose ps
docker compose logs --tail 100 dm-command-table
docker compose exec -T dm-command-table node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"
```

If localhost works but another computer cannot connect, check the host bind address, proxy and firewall. If login fails through HTTPS, check proxy trust, forwarded scheme and cookie settings. Use [operations](operations.md) for storage and authentication diagnostics.
