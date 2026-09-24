# DM Command Table

DM Command Table is a browser-based workspace for preparing and running tabletop RPG campaigns. It combines campaign management, reusable player and monster records, live encounter tracking, session notes, and story planning in one responsive interface.

The current stable release is **v1.0.0**.

## Features

### Campaigns and sharing

- Create, switch between, and delete multiple campaigns.
- Store a device-local copy of every campaign in IndexedDB for offline access.
- Synchronize campaign progress to a SQLite database stored on the application server.
- Export and import complete campaigns as portable JSON files.
- Share campaigns with another registered DM Command Table user by username.
- Assign **Editor** access for collaboration or **Viewer** access for read-only use.
- Poll for server changes every five seconds while the application is open.

Campaigns are private by default. Only the owner can share or delete a campaign. Owners and editors can save changes; viewers cannot modify campaign data.

### Combat tracker

- Give each encounter its own editable name.
- Add ad-hoc players, monsters, or NPCs.
- Add reusable players from the campaign roster.
- Add monsters from the campaign bestiary with their linked stat blocks.
- Track initiative, turn order, rounds, armor class, current and maximum HP, and conditions.
- Highlight combatants at `0 HP` as downed and automatically skip them when advancing to the next turn.
- Reset the round counter without removing combatants.
- Clear the entire encounter to start with an empty combat tracker.
- View race, class, and level information for linked campaign players.

### Campaign player roster

- Save reusable player records per campaign.
- Record name, race, class, level, optional HP, optional AC, and notes.
- Use card or compact list views.
- Delete individual players or select several players for bulk deletion.
- Add saved players to an encounter without entering their information again.

If HP or AC is not set, the combat tracker uses `10` when that player is added to an encounter.

### Bestiary

