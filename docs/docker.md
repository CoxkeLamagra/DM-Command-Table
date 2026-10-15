# Docker deployment

Docker is the secondary deployment target. It runs the same self-contained standalone runtime as Debian LXC, as an unprivileged user with persistent local SQLite, screenshots and backups. Runtime operation requires no Internet connection. Docker Engine and Compose must already be provisioned on the local host.

## Prepare and transfer an image

Build an approved source revision on a trusted build machine. Initial builds can download base images and npm dependencies; this is separate from runtime operation. Check out `v12.0.0` for this release and record the exact source commit alongside the image.

```sh
docker build -t dm-command-table:12.0.0 .
docker save -o dm-command-table-12.0.0.tar dm-command-table:12.0.0
```

Alternatively, build from an already prepared self-contained runtime without invoking a package manager. Load the approved Node base image locally first (`node:24.21.0-bookworm-slim`), then use the runtime directory as the entire build context:

```sh
pnpm package:runtime
node scripts/runtime-integrity.mjs dist/runtime
docker build --network none --pull=false -f "$PWD/Dockerfile.runtime" -t dm-command-table:12.0.0 dist/runtime
docker save -o dm-command-table-12.0.0.tar dm-command-table:12.0.0
```

`Dockerfile.runtime` copies only the supplied package and uses the prepared base image. Runtime preparation and base-image approval happen before an offline image build; no registry or package-manager access is needed by its build steps.

Transfer the approved image and the repository's `compose.yaml` and `.env.example` using trusted local media. On the offline host:

```sh
docker load -i dm-command-table-12.0.0.tar
cp .env.example .env
chmod 600 .env
openssl rand -base64 32
```

Enter the generated bootstrap token privately in `.env`; the first production administrator account requires it. Use fresh storage for a new v11 installation. Do not delete or reuse an older volume to resolve schema-format errors.

Create `compose.local.yaml` beside `compose.yaml`:

```yaml
services:
  dm-command-table:
    image: dm-command-table:12.0.0
    pull_policy: never
```

```sh
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml up --no-build --pull never --wait --wait-timeout 120
curl --fail http://127.0.0.1:3000/api/health
```

Use the same project name and both files for all following commands. `--no-build` and `--pull never` ensure the runtime host uses the loaded image. Storage paths inside the container are fixed to `/data`. Port 3000 binds to loopback by default. For LAN use, configure a local reverse proxy or the explicit `DMCT_BIND_ADDRESS`; trust forwarded headers only when clients cannot bypass that proxy. Use HTTPS and secure cookies for public endpoints.

The root filesystem is read-only; `/data` persists and temporary/cache paths use tmpfs. Run one instance against the volume. `down` retains it; `down -v` destroys it and is not an update or recovery operation.

## Offline updates

The Administration update panel reports the Debian broker as unavailable in Docker. Preserve host-managed image replacement without granting container privileges or mounting the Docker socket.

Create and verify a backup with the current image:

```sh
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml exec -T dm-command-table node scripts/backup-local.mjs
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml exec -T dm-command-table node scripts/restore-local.mjs /data/backups/BACKUP
```

Build/test the candidate elsewhere, transfer and load its approved image locally, then change `image` in `compose.local.yaml`. Run the same `up --no-build --pull never --wait` command. Check readiness, accounts, campaigns, prepared encounters, Combat and images. Only verified packages using the supported v11 baseline can share its data. Retain the previous image and matching backup for recovery; Docker has no automatic rollback equivalent to the Debian updater.

## Backup and maintenance

```sh
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml exec -T dm-command-table node scripts/check-local-storage.mjs
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml exec -T dm-command-table node scripts/backup-local.mjs
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml exec -T dm-command-table node scripts/maintenance.mjs
```

Schedule backups on the host and keep an additional offline copy. Copy the completed backup directory printed by the command to separate private storage. Backups in the application volume alone are not disaster recovery. See [operations](operations.md) for retention and quarantine.

## Restore to separate data

Stop the service and use the matching image to restore into a new empty directory in the persistent volume:

```sh
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml stop dm-command-table
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml run --rm --no-deps --pull never dm-command-table node scripts/restore-local.mjs /data/backups/BACKUP /data/recovered
```

Add the restored paths to the service's `environment` in `compose.local.yaml`:

```yaml
services:
  dm-command-table:
    image: dm-command-table:12.0.0
    pull_policy: never
    environment:
      DM_COMMAND_TABLE_DB_PATH: /data/recovered/dm-command-table.sqlite
      DM_COMMAND_TABLE_UPLOAD_PATH: /data/recovered/uploads
```

Start with the same offline `up` command and verify login, campaign records and embedded images. Restore refuses existing destinations and preserves original data. Restore a verified v11 backup with matching application code.

## Diagnose and acceptance

```sh
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml ps
docker compose -p dmct-offline -f compose.yaml -f compose.local.yaml logs --tail 100 dm-command-table
```

For LAN connectivity, check host bind address, proxy and firewall. For HTTPS login, check proxy trust, forwarded scheme and cookie settings. Validate image build, startup, storage and restore on a disposable Docker host before deployment; source/browser tests alone do not establish container acceptance.

## Optional online monster imports

Local JSON imports and normal application use remain offline. To search the online Bestiary, the user's browser must reach `https://dnd5e.lamagra.link`. Choose **Bestiary → Import monsters**; the catalogue connects automatically and shows **Catalogue connected** when ready; no server service, token or updater configuration is required. The downloaded monsters are saved as local campaign records. Keep local-file imports available when the remote catalogue is unreachable.

## v12 upgrades

Stop the old application and take/verify a consistent backup before switching images. v12 retains schema version 2 and the supported v11 local data format; mount the same persistent data paths and retain cookie/proxy settings. Start the new image and verify health reports `12.0.0`, login, campaign/media access and prepared ordering. Keep the old image and matching backup for recovery. Docker updates remain host-managed; the Debian root-helper upgrade procedure does not apply inside this container.
