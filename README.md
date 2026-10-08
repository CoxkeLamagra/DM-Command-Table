# DM Command Table

DM Command Table is a browser-based workspace for preparing and running tabletop RPG campaigns. It combines campaign management, reusable player and monster records, live encounter tracking, session notes, and story planning in one responsive interface.

On desktop, the left menu can collapse to icons only using **Collapse menu**, then reopen using **Expand menu**. Icons retain hover labels, and the browser remembers your preference. Mobile navigation opens with full labels.

This is a hobby project to see how far vibe coding can take me without writing a single piece of code by hand. Please keep this in mind when using this project.

The current release line is **v7**. The established v6 storage and API formats remain stable so existing local installations continue to use their data without migration.

## Features

### Campaigns and sharing

- Create, switch between, and delete multiple campaigns.
- Store normalized campaign records in SQLite on the local application server.
- Export and import complete campaigns as portable JSON files.
- Copy a campaign as a complete independent campaign, including its players and progress.
- Copy a campaign as a reusable template that keeps campaign content, Bestiary records, Stories, Sessions, prepared encounters, and Story–Session links while excluding players and resetting progress.
- Share campaigns with another registered DM Command Table user by username.
- Assign **Editor** access for collaboration or **Viewer** access for read-only use.
- Detect same-browser changes immediately and poll revisions for changes from other devices.
- Manage the campaign name and general campaign notes from a dedicated **Campaign** screen.
- Review a chronological campaign timeline generated automatically from session entries.
- Keep the Campaign screen focused with a 70% Campaign-details and 30% Timeline layout, with Session-note previews limited to 2,000 characters.
- Select a timeline entry to open and focus its corresponding session note.

Campaigns are private by default. Only the owner can share or delete a campaign. Owners and editors can save changes; viewers cannot modify campaign data.

### Local user administration

- The first locally registered account automatically becomes an administrator.
- Administrators can open **Administration** to review all registered accounts.
- Change usernames and display names, reset passwords, or delete accounts.
- Grant or remove administrator access for other users.
- Manage server-wide cookie security, session lifetime, screenshot upload and storage limits, Combat undo retention, and audit retention from the Web UI.
- Enable or disable self-registration from the Web UI.
- Create additional accounts directly from the Web UI.
- Password resets invalidate all active sessions for the affected account.
- Deleting an account also permanently deletes campaigns owned by that account.

An administrator cannot delete their own account or remove their own administrator access. These safeguards ensure that the server always retains at least one administrator.

### Combat tracker

- Give each encounter its own editable name.
- Add ad-hoc players, monsters, or NPCs.
- Use one Add combatants picker for the Campaign roster, Bestiary, and Single-use records. Keep selections across searches and source tabs, filter Players/NPCs, and enter monster quantities before adding.
- Add reusable Players and NPCs from the campaign roster, retaining their type, HP, AC, and notes.
- Add monsters from the campaign bestiary with their linked stat blocks.
- Assign optional numbers to Monsters and NPCs so identically named combatants remain easy to distinguish.
- Track initiative, turn order, rounds, armor class, current and maximum HP, and conditions.
- Apply damage or healing by amount, with an immediate Undo HP change control.
- Keep Save and Next turn visible while scrolling. Reset and clear operations live in Encounter actions and explain their effects before confirmation.
- Highlight combatants at `0 HP` as downed and automatically skip them when advancing to the next turn.
- Reset the round counter without removing combatants.
- Remove all monster combatants while keeping players and NPCs ready for the next encounter.
- Clear the entire encounter to start with an empty combat tracker.
- View race, class, and level information for linked campaign players.

### Players / NPCs

Campaign records have an editable Player or NPC type. Prepared encounters can import editable copies of campaign Players and NPCs. Changes to those copies do not modify the roster. Single-use Players and NPCs remain available in Combat and prepared encounters.

- Save reusable Player and NPC records per campaign, with green Player and blue NPC type tags.
- Record name, race, class, level, optional HP, optional AC, and notes.
- Open and edit players directly from the searchable list.
- Delete individual players.
- Add saved players to an encounter without entering their information again.

Player and NPC management is available from the dedicated **Players / NPC’s** navigation entry.

If HP or AC is not set, the combat tracker uses `10` when that player is added to an encounter.

### Bestiary