- Create monsters manually and assign a name.
- Record type, challenge rating, AC, HP, speed, ability scores, actions and traits, spellcasting details, and spell slots.
- Open a monster's full stat block and edit every field.
- Use card or compact list views.
- Delete individual monsters or select several monsters for bulk deletion.
- Import monsters from the 5etools-compatible JSON catalogue hosted at [dnd5e.lamagra.link](https://dnd5e.lamagra.link/bestiary.html).
- Search the remote catalogue and compare source, CR, type, HP, and AC before importing.
- Convert imported records to the DM Command Table format and save a campaign-local copy.

Imported monster data belongs to the current campaign and remains editable after import.

### Campaign planning

- Create dated session preparation and recap notes.
- Mark session notes as completed.
- Organize story beats by chapter and status: **Planned**, **Active now**, or **Happened**.

## Storage architecture

DM Command Table uses a local-first model with no external database service:

1. The browser caches campaigns in IndexedDB.
2. The Node.js application stores central campaign data in a server-local SQLite file.
3. SQLite runs in WAL mode with foreign-key checks and a five-second busy timeout.
4. If the server is temporarily unavailable, an existing browser cache remains available.
5. JSON export provides portable backups and file-based campaign sharing.

The SQLite database contains local accounts, password hashes, login sessions, campaign ownership, campaign payloads, and Viewer or Editor memberships. The default location is:

```text
./data/dm-command-table.sqlite
```

Set `DM_COMMAND_TABLE_DB_PATH` to use a different location. The directory is created automatically, and the schema is initialized when the database is first opened.

> The remote monster catalogue is an import source, not a campaign database. Imported monsters are copied into the local campaign data.

## Authentication

DM Command Table provides its own server-local account system:

- Register with a unique username and password.
- Passwords are salted and hashed with Node.js `scrypt`; plaintext passwords are never stored.
- Login sessions use random server-side tokens. Only a SHA-256 hash of each token is stored in SQLite.
- The browser receives an HttpOnly, `SameSite=Lax` session cookie that expires after 30 days.
- Signing out deletes the active server-side session.

Accounts and sessions exist only in the configured SQLite database. No external identity provider or account database is contacted.

On an upgrade from the former single-user mode, the first registered account adopts the sole existing user record so its campaigns remain available.

For a plain-HTTP private network deployment, keep:

```bash
DM_COMMAND_TABLE_SECURE_COOKIES=false
```

After configuring HTTPS, set `DM_COMMAND_TABLE_SECURE_COOKIES=true` and restart the service. This prevents the browser from sending the session cookie over an unencrypted connection.

## Technology

- React 19 and TypeScript
- Next.js 16 on Node.js
- Tailwind CSS 4 with shadcn-based UI components
- Node's built-in SQLite driver
- Drizzle schema definitions
- Browser IndexedDB for the local campaign cache

## Requirements

- Node.js 22.13 or newer
- pnpm 11.25 or newer
- A writable directory for the SQLite database

## Local development

Install the locked dependencies:

```bash
pnpm install --frozen-lockfile
```

Optionally copy the environment example:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The database and tables are created automatically on the first API request.

## Production build

Create the production build:

```bash
pnpm build
```

Start the Node.js server:

```bash
pnpm start
```

The server listens on port `3000` by default. Make sure the process can write to the directory configured by `DM_COMMAND_TABLE_DB_PATH`.

## Docker

The included Docker configuration stores SQLite data in a persistent named volume:

```bash
docker compose up --build -d
```

The application is then available at [http://localhost:3000](http://localhost:3000). Register the first local account from the sign-in screen. Accounts and campaign data persist in the SQLite volume.

## Debian 13 LXC deployment

For a complete bare-metal-style LXC installation with Node.js 22, systemd, Nginx, persistent SQLite storage, backups, and a one-command GitHub update workflow, see:

- [Deploy DM Command Table in a Debian 13 LXC](docs/debian-13-lxc.md)

Reusable configuration templates are available under `deploy/debian-13/`.

## Database backup

The live database can have `-wal` and `-shm` companion files. For a consistent backup, use SQLite's backup command rather than copying only the main file while the application is running:

```bash
sqlite3 ./data/dm-command-table.sqlite ".backup './data/dm-command-table-backup.sqlite'"
```

Alternatively, stop the application before copying the database file and its companion files.

## Migrating from the former Cloudflare D1 version

The application does not automatically copy data from Cloudflare D1 into SQLite. Before switching deployments:

1. Open each campaign in the former deployment.
2. Export it as JSON.
3. Start the SQLite version and sign in as the intended owner.
4. Import each exported campaign.
5. Verify the imported campaign before retiring the former deployment.

Campaign sharing permissions must be granted again after import because exports contain campaign content, not server-side membership records.

## Campaign API

The API is implemented in `app/api/campaigns/route.ts`:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/campaigns` | Load campaigns available to the authenticated user. |
| `POST` | `/api/campaigns` | Create a campaign or grant campaign access. |
| `PUT` | `/api/campaigns` | Save a campaign when the user is its owner or an editor. |
| `DELETE` | `/api/campaigns?id=...` | Delete a campaign owned by the authenticated user. |

Local registration, login, and logout use `POST /api/auth` with the corresponding `action` value.

## Project structure

```text
app/                  Application UI, authentication adapter, and campaign API
components/ui/        Reusable interface primitives
db/                   SQLite connection and Drizzle schema definitions
drizzle/              Historical and schema-generation migration metadata
lib/                   IndexedDB campaign cache and shared utilities
public/                Favicons and static assets
data/                  Runtime SQLite files; excluded from version control
deploy/                Reusable systemd, Nginx, environment, and update templates
docs/                  Deployment and operations guides
Dockerfile             Multi-stage production container build
compose.yaml           Local container deployment with persistent storage
```

## Data and privacy

- Campaign data is stored locally in browser IndexedDB and in the server's SQLite file.
- No external database service is used by this version.
- Passwords and sessions are stored only in the server-local SQLite database.
- Campaigns are private unless the owner explicitly grants access to another registered username.
- Exported JSON files contain the complete campaign payload, including players, monsters, encounters, notes, and story data.
- Imported monster records are copied into the campaign; the application does not depend on the remote source after import.
- SQLite files, environment files, dependencies, and build output are excluded from version control.

## Current limitations

- There is no password-reset or account-administration interface yet. Back up the SQLite database regularly.
- Collaboration synchronizes complete campaign snapshots and does not provide presence indicators, record locking, or conflict merging.
- SQLite is intended for one application instance with persistent local storage. Multiple application instances must not write independent copies of the database.
- A campaign invite is managed by granting access again with the desired role; the interface does not yet include a membership-management screen.
- Monster importing depends on the external catalogue being reachable and retaining its compatible JSON structure.

## Release

- Latest stable release: [DM Command Table 1.0](https://github.com/CoxkeLamagra/DM-Command-Table/releases/tag/v1.0.0)
- Release tag: `v1.0.0`

## License

No open-source license has been assigned. All rights are reserved unless the repository owner adds a license.
