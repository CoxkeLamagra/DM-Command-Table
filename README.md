# DM Command Table

DM Command Table is a self-hosted workspace for preparing and running tabletop RPG campaigns. The current release is **12.1.3**. The repository and release history start at **v11**; the v11 SQLite baseline is the supported data format. Existing supported v11/v12 accounts and campaign data are retained; v12.1 applies schema migration 3 automatically. Back up before updating; downgrading requires the previous runtime and its matching pre-update backup.

Accounts, campaigns, Players/NPCs, Bestiary records, Stories/Sessions, prepared encounters, combat, search, screenshots and backups live on your server. Bundled libraries support offline operation. Opening Import monsters connects automatically to `dnd5e.lamagra.link`; local JSON imports remain available offline. Debian GUI updates contact GitHub and package registries only when you start an update.

## Fresh Debian 13 LXC

Use a dedicated amd64/arm64 container with systemd, networking, at least 2 CPU cores, 4 GiB RAM and 12 GiB disk plus data/backup space. Run as root:

```bash
set -euo pipefail
apt-get update
apt-get install -y ca-certificates curl
curl -fsSL https://raw.githubusercontent.com/CoxkeLamagra/DM-Command-Table/v12.1.3/deploy/debian-13/install-dm-command-table \
  -o /root/install-dm-command-table
bash /root/install-dm-command-table
```

The script installs prerequisites, tests/builds the application, configures Nginx and scheduled backups, and enables automatic GUI updates. On completion it prints an **initial install token** in the LXC console. Open `http://<LXC-IP>/`, choose **Register**, and enter that token to create the first administrator. Public registration then closes automatically.

For a failed installation before runtime deployment, run the corrected script with `--resume`; it accepts only empty runtime/data paths and matching installer accounts, preserving prior build checkouts. Existing configured applications use **Administration → Update application**. See the [complete LXC guide](docs/debian-13-lxc.md) for prerequisites, HTTPS, manual installation and recovery. [Docker](docs/docker.md) is also supported.

## Upgrading an existing v11 installation

The root-owned v11 updater selects only v11 tags. Install the v12 updater helpers once as described in [Upgrading to v12](docs/upgrading-to-v12.md), then use **Administration → Update Application**. Existing accounts, data and settings stay in place. Fresh installations use the v12 installer above; do not run that fresh installer over an existing application.

## Development and clean builds

Use Node **24 LTS** (24.19.0 or newer; `.node-version` pins 24.21.0) and **pnpm 11.25.0**. Install pnpm with a normal public tool mask, then use the frozen lockfile:

```bash
(umask 022; npm install --global --umask=0022 pnpm@11.25.0)
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Development listens on port 3000; SQLite initializes automatically. Production requires the initial bootstrap token and exported storage environment. Operational commands do not load Next.js `.env.local`.

```bash
pnpm clean
pnpm verify
pnpm exec playwright install chromium
pnpm test:browser
pnpm package:runtime
node scripts/runtime-integrity.mjs dist/runtime
```

`verify` runs the full dependency audit with verified local mitigation checks, repository formatting, ESLint, TypeScript, unit/API tests and production build. Browser tests use disposable data on port 3100. Debian can use its signed Chromium package with `DM_COMMAND_TABLE_TEST_CHROMIUM_PATH=/usr/bin/chromium pnpm test:browser`.

`clean` removes generated build/test output and TypeScript caches, preserving application data, environment files, dependencies and source. Packaging requires a new destination; the default is `dist/runtime`. Development/build entry points disable Next.js telemetry.

## Application and documentation

- [User guide](docs/user-guide.md): campaign, preparation, combat, import and administration workflows.
- [Architecture](docs/architecture.md): module ownership, persistence, revisions and runtime packaging.
- [API reference](docs/api.md): authenticated endpoints and payload boundaries.
- [Operations](docs/operations.md): configuration, backups, storage checks and maintenance.
- [Debian 13 LXC](docs/debian-13-lxc.md): complete installation, GUI updates, HTTPS and recovery.
- [Docker](docs/docker.md): image preparation, persistent storage and offline runtime deployment.
- [Security/runtime properties](docs/security-efficiency-review.md), [release validation](docs/release-assessment.md) and [Changelog](CHANGELOG.md).

Prepared loading asks whether to preserve active Players/NPCs: Yes retains their live state and replaces only monsters; No replaces the entire roster. Full replacement uses the last prepared Player entry for each trimmed, case-insensitive name. Monsters and NPCs may repeat. Revisions protect saves and Undo recovers previous combat state.

This is a hobby project. No open-source license has been assigned; all rights are reserved unless the repository owner adds one. Retained third-party UI/styles include their upstream notice in `vendor/`.

## Visual monster stat blocks

Import results offer **View stat block** before selection. Opening a Bestiary monster shows the same local parchment-style block with AC, HP, speed, ability scores/modifiers, traits/actions and spellcasting. Core fields and rich text remain editable through the existing Bestiary controls. Combat displays the independently captured encounter snapshot, so later Bestiary edits do not change a live encounter's block. All views render locally and remain available offline.

New imports retain alignment, armor/HP formula details, saving throws, skills, damage/condition defenses, senses, passive Perception, languages and full spell lists in the existing ability/spell fields. Existing saved records render their available fields immediately; reimport with replacement adds catalogue details that older imports did not retain. Existing combat snapshots keep their captured values. Stat blocks render locally without embedding the catalogue webpage.

Full monster token images are stored in a separate **Token** section; Actions & traits remains independent. Upgrading from a release before v11.6.0 automatically moves existing marked Bestiary tokens into that field through schema migration 2.

The v12 refactor separates prepared encounter state from rendering and splits Combat HP/condition editors into focused components. Indexed, memoized encounter summaries and cheaper persistence checks reduce repeated work. Exact API path/method validation and parent-session/origin checks strengthen mutation boundaries. See the architecture and security notes for details and limitations.

Unchanged catalogue imports reuse immutable monster definitions across campaigns. Editing rule text, notes, stats or the token forks a permanently campaign-specific definition; favorites and tags stay campaign-specific without forking. Token imports reuse identical normalized image bytes already owned by the importing account, keeping image permissions intact. See [Bestiary reuse and future sharing](docs/architecture.md#bestiary-reuse-and-future-sharing).