- Create monsters manually and assign a name.
- Record type, challenge rating, AC, HP, speed, ability scores, actions and traits, spellcasting details, and spell slots.
- Open a monster's full stat block and edit every field.
- Open and edit monsters directly from the searchable list.
- Delete individual monsters.
- Import monsters from the 5etools-compatible JSON catalogue hosted at [dnd5e.lamagra.link](https://dnd5e.lamagra.link/bestiary.html).
- Search the remote catalogue with typeahead results and compare source, CR, type, HP, and AC before importing.
- Search the campaign Bestiary with typeahead filtering across monster names, types, CR, sources, abilities, spells, and notes.
- Select and import multiple monsters in one operation.
- Detect an existing monster with the same name and source, then choose whether to replace it or discard that individual import.
- Convert imported records to the DM Command Table format and save a campaign-local copy.

Imported monster data belongs to the current campaign and remains editable after import.

### Campaign planning

- Create dated session preparation and recap notes.
- Assign **Planned**, **Active now**, or **Happened** status to Sessions and Story beats.
- Search Session and Story content with typeahead filtering.
- Start with compact collapsed Sessions and Story beats, expand individual entries as needed, or expand and collapse every entry at once.
- Prepare multiple named encounters inside each session.
- Switch between Notes, Encounters, and Linked stories tabs without losing drafts. Save session & encounters saves the whole preparation workspace, including hidden tabs.
- Review collapsed encounters with colour-coded type counts, monster quantities, a combatant preview, and a notes excerpt.
- Add one or more instances of Bestiary monsters to every prepared encounter.
- Assign automatic or custom monster numbers such as **Goblin #1** and **Goblin #2**.
- Prepared encounters start collapsed; expand/collapse each separately or all encounters in a session at once.
- Add NPCs and custom combatants without the Bestiary, then edit names, types, initiative, HP, maximum HP, AC, and rich-text stat blocks and notes.
- Use Edit details on a Bestiary entry to create encounter-specific copies without modifying the Bestiary. Custom details are saved and carried into Combat.
- Load a prepared encounter into Combat while preserving existing players and NPCs, replacing current monsters, and resetting to round 1.
- Review all sessions chronologically from the Campaign timeline and jump directly to an individual session entry.
- Organize story beats by chapter and status: **Planned**, **Active now**, or **Happened**.
- Link Sessions to Story beats from a compact dropdown, review linked Session dates and statuses, and open a linked Session by selecting its name.
- Paste or upload screenshots into every rich-text notes field, including Campaign, Session, Story, Player, and Monster records.
- Format rich text with lists, bold, italic, underline, and text colors.
- Reuse uploaded screenshots from the local library; images scale automatically to the available browser width.

## Storage architecture

DM Command Table uses a local-server model with no external database service:

1. The browser communicates only with the self-hosted Node.js application.
2. The application stores normalized campaign data in server-local SQLite.
3. SQLite runs in WAL mode with foreign-key checks and a five-second busy timeout.
4. The interface detects connectivity loss and never silently overwrites unsaved editor contents.
5. Uploaded screenshots are stored in an `uploads-v6` directory beside the SQLite database.
6. JSON export provides portable campaign data, while server backups preserve uploaded screenshots.

The SQLite database contains local accounts, password hashes, login sessions, campaign ownership, campaign payloads, and Viewer or Editor memberships. The default location is:

```text
./data/dm-command-table-v6.sqlite
```

Set `DM_COMMAND_TABLE_V6_DB_PATH` to use a different location. The directory is created automatically, and migrations run when the database is opened.

By default, screenshots are written to an `uploads-v6` directory beside the database. Set `DM_COMMAND_TABLE_V6_UPLOAD_PATH` to override that location.

> The remote monster catalogue is an import source, not a campaign database. Imported monsters are copied into the local campaign data.

## Authentication

DM Command Table provides its own server-local account system:

- Register the first administrator with a server-configured bootstrap token.
- Keep later registration disabled by default, or explicitly enable it while onboarding additional users.
- Passwords are salted and hashed with Node.js `scrypt`; plaintext passwords are never stored.
- Login sessions use random server-side tokens. Only a SHA-256 hash of each token is stored in SQLite.
- The browser receives an HttpOnly, `SameSite=Lax` session cookie that expires after 30 days.
- Signing out deletes the active server-side session.
- A newly registered account receives an editable example campaign demonstrating combatants, campaign players, bestiary monsters, session notes, and story beats.
- Authentication, account administration, campaign writes and imports, password changes, and screenshot operations use SQLite-backed rate limits that survive application restarts.
- Campaign imports are schema-validated, size-limited, sanitized, and committed atomically.
- Screenshot storage has per-account and server-wide quotas with atomic allocation.
- Combat undo history and campaign audit events use configurable retention limits.

Accounts and sessions exist only in the configured SQLite database. No external identity provider or account database is contacted.

For a plain-HTTP private network deployment, keep:

```bash
DM_COMMAND_TABLE_SECURE_COOKIES=false
```

The default value, `auto`, marks cookies secure whenever the trusted reverse proxy reports HTTPS through `X-Forwarded-Proto`. You can set `DM_COMMAND_TABLE_SECURE_COOKIES=true` to require secure cookies unconditionally. Use `false` only for a trusted plain-HTTP private network.

Production startup requires `DM_COMMAND_TABLE_BOOTSTRAP_TOKEN` before the first account can be created. Generate a random value, enter it in the first-account registration form, and remove or rotate it after setup. `DM_COMMAND_TABLE_REGISTRATION_MODE` defines the initial registration state and defaults to `first-user`, which prevents later public registration. After the administrator exists, use **Administration** to enable or disable self-registration or create additional accounts directly.

Uploaded images are decoded and re-encoded as WebP before storage. Each account has a 100 MiB quota by default; change it with `DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB`. Users can access their own screenshots and screenshots referenced by campaigns they can access. Administrators retain access to the complete screenshot-management library.

The application sends a Content Security Policy, frame protection, MIME-sniffing protection, a restrictive permissions policy, and a referrer policy. Public deployments must use HTTPS; secure session cookies are enabled automatically when the reverse proxy reports HTTPS. Add HSTS at the HTTPS reverse proxy after confirming that the hostname is served exclusively over HTTPS.

## Technology

- React 19 and TypeScript
- Next.js 16 on Node.js
- Tailwind CSS 4 with shadcn-based UI components
- Node's built-in SQLite driver
- SQLite FTS5 for local campaign search

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

The server listens on port `3000` by default. Make sure the process can write to the directories configured by `DM_COMMAND_TABLE_V6_DB_PATH` and `DM_COMMAND_TABLE_V6_UPLOAD_PATH`.

## Docker

The included Docker configuration stores SQLite data in a persistent named volume:

```bash
export DM_COMMAND_TABLE_BOOTSTRAP_TOKEN="$(openssl rand -base64 32)"
docker compose up --build -d
```

The application is then available at [http://localhost:3000](http://localhost:3000). Enter the generated token in the initial setup-token field when registering the first local account. The v6 SQLite database and uploaded screenshots persist in `/data`.

The container runs as the unprivileged `node` user, drops Linux capabilities, uses a read-only root filesystem, and exposes a readiness health check through `/api/health`. By default Compose binds port 3000 only to `127.0.0.1`; set `DMCT_BIND_ADDRESS` deliberately when another host must connect directly:

```bash
DMCT_BIND_ADDRESS=0.0.0.0 docker compose up --build -d
docker compose ps
docker compose exec dm-command-table node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"
```

## Debian 13 LXC deployment

For a complete bare-metal-style LXC installation with Node.js 22, systemd, Nginx, persistent SQLite storage, backups, and a one-command GitHub update workflow, see:

- [Deploy DM Command Table in a Debian 13 LXC](docs/debian-13-lxc.md)

Reusable configuration templates are available under `deploy/debian-13/`.

## Server data backup

Create a consistent, timestamped SQLite snapshot together with its referenced screenshot files:

```bash
pnpm backup
```

The destination defaults to `./data/backups` and can be changed with `DM_COMMAND_TABLE_BACKUP_PATH`. The command holds a SQLite write reservation while capturing the committed database and copying only its recorded screenshots. Saves can briefly wait during large backups. SHA-256 checksums, database integrity and foreign-key checks verify the backup before completion. Backup directories and files receive restrictive permissions. For Docker Compose:

```bash
docker compose exec dm-command-table node scripts/backup-local.mjs
```

Validate SQLite integrity and ensure every screenshot database row has a matching local file (and vice versa):

```bash
pnpm check:storage
```

Verify a completed backup, or restore it into a new empty directory:

```bash
node scripts/restore-local.mjs /path/to/backup
node scripts/restore-local.mjs /path/to/backup /path/to/new-restored-data
```

The restore command refuses existing destinations. Stop the application before switching its database and uploads paths to the restored files. A JSON campaign export contains screenshot references but does not include binary image files; retain a full server backup as well.

## Development verification

```bash
pnpm verify
pnpm exec playwright install chromium
pnpm test:browser
```

Browser tests use a temporary local database and disposable test account, without touching application data. The test server runs on port 3100; build first with `pnpm build`. CI runs verification and browser regression tests on Node.js 22 and 24.

Session Save writes the session and its prepared encounter edits in one transaction. Encounter drafts remain available when their Session is collapsed or filtered out. Leaving Sessions with unsaved changes asks for confirmation. Ability scores, actions and spell details remain in the existing rich-text stat block field.

## Campaign API

The authenticated API is exposed below `/api/v6`:

| Method                           | Endpoint                                                             | Purpose                                                 |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| `GET`, `POST`                    | `/api/v6/campaigns`                                                  | List or create campaigns.                               |
| `GET`, `PATCH`, `DELETE`         | `/api/v6/campaigns/:id`                                              | Read, update, or delete a campaign.                     |
| `POST`                           | `/api/v6/campaigns/:id/copy`                                         | Copy a complete campaign or create a reusable template. |
| `GET`                            | `/api/v6/campaigns/:id/export`                                       | Download a portable campaign JSON document.             |
| `POST`                           | `/api/v6/campaigns/import`                                           | Import a portable campaign JSON document.               |
| `GET`, `POST`, `PATCH`, `DELETE` | `/api/v6/campaigns/:id/{players,sessions,story,monsters,encounters}` | Manage normalized campaign records.                     |

Local registration, login, and logout use `/api/v6-auth`. Account and Administration operations use `/api/v6-account` and `/api/v6-admin`.

## Project structure

```text
app/                  Next.js entry points and local API route adapters
components/ui/        Reusable interface primitives
db/                   SQLite connection, schema, and ordered migrations
features/              Campaign, Combat, Bestiary, Session, Story, and Auth modules
lib/                   Shared HTTP client, version data, and typed local API clients
server/                Local HTTP guards, authentication services, and SQLite repositories
tests/                 Domain, schema, registration, administration, and storage tests
public/                Favicons and static assets
data/                  Runtime SQLite files; excluded from version control
deploy/                Reusable systemd, Nginx, environment, and update templates
docs/                  Deployment and operations guides
Dockerfile             Multi-stage production container build
compose.yaml           Local container deployment with persistent storage
```

Feature modules keep orchestration, focused interface components, and testable domain operations separate. Bestiary catalogue importing and views, prepared encounter editing, Combat initiative and combatant details, and administrator account controls live in focused components rather than monolithic screens. Campaign file handling, Combat advancement and numbering, story/session relationships, screenshot-token parsing, and strict campaign validation live outside their screen components.

Browser and server rich-text handling share one formatting and color policy. API routes remain thin adapters over local server services and repositories, and authenticated JSON responses explicitly prevent private data from being cached. A single authenticated screenshot provider shares the server-local media library across all rich-text fields and Administration. These internal boundaries do not introduce cloud services or change the local-only storage model.

## Data and privacy

- Campaign data is stored in the self-hosted application's server-local SQLite file.
- No external database service is used by this version.
- Passwords and sessions are stored only in the server-local SQLite database.
- Screenshot files remain in the configured server-local uploads directory and are only listed or served to their uploader, an administrator, or a user who can access a campaign that references them.
- Campaigns are private unless the owner explicitly grants access to another registered username.
- Exported JSON files contain the complete campaign payload, including players, monsters, prepared encounters, active combat, notes, and story data.
- Imported monster records are copied into the campaign; the application does not depend on the remote source after import.
- SQLite files, environment files, dependencies, and build output are excluded from version control.

## Current limitations

- Collaboration does not provide presence indicators or live cursor sharing; revision checks prevent silent stale writes.
- SQLite is intended for one application instance with persistent local storage. Multiple application instances must not write independent copies of the database.
- A campaign invite is managed by granting access again with the desired role; the interface does not yet include a membership-management screen.
- Monster importing depends on the external catalogue being reachable and retaining its compatible JSON structure.
- Campaign JSON exports contain screenshot references but not the uploaded image files; include the server `uploads-v6` directory in backups.

## Release history

See [CHANGELOG.md](CHANGELOG.md). The version shown in the lower-left corner of the application links to the GitHub repository.

## License

No open-source license has been assigned. All rights are reserved unless the repository owner adds a license.
